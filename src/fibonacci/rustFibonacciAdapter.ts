import { resolve } from "@std/path";

interface FibonacciFunctions {
    fibonacci: {
        parameters: ["u32"];
        result: "u32";
    };
    sleep: {
        parameters: ["u64"];
        result: "void";
    };
    set_callback: {
        parameters: ["function"];
        result: "void";
    };
    [key: string]: Deno.ForeignFunction;
}

function getLibraryPath(): string {
    const platform = Deno.build.os;

    let fileName: string;

    switch (platform) {
        case "windows":
            fileName = "fibonacci.dll";
            break;
        case "darwin":
            fileName = "libfibonacci.dylib";
            break;
        case "linux":
            fileName = "libfibonacci.so";
            break;
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }

    return resolve("./libs/fibonacci/target/release/", fileName);
}

export class RustFibonacciAdapter {
    private static instance: RustFibonacciAdapter;
    private symbols: FibonacciFunctions = {
        fibonacci: { parameters: ["u32"], result: "u32" },
        sleep: { parameters: ["u64"], result: "void" },
        set_callback: { parameters: ["function"], result: "void" }
    };
    private dylib: Deno.DynamicLibrary<FibonacciFunctions>;

    private constructor() {
        try {
            this.dylib = Deno.dlopen( getLibraryPath(), this.symbols);
        } catch (error) {
            console.error(`Failed to load Fibonacci library: ${error instanceof Error ? error.message : error}`);
            throw error;
        }
    }

    public static getInstance(): RustFibonacciAdapter {
        if (!RustFibonacciAdapter.instance) {
            RustFibonacciAdapter.instance = new RustFibonacciAdapter();
        }
        return RustFibonacciAdapter.instance;
    }

    public sleep(seconds: number = 0) {
        return this.dylib.symbols.sleep(BigInt(seconds));
    }

    public fibonacci(seconds: number = 0) {
        return this.dylib.symbols.fibonacci(seconds);
    }

    public setCallback(cb: (msg: string) => void) {
        const definition = { parameters: ["pointer"], result: "void" } as const;
        const callback = (res: Deno.PointerValue) => {
            unSafeCallback.close();
            cb(this.pointerValue2String(res));
        };

        const unSafeCallback = new Deno.UnsafeCallback(definition, callback);
        this.dylib.symbols.set_callback(unSafeCallback.pointer);
    }

    private pointerValue2String(ptr: Deno.PointerValue): string {
        if (ptr === null || ptr === undefined) {
            return "";
        }
        const view = new Deno.UnsafePointerView(ptr);
        return view.getCString();
    }
}


export const fibonacciAdapter = RustFibonacciAdapter.getInstance();
