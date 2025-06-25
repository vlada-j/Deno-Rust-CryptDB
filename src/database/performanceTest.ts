import { asyncEDB } from "./rustDatabaseAdapter.ts";

export async function performanceTest(dbPath: string, dbPassword: string) {
    console.log("\nPerformance Test: Multiple Async Queries");

    const connId = await asyncEDB.openDatabase(dbPath, dbPassword);
    const startTime = performance.now();
    const promises = [];

    for (let i = 0; i < 10; i++) {
        promises.push(
            asyncEDB.executeSQL(
                connId,
                `SELECT ${i} as query_id, COUNT(*) as count FROM users`,
            ),
        );
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();

    console.log(
        `Executed ${results.length} concurrent queries in ${(endTime - startTime).toFixed(2)}ms`,
    );
    console.log(`All queries successful: ${results.every((r) => r.success)}`);

    asyncEDB.closeDatabase(connId);
}