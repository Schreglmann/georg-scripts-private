import { Command } from "commander";
import { Browser, Builder, By, Key, until } from "selenium-webdriver";
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
require("dotenv").config();

type InputOptions = {
    target: string;
    file: string;
};

const downloadSalzburgAg = new Command("download-salzburg-ag")
    .description("Download Salzburg AG Data")
    .option("--target <target>", "day/night")
    .action(async (options: InputOptions) => {
        let targetElement = "";
        if (options.target !== "day" && options.target !== "night") {
            console.log("Invalid target");
            process.exit(1);
        } else if (options.target == "day") {
            targetElement = "Systemnutzung NE 7 - Grundpreispauschale";
        } else if (options.target == "night") {
            targetElement = "Systemnutzung Strom NE 7 - Heißwasser NT";
        } else {
            console.log("Invalid target");
            process.exit(1);
        }
        console.log("Download Salzburg AG Data");
        const driver = await new Builder().forBrowser(Browser.FIREFOX).build();
        const sbgUsername = process.env.SBG_AG_USERNAME;
        const sbgPassword = process.env.SBG_AG_PASSWORD;
        try {
            await driver.get("https://portal.salzburgnetz.at/content/nepo/de/anlagen/anlage");
            await driver.wait(until.elementLocated(By.id("signInName")), 10000);
            await driver.findElement(By.id("signInName")).sendKeys(String(sbgUsername));
            await driver.findElement(By.id("password")).sendKeys(String(sbgPassword), Key.RETURN);
            await driver.wait(until.elementLocated(By.id("uc-btn-deny-banner")), 10000);
            await driver.findElement(By.id("uc-btn-deny-banner")).click();
            await driver.get("https://portal.salzburgnetz.at/content/nepo/de/anlagen");
            await driver.wait(until.elementTextContains(await driver.findElement(By.tagName("body")), targetElement), 10000);
            const element = await driver.findElement(By.xpath(`//*[contains(text(), '${targetElement}')]`));
            await element.click();

            // Switch to Viertelstunde
            await driver.wait(until.elementLocated(By.css("[data-cy='st-typeSelector']")), 10000);
            const selectElement = await driver.findElement(By.css("[data-cy='st-typeSelector']"));
            const option = await selectElement.findElement(By.css(`option[value="1"]`));
            await option.click();

            // Switch to all data
            await driver.wait(until.elementLocated(By.css("[data-cy='st-selector']")), 10000);
            const selectElement2 = await driver.findElement(By.css("[data-cy='st-selector']"));
            const option2 = await selectElement2.findElement(By.css(`option[value="5: 0"]`));
            await option2.click();

            await driver.sleep(5000);

            await driver.wait(until.elementLocated(By.className("highcharts-button-symbol")), 10000);
            const clickDownloadMenu = await driver.findElement(By.className("highcharts-button-symbol"));
            await clickDownloadMenu.click();

            await driver.wait(until.elementLocated(By.xpath("//li[contains(text(), 'Download CSV')]")), 10000);
            const downloadCSV = await driver.findElement(By.xpath("//li[contains(text(), 'Download CSV')]"));
            await downloadCSV.click();

            await driver.sleep(1000);
        } finally {
            await driver.quit();
        }
    });

export { downloadSalzburgAg };
