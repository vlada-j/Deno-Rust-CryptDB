import { fibonacciAdapter } from "../fibonacci/rustFibonacciAdapter.ts";

export function processFibonacci(n: number | string = 2): Promise<string> {
    const resolvers = Promise.withResolvers<string>();

    fibonacciAdapter.setCallback((msg: string) => {
        console.log(msg);
        resolvers.resolve(msg);
    });

    n = typeof n === "string" ? parseInt(n, 10) : n;
    fibonacciAdapter.fibonacci(n);

    return resolvers.promise;
}