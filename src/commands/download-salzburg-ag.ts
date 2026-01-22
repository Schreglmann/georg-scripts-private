import axios from "axios";
import { Command } from "commander";
import pg from "pg";
import { Builder, By, Key, until } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
require("dotenv").config();

type InputOptions = {
    target: string;
    headless: boolean;
    debug?: boolean;
    force?: boolean;
};

const downloadJson = async (access_token: string, dayOrNight: string) => {
    const data = {
        IV_ANLAGE: dayOrNight === "day" ? process.env.DAY_ANLAGE : process.env.NIGHT_ANLAGE,
        IV_AB: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0],
        IV_BIS: new Date().toISOString().split("T")[0],
        IV_DAILY: "V",
        GPNR: process.env.GPNR,
    };

    console.log("Target: ", dayOrNight);

    const config = {
        method: "post",
        url: "https://portal.salzburgnetz.at/backend/equipments/profiles",
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0",
            Accept: "application/json",
            "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "x-nekupo-target": "backend_cosmos",
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
            Origin: "https://portal.salzburgnetz.at",
            Connection: "keep-alive",
            Referer: "https://portal.salzburgnetz.at/content/nepo/de/anlagen/anlage",
            Cookie: "",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
        },
        data: data,
    };

    const resp = await axios(config);
    return resp.data;
};

