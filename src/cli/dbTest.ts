import { demonstrateAsyncSQL } from "../database/demonstrateAsyncSQL.ts";
import { performanceTest } from "../database/performanceTest.ts";

const DB_PATH = "./storage/test-encrypted.db";
const DB_PASSWORD = "your-secure-password-here";

export async function dbTest() {
    try {
        await demonstrateAsyncSQL(DB_PATH, DB_PASSWORD);
        await performanceTest(DB_PATH, DB_PASSWORD);
    } catch (error) {
        console.error("Application error:", error);
    }
}