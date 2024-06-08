import { Command } from "commander";
import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
require("dotenv").config();

type InputOptions = {
    target: string;
    headless: boolean;
};

const downloadSalzburgAg = new Command("download-salzburg-ag")
    .description("Download Salzburg AG Data")
    .option("--target <target>", "day/night")
    .option("--headless", "activate headless mode")
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
            console.log("Close Cookie Banner");
            await driver.wait(until.elementLocated(By.id("uc-btn-deny-banner")), 10000);
            await driver.findElement(By.id("uc-btn-deny-banner")).click();
            console.log("Navigate to correct Page");
            await driver.get("https://portal.salzburgnetz.at/content/nepo/de/anlagen");
            await driver.wait(until.elementTextContains(await driver.findElement(By.tagName("body")), targetElement), 10000);
            const element = await driver.findElement(By.xpath(`//*[contains(text(), '${targetElement}')]`));
            await element.click();

            // Switch to Viertelstunde
            console.log("Switch to Viertelstunde");
            await driver.wait(until.elementLocated(By.css("[data-cy='st-typeSelector']")), 10000);
            const selectElement = await driver.findElement(By.css("[data-cy='st-typeSelector']"));
            // const option = await selectElement.findElement(By.css(`option[value="1"]`));
            await driver.executeScript("arguments[0].value = '1';", selectElement);
            console.log("4");
            // await driver.sleep(100000);
            // await option.click();
            console.log("5");

            await driver.sleep(3000);

            // Switch to all data
            console.log("Switch to all data");
            await driver.wait(until.elementLocated(By.css("[data-cy='st-selector']")), 10000);
            const selectElement2 = await driver.findElement(By.css("[data-cy='st-selector']"));
            // const option2 = await selectElement2.findElement(By.css(`option[value="5: 0"]`));
            // await option2.click();
            await driver.executeScript("arguments[0].value = '5: 0';", selectElement2);

            await driver.sleep(10000);

            console.log("Download CSV");
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
