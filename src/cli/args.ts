import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";

export function getCliCommand() {
    const args = parse(Deno.args);
    const command = args._[0];
    const options = args._[1];

    switch (command) {
        case "help":
        case "h":
            return { command: "help", options: null };

        case "version":
        case "v":
            return { command: "version", options: null };

        case "test":
            return { command: "test", options: null };

        case "fibonacci":
            return { command: "fibonacci", options: parseOptionAsNumber(options) };

        case "sleep":
            return { command: "sleep", options: parseOptionAsNumber(options) };

        default:
            return { command, options };
    }
}

function parseOptionAsNumber(option: string | number | undefined): number {
    switch (typeof option) {
        case "number":
            return option;

        case "string": {
            const parsed = parseInt(option, 10);
            return isNaN(parsed) ? 0 : parsed;
        }

        default:
            return 0;
    }
}