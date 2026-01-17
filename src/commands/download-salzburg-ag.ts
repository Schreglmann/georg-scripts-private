import axios from "axios";
import { Command } from "commander";
import pg from "pg";
import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
require("dotenv").config();

type InputOptions = {
    target: string;
    headless: boolean;
    debug?: boolean;
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
    .action(async (options: InputOptions) => {
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
        let driver;
        if (options.headless) {
            driver = new Builder()
                .forBrowser("chrome")
                .setChromeOptions(new chrome.Options().addArguments("--remote-debugging-pipeline").addArguments("--headless").windowSize(screen))
                .build();
        } else {
            driver = new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options().windowSize(screen)).build();
        }
        const sbgUsername = process.env.SBG_AG_USERNAME;
        const sbgPassword = process.env.SBG_AG_PASSWORD;
        try {
            console.log("Open Salzburg AG Portal");
            await driver.get("https://portal.salzburgnetz.at/content/nepo/de/anlagen/anlage");
            await driver.wait(until.elementLocated(By.id("signInName")), 10000);
            await driver.findElement(By.id("signInName")).sendKeys(String(sbgUsername));
            await driver.findElement(By.id("password")).sendKeys(String(sbgPassword), Key.RETURN);
            await driver.wait(until.urlContains("/dashboard"), 20000);

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
                if (dayDatesCount.rowCount == 96) {
                    console.log(`Skipping Day ${entry.DATE}`);
                    continue;
                } else {
                    console.log(`Preparing Day ${entry.DATE}`);
                }
                const dbQueries = [];
                for (const data of entry.DAILY_VALUES) {
                    if (!data.PROF_TIME) {
                        console.log(`Time missing for ${data.PROF_DATE}`);
                        continue;
                    }
                    const parsedDate = new Date(Date.parse(`${data.PROF_DATE}T${data.PROF_TIME}`));
                    if (dayDatesCount.rows.find((row) => Date.parse(row.date) == parsedDate.valueOf())) {
                        console.log(`Skipping ${data.PROF_DATE} ${data.PROF_TIME}`);
                        continue;
                    } else {
                        console.log(`Preparing ${data.PROF_DATE} ${data.PROF_TIME}`);
                        dbQueries.push(
                            `INSERT INTO ${options.target == "day" ? "data_day" : "data_night"} (date, consumption) VALUES (to_timestamp(${
                                parsedDate.valueOf() / 1000
                            }), ${data.PROF_VALUE})`,
                        );
                    }
                }
                if (dbQueries.length == 0) {
                    console.log(`No Entries for Day ${entry.DATE}`);
                    continue;
                }
                console.log(`Inserting Data for Day ${entry.DATE} to Database`);
                const allQueries = `${dbQueries.join(";")};`;
                await dbConnection.query(allQueries);
            }
        } catch (error) {
            console.error(error);
        } finally {
            console.log("All Data inserted successfully");
            await driver.quit();
            dbConnection.end((err) => {
                if (err) {
                    console.log("Error closing connection", err);
                } else {
                    console.log("Database connection closed successfully");
                }
            });
        }
    });

export { downloadSalzburgAg };
