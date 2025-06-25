import {fibonacciAdapter} from "../fibonacci/rustFibonacciAdapter.ts";

export async function sleep(n: number | string = 1): Promise<string> {
    const resolvers = Promise.withResolvers<string>();
    let timer: number;

    fibonacciAdapter.setCallback((msg: string) => {
        console.log(msg, `  (${currentTime()})`);
        resolvers.resolve(msg);
        clearInterval(timer);
    });

    console.log(`Rust go to sleep for ${n} seconds, and Deno will wait  (${currentTime()})`);

    n = typeof n === "string" ? parseInt(n, 10) : n;
    fibonacciAdapter.sleep(n);

    timer = setInterval(() => {
        console.log(`   Deno is working while Rust is still sleeping...`);
    }, 1000);

    return resolvers.promise;
}

function currentTime(): string {
    const date = new Date();
    return date.toLocaleTimeString();
}