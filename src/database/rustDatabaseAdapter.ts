/**
 * Async EDB (Encrypted Database) - Simplified FFI interface
 *
 * This module provides async SQL execution for the encrypted database.
 */

import { resolve } from "@std/path";

// Define the async SQL FFI interface
interface AsyncEDBFunctions {
	open_encrypted_database: {
		parameters: ["buffer", "buffer"],
		result: "i64",
		nonblocking: false,
	};
	execute_sql_async: {
		parameters: ["i64", "buffer", "function"],
		result: "i64",
		nonblocking: false,
	};
	close_database_connection: {
		parameters: ["i64"],
		result: "bool",
		nonblocking: false,
	};
	free_sql_result: {
		parameters: ["pointer"],
		result: "void",
		nonblocking: false,
	};
	verify_database_encryption: {
		parameters: ["buffer"],
		result: "bool",
		nonblocking: false,
	};
	[key: string]: Deno.ForeignFunction;
}

// SQL Result interface
export interface SQLResult {
	success: boolean;
	rows?: any[];
	count?: number;
	rows_affected?: number;
	last_insert_rowid?: number;
	error?: string;
}

// Load the appropriate dynamic library based on the platform
function getLibraryPath(): string {
	const platform = Deno.build.os;

	let fileName: string;

	switch (platform) {
		case "windows":
			fileName = "crypto_db.dll";
			break;
		case "darwin":
			fileName = "libcrypto_db.dylib";
			break;
		case "linux":
			fileName = "libcrypto_db.so";
			break;
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}

	return resolve("./libs/crypto-db/target/release/", fileName);
}

/**
 * Async Encrypted Database class
 */
export class RustDatabaseAdapter {
	private static instance: RustDatabaseAdapter;
	private lib: Deno.DynamicLibrary<AsyncEDBFunctions>;
	private encoder = new TextEncoder();
	private decoder = new TextDecoder();
	private pendingCallbacks = new Map<number, (result: SQLResult) => void>();

	private constructor() {
		// Load the dynamic library
		const libraryPath = getLibraryPath();
		console.log(`Loading EDB library from: ${libraryPath}`);

		try {
			this.lib = Deno.dlopen(libraryPath, {
				open_encrypted_database: {
					parameters: ["buffer", "buffer"],
					result: "i64",
					nonblocking: false,
				},
				execute_sql_async: {
					parameters: ["i64", "buffer", "function"],
					result: "i64",
					nonblocking: false,
				},
				close_database_connection: {
					parameters: ["i64"],
					result: "bool",
					nonblocking: false,
				},
				free_sql_result: {
					parameters: ["pointer"],
					result: "void",
					nonblocking: false,
				},
				verify_database_encryption: {
					parameters: ["buffer"],
					result: "bool",
					nonblocking: false,
				},
			});
			console.log("EDB library loaded successfully");
		} catch (error: unknown) {
			console.error(`Failed to load EDB library: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	// Get a singleton instance
	public static getInstance(): RustDatabaseAdapter {
		if (!RustDatabaseAdapter.instance) {
			RustDatabaseAdapter.instance = new RustDatabaseAdapter();
		}
		return RustDatabaseAdapter.instance;
	}

	// Open an encrypted database connection
	public async openDatabase(path: string, key: string): Promise<number> {
		const pathBuffer = this.stringToBuffer(path);
		const keyBuffer = this.stringToBuffer(key);

		const connId = this.lib.symbols.open_encrypted_database(
			pathBuffer,
			keyBuffer,
		);

		if (connId === -1n) {
			throw new Error("Failed to open encrypted database");
		}

		return Number(connId);
	}

	// Execute SQL query asynchronously
	public async executeSQL(connId: number, sql: string): Promise<SQLResult> {
		return new Promise((resolve, reject) => {
			try {
				const sqlBuffer = this.stringToBuffer(sql);

				// Create callback function
				const callback = new Deno.UnsafeCallback(
					{ parameters: ["pointer"], result: "void" },
					(resultPtr: Deno.PointerValue) => {
						try {
							const result = this.parseSQLResult(resultPtr);
							resolve(result);
						} catch (error: unknown) {
							reject(
								new Error(
									`Failed to parse SQL result: ${error instanceof Error ? error.message : String(error)}`,
								),
							);
						}
					},
				);

				// Execute the async SQL call
				const callbackId = this.lib.symbols.execute_sql_async(
					BigInt(connId),
					sqlBuffer,
					callback.pointer,
				);

				// Store callback reference to prevent GC
				const callbackIdNum = Number(callbackId);
				this.pendingCallbacks.set(
					callbackIdNum,
					(result: SQLResult) => {
						this.pendingCallbacks.delete(callbackIdNum);
						callback.close();
						resolve(result);
					},
				);

				// Set timeout for cleanup (30 seconds)
				setTimeout(() => {
					if (this.pendingCallbacks.has(callbackIdNum)) {
						this.pendingCallbacks.delete(callbackIdNum);
						callback.close();
						reject(new Error("SQL execution timeout"));
					}
				}, 30000);
			} catch (error: unknown) {
				reject(new Error(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`));
			}
		});
	}

	// Parse SQL result from C struct
	private parseSQLResult(resultPtr: Deno.PointerValue): SQLResult {
		if (resultPtr === null || resultPtr === undefined) {
			return { success: false, error: "Invalid SQL result pointer" };
		}
		const view = new Deno.UnsafePointerView(resultPtr);

		// Read the SQLResult struct fields
		const jsonDataPtr = view.getPointer(0);
		const errorMessagePtr = view.getPointer(8);
		const success = view.getUint8(16) === 1;
		const rowsAffected = view.getBigInt64(24);

		let result: SQLResult = { success };

		if (success && jsonDataPtr !== null) {
			try {
				const jsonView = new Deno.UnsafePointerView(jsonDataPtr);
				const jsonString = jsonView.getCString();
				const jsonData = JSON.parse(jsonString);

				if (jsonData.rows) {
					// SELECT query result
					result.rows = jsonData.rows;
					result.count = jsonData.count;
				} else {
					// INSERT/UPDATE/DELETE result
					result.rows_affected = jsonData.rows_affected;
					result.last_insert_rowid = jsonData.last_insert_rowid;
				}
			} catch (error: unknown) {
				result.success = false;
				result.error = `Failed to parse JSON result: ${error instanceof Error ? error.message : String(error)}`;
			}
		}

		if (!success && errorMessagePtr !== null) {
			const errorView = new Deno.UnsafePointerView(errorMessagePtr);
			result.error = errorView.getCString();
		}

		result.rows_affected = Number(rowsAffected);

		// Free the result memory
		this.lib.symbols.free_sql_result(resultPtr);

		return result;
	}

	// Close a database connection
	public closeDatabase(connId: number): boolean {
		const result = this.lib.symbols.close_database_connection(
			BigInt(connId),
		);
		return result;
	}

	// Verify that a database file is encrypted
	public verifyEncryption(path: string): boolean {
		const pathBuffer = this.stringToBuffer(path);
		return this.lib.symbols.verify_database_encryption(pathBuffer);
	}

	// Close the FFI library
	public close(): void {
		this.lib.close();
	}

	// Helper: Convert string to null-terminated buffer for C FFI
	private stringToBuffer(str: string): Uint8Array {
		const encoded = this.encoder.encode(str);
		const buffer = new Uint8Array(encoded.length + 1);
		buffer.set(encoded);
		buffer[encoded.length] = 0; // null terminator
		return buffer;
	}
}

// Export the singleton instance
export const asyncEDB = RustDatabaseAdapter.getInstance();