const downloadSalzburgAg = new Command("download-salzburg-ag")
    .description("Download Salzburg AG Data")
    .option("--target <target>", "day/night")
    .option("--headless", "activate headless mode")
    .option("--debug", "save response to file")
    .option("--force", "override existing database entries")
    .action(async (options: InputOptions) => {
        const startTime = new Date();
        if (options.target !== "day" && options.target !== "night") {
            console.log("Invalid target");
            return;
        }
        const { Client } = pg;
        const dbConnection = new Client({
            user: process.env.PG_USERNAME,
            host: process.env.PG_HOST,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
            database: process.env.PG_DATABASE,
            ssl: false,
        });

        console.log("Download Salzburg AG Data");
        const screen = {
            width: 1920,
            height: 1080,
        };
        let totalSkipped = 0;
        let totalWritten = 0;
        const writtenDays: string[] = [];
        let driver;
        if (options.headless) {
            const chromeOptions = new chrome.Options()
                .addArguments("--headless")
                .addArguments("--no-sandbox")
                .addArguments("--disable-dev-shm-usage")
                .addArguments("--disable-gpu")
                .addArguments("--disable-software-rasterizer")
                .addArguments("--disable-extensions")
                .windowSize(screen);
            driver = new Builder()
                .forBrowser("chrome")
                .setChromeOptions(chromeOptions as any)
                .build();
        } else {
            const chromeOptions = new chrome.Options().windowSize(screen);
            driver = new Builder()
                .forBrowser("chrome")
                .setChromeOptions(chromeOptions as any)
                .build();
        }
        const sbgUsername = process.env.SBG_AG_USERNAME;
        const sbgPassword = process.env.SBG_AG_PASSWORD;

        if (!sbgUsername || !sbgPassword) {
            console.error("Error: SBG_AG_USERNAME or SBG_AG_PASSWORD environment variables are not set");
            return;
        }

        try {
            console.log("Open Salzburg AG Portal");
            await driver.get("https://portal.salzburgnetz.at/content/nepo/de/anlagen/anlage");
            console.log("Waiting for login form...");
            await driver.wait(until.elementLocated(By.id("signInName")), 10000);
            console.log("Entering credentials...");
            await driver.findElement(By.id("signInName")).sendKeys(String(sbgUsername));
            await driver.findElement(By.id("password")).sendKeys(String(sbgPassword), Key.RETURN);
            console.log("Waiting for redirect to dashboard...");
            try {
                await driver.wait(until.urlContains("/dashboard"), 20000);
            } catch (error) {
                const currentUrl = await driver.getCurrentUrl();
                console.error(`Login failed. Current URL: ${currentUrl}`);
                throw error;
            }

            // After logging in and any other actions
            console.log("Reading session storage");
            const sessionStorageData: any = await driver.executeScript("return window.sessionStorage");

            // Download JSON
            const jsonResponse = await downloadJson(sessionStorageData.access_token, options.target);

            // Save response to file if debug mode is enabled
            if (options.debug) {
                const fs = require("fs");
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const filename = `salzburg-ag-${options.target}-${timestamp}.json`;
                fs.writeFileSync(filename, JSON.stringify(jsonResponse, null, 2));
                console.log(`Response saved to ${filename}`);
            }

            await dbConnection.connect();

            for (const entry of jsonResponse) {
                const dayDatesCount = await dbConnection.query(
                    `SELECT date FROM ${
                        options.target == "day" ? "data_day" : "data_night"
                    } WHERE date BETWEEN $1::date AND $1::date + '1 day'::interval - '1 second'::interval`,
                    [entry.DATE],
                );
                if (!options.force && dayDatesCount.rowCount == 96) {
                    console.log(`Skipping Day ${entry.DATE}`);
                    totalSkipped++;
                    continue;
                } else {
                    console.log(`Preparing Day ${entry.DATE}`);
                }

                // Delete existing entries for this day if force mode is enabled
                if (options.force && dayDatesCount.rowCount && dayDatesCount.rowCount > 0) {
                    console.log(`Deleting existing entries for Day ${entry.DATE}`);
                    await dbConnection.query(
                        `DELETE FROM ${
                            options.target == "day" ? "data_day" : "data_night"
                        } WHERE date BETWEEN $1::date AND $1::date + '1 day'::interval - '1 second'::interval`,
                        [entry.DATE],
                    );
                }

                const dbQueries = [];
                for (const data of entry.DAILY_VALUES) {
                    if (!data.PROF_TIME) {
                        console.log(`Time missing for ${data.PROF_DATE}`);
                        continue;
                    }
                    if (data.PROF_VALUE === 0) {
                        console.log(`Skipping ${data.PROF_DATE} ${data.PROF_TIME} (value is 0)`);
                        continue;
                    }
                    const parsedDate = new Date(Date.parse(`${data.PROF_DATE}T${data.PROF_TIME}`));
                    if (!options.force && dayDatesCount.rows.find((row) => Date.parse(row.date) == parsedDate.valueOf())) {
                        console.log(`Skipping ${data.PROF_DATE} ${data.PROF_TIME}`);
                        continue;
                    } else {
                        console.log(`Writing ${data.PROF_DATE} ${data.PROF_TIME} (value: ${data.PROF_VALUE})`);
                        dbQueries.push(
                            `INSERT INTO ${options.target == "day" ? "data_day" : "data_night"} (date, consumption) VALUES (to_timestamp(${
                                parsedDate.valueOf() / 1000
                            }), ${data.PROF_VALUE})`,
                        );
                    }
                }
                if (dbQueries.length == 0) {
                    console.log(`No Entries for Day ${entry.DATE}`);
                    totalSkipped++;
                    continue;
                }
                console.log(`Inserting Data for Day ${entry.DATE} to Database`);
                const allQueries = `${dbQueries.join(";")};`;
                await dbConnection.query(allQueries);
                totalWritten++;
                writtenDays.push(entry.DATE);
            }
        } catch (error) {
            console.error(error);
        } finally {
            const endTime = new Date();
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationSeconds = Math.floor(durationMs / 1000);
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;

            console.log("\n=== Summary ===");
            console.log(`Start time: ${startTime.toLocaleString()}`);
            console.log(`End time: ${endTime.toLocaleString()}`);
            console.log(`Duration: ${minutes}m ${seconds}s`);
            console.log(`Total days skipped: ${totalSkipped}`);
            console.log(`Total days written: ${totalWritten}`);
            if (writtenDays.length > 0) {
                console.log(`Days written: ${writtenDays.join(", ")}`);
            }
            console.log("===============\n");
            console.log("All Data inserted successfully");
            await driver.quit();
            try {
                await dbConnection.end();
                console.log("Database connection closed successfully");
            } catch (err) {
                console.log("Note: Error closing connection (data was saved successfully):", err instanceof Error ? err.message : String(err));
            }
        }
    });

export { downloadSalzburgAg };
