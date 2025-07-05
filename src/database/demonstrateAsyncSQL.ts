import { cryptoDB, SQLResult } from "./rustDatabaseAdapter.ts";

export async function demonstrateAsyncSQL(dbPath: string, dbPassword: string) {
    console.log("Starting Async SQL Demonstration");

    // Ensure a clean state by removing the old database file
    try {
        Deno.removeSync(dbPath);
        console.log("Removed old database file.");
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
    }

    let connId: number;

    try {
        // 1. Open an encrypted database connection
        console.log("\nOpening encrypted database...");
        connId = await cryptoDB.openDatabase(dbPath, dbPassword);
        console.log(`✅ Database opened with connection ID: ${connId}`);

        // 2. Verify database encryption
        console.log("\nVerifying database encryption...");
        const isEncrypted = cryptoDB.verifyEncryption(dbPath);
        if (isEncrypted) {
            console.log("✅ Database is properly encrypted!");
        } else {
            console.log("❌ WARNING: Database is NOT encrypted!");
        }

        // 3. Create tables
        console.log("\nCreating tables...");
        const createTableResult = await cryptoDB.executeSQL(
            connId,
            `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
        );

        if (createTableResult.success) {
            console.log("✅ Table created successfully");
        } else {
            console.error(
                "❌ Failed to create table:",
                createTableResult.error,
            );
            return;
        }

        // 4. Insert some test data
        console.log("\nInserting test data...");

        const insertQueries = [
            "INSERT INTO users (name, email, age) VALUES ('Alice Johnson', 'alice@example.com', 28)",
            "INSERT INTO users (name, email, age) VALUES ('Bob Smith', 'bob@example.com', 35)",
            "INSERT INTO users (name, email, age) VALUES ('Charlie Brown', 'charlie@example.com', 42)",
        ];

        for (const query of insertQueries) {
            const result: SQLResult = await cryptoDB.executeSQL(connId, query);
            if (result.success) {
                console.log(
                    `✅ Inserted user with ID: ${result.last_insert_rowid}`,
                );
            } else {
                console.error("❌ Insert failed:", result.error);
            }
        }

        // 5. Query data
        console.log("\nQuerying all users...");
        const selectResult: SQLResult = await cryptoDB.executeSQL(
            connId,
            "SELECT * FROM users ORDER BY id",
        );

        if (selectResult.success && selectResult.rows) {
            console.log(`✅ Found ${selectResult.count} users:`);
            selectResult.rows.forEach((user, index) => {
                console.log(
                    `   ${
                        index + 1
                    }. ${user.name} (${user.email}) - Age: ${user.age}`,
                );
            });
        } else {
            console.error("❌ Query failed:", selectResult.error);
        }

        // 6. Update data
        console.log("\nUpdating user age...");
        const updateResult: SQLResult = await cryptoDB.executeSQL(
            connId,
            "UPDATE users SET age = 29 WHERE name = 'Alice Johnson'",
        );

        if (updateResult.success) {
            console.log(`✅ Updated ${updateResult.rows_affected} row(s)`);
        } else {
            console.error("❌ Update failed:", updateResult.error);
        }

        // 7. Complex query with conditions
        console.log("\nQuerying users over 30...");
        const complexQuery: SQLResult = await cryptoDB.executeSQL(
            connId,
            `
      SELECT name, email, age,
             CASE 
               WHEN age >= 40 THEN 'Senior'
               WHEN age >= 30 THEN 'Mid-level'
               ELSE 'Junior'
             END as category
      FROM users 
      WHERE age > 30 
      ORDER BY age DESC
    `,
        );

        if (complexQuery.success && complexQuery.rows) {
            console.log(`Users over 30 (${complexQuery.count} found):`);
            complexQuery.rows.forEach((user) => {
                console.log(
                    `   • ${user.name} (${user.age}) - ${user.category}`,
                );
            });
        }

        // 8. Delete some data
        console.log("\nDeleting user...");
        const deleteResult: SQLResult = await cryptoDB.executeSQL(
            connId,
            "DELETE FROM users WHERE email = 'bob@example.com'",
        );

        if (deleteResult.success) {
            console.log(`✅ Deleted ${deleteResult.rows_affected} user(s)`);
        } else {
            console.error("❌ Delete failed:", deleteResult.error);
        }

        // 9. Final count
        console.log("\nFinal user count...");
        const countResult: SQLResult = await cryptoDB.executeSQL(
            connId,
            "SELECT COUNT(*) as total FROM users",
        );

        if (countResult.success && countResult.rows) {
            console.log(
                `✅ Total users remaining: ${countResult.rows[0].total}`,
            );
        }

        // 10. Test error handling
        console.log("\nTesting error handling...");
        const errorResult: SQLResult = await cryptoDB.executeSQL(
            connId,
            "SELECT * FROM non_existent_table",
        );
        if (!errorResult.success) {
            console.log(`✅ Error handling works: ${errorResult.error}`);
        } else {
            console.log(
                "❌ Test failed: Expected a failed query but it succeeded.",
            );
        }
    } catch (error: any) {
        console.error("Fatal error:", error.message);
    } finally {
        // 11. Clean up connection
        if (connId!) {
            console.log("\nClosing database connection...");
            const closed = cryptoDB.closeDatabase(connId);
            console.log(
                closed
                    ? "✅ Connection closed"
                    : "❌ Failed to close connection",
            );
        }
    }

    console.log("\nAsync SQL Demonstration Complete!");
}