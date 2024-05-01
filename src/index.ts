import { Command } from "commander";

import { importSalzburgAg } from "./commands/import-salzburg-ag";

const program = new Command();

program.addCommand(importSalzburgAg);

try {
    program.parseAsync();
} catch (e) {
    console.log("Error executing command");
    console.log(e);
}
