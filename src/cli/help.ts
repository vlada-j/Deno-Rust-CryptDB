// inport version from deno.json

import denoJson from "../../deno.json" with { type: "json" };
export function showHelp() {
	console.log(`
Application v${(denoJson as any)["version"]}

Usage: deno run --allow-ffi --allow-read --allow-write main.ts [command] [options]

Commands:
  fibonacci			Run fibonacci test with the given number (default: 2)
  test				Run database test
  sleep				Run sleep for the given seconds (default: 1)
  help         		Show help
  version			Show version

Examples:
  deno run --allow-ffi --allow-read --allow-write src/main.ts fibonacci 3
`);
}

export function showVersion() {
	console.log(`Application v${(denoJson as any)["version"]}`);
}