import { Command } from "commander";

import { downloadSalzburgAg } from "./commands/download-salzburg-ag";
import { importSalzburgAg } from "./commands/import-salzburg-ag";

const program = new Command();

program.addCommand(downloadSalzburgAg);
program.addCommand(importSalzburgAg);

try {
    program.parseAsync();
} catch (e) {
    console.log("Error executing command");
    console.log(e);
}
