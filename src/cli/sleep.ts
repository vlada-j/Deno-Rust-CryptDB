import {fibonacciAdapter} from "../fibonacci/rustFibonacciAdapter.ts";

export function sleep(n: number | string = 1): Promise<string> {
    const resolvers = Promise.withResolvers<string>();

    fibonacciAdapter.setCallback((msg: string) => {
        console.log(msg);
        resolvers.resolve(msg);
    });

    n = typeof n === "string" ? parseInt(n, 10) : n;
    fibonacciAdapter.sleep(n);

    return resolvers.promise;
}