#!/usr/bin/env -S deno run --allow-read --allow-write

import { getCliCommand } from "./cli/args.ts";
import { showHelp } from "./cli/help.ts";
import { showVersion } from "./cli/help.ts";
import { dbTest } from "./cli/dbTest.ts";
import { processFibonacci } from "./cli/fibonacci.ts";
import { sleep } from "./cli/sleep.ts";



if (import.meta.main) {
	console.clear();
	await main();
}

//----------------------------------------------------------------------------------------------------------

async function main() {
	const { command, options } = getCliCommand();

	switch (command) {
		case "help":
			showHelp();
			return;

		case "version":
			showVersion();
			return;

		case "fibonacci":
			await processFibonacci(options || undefined);
			break;

		case "sleep":
			await sleep(options || undefined);
			break;

		case "test":
            await dbTest();
			break;

		default:
			if (command) {
				console.error(`Unknown command: ${command}`);
				console.log("Run with --help to see available cli");
				Deno.exit(1);
			}
	}
}
