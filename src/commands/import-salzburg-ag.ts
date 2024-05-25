import { Command } from "commander";
import csv from "csv-parser";
import fs from "fs";
import pg from "pg";
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
require("dotenv").config();

type InputOptions = {
    target: string;
    file: string;
};

const importSalzburgAg = new Command("import-salzburg-ag")
    .description("Import Salzburg AG Data into Database")
    .option("--target <target>", "day/night")
    .option("--file <file>", "path to csv file")
    .action(async (options: InputOptions) => {
        let csvPath = "";
        let dbTable = "";
        if (options.target !== "day" && options.target !== "night") {
            console.log("Invalid target");
            return;
        } else if (options.target == "day") {
            dbTable = "data_day";
        } else if (options.target == "night") {
            dbTable = "data_night";
        }
        if (!options.file) {
            console.log("No file specified");
            return;
        } else {
            csvPath = options.file;
        }
        console.log("Importing CSV File");

        const { Client } = pg;
        const dbConnection = new Client({
            user: process.env.PG_USERNAME,
            host: process.env.PG_HOST,
            password: process.env.PG_PASSWORD,
            port: Number(process.env.PG_PORT),
            database: process.env.PG_DATABASE,
            ssl: false,
        });
        await dbConnection.connect();

        console.log("Parse CSV File");
        const data = fs.readFileSync(csvPath, "utf8");
        let result = data
            .replace(/"Restverbrauch[a-zA-Z0-9 (),]*"/g, "consumption")
            .replace(/"Datum und Uhrzeit"/g, "date")
            .replace(/"Status"/g, "status")
            .replace(/,/g, ".");

        if (result.charCodeAt(0) === 0xfeff) {
            result = result.substr(1);
        }
        console.log("Write parsed CSV File");
        fs.writeFileSync("/tmp/Lastprofilwerte_parsed.csv", result, "utf8");

        type Lastprofilwerte = {
            date: string;
            consumption: number;
            status: string;
        };

        console.log("Insert parsed CSV File into Database");
        const results: Lastprofilwerte[] = [];
        fs.createReadStream("/tmp/Lastprofilwerte_parsed.csv", "utf8")
            .pipe(csv({ separator: ";" }))
            .on("data", (data) => results.push(data))
            .on("end", () => {
                dbConnection.query(`SELECT date FROM ${dbTable}`, async (err, res) => {
                    const promises = results.map((result) => {
                        console.log(`Inserting ${result.date}`);
                        if (res && res.rows && res.rows.find((row) => Date.parse(row.date) === Date.parse(result.date))) {
                            console.log("Already exists");
                            return Promise.resolve(); // Return a resolved promise for existing entries
                        } else {
                            return new Promise((resolve, reject) => {
                                try {
                                    dbConnection.query(
                                        `INSERT INTO ${dbTable} (date, consumption) VALUES (to_timestamp($1), $2)`,
                                        [Date.parse(result.date) / 1000, Number(result.consumption)],
                                        (err, res) => {
                                            if (err) {
                                                console.log(err);
                                                reject(err);
                                            } else {
                                                resolve(res);
                                            }
                                        },
                                    );
                                } catch (err) {
                                    console.log(err);
                                }
                            });
                        }
                    });

                    // Wait for all queries to complete
                    await Promise.all(promises);

                    // Delete the file
                    fs.unlinkSync("/tmp/Lastprofilwerte_parsed.csv");

                    // Close the database connection
                    dbConnection.end((err) => {
                        if (err) {
                            console.log("Error closing connection", err);
                        } else {
                            console.log("Database connection closed");
                        }
                    });
                });
            });
    });

export { importSalzburgAg };
