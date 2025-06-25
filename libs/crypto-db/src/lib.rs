use rusqlite::Connection;
use serde_json::{json, Value};
use base64::Engine;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use std::sync::Mutex;
use once_cell::sync::Lazy;

#[repr(C)]
#[derive(Clone)]
pub struct SQLResult {
    json_data: *mut c_char,
    error_message: *mut c_char,
    success: bool,
    rows_affected: i64,
}

// Make SQLResult Send + Sync
unsafe impl Send for SQLResult {}
unsafe impl Sync for SQLResult {}

// Global connection pool to manage database connections
static CONNECTION_POOL: Lazy<Mutex<HashMap<i64, Connection>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

// Global callback registry for async operations
static CALLBACK_REGISTRY: Lazy<Mutex<HashMap<i64, extern "C" fn(*const SQLResult)>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

static NEXT_CALLBACK_ID: Lazy<Mutex<i64>> = Lazy::new(|| Mutex::new(1));

// Open an encrypted database connection
#[no_mangle]
pub extern "C" fn open_encrypted_database(
    db_path: *const c_char,
    password: *const c_char,
) -> i64 {
    let db_path_str = unsafe { CStr::from_ptr(db_path).to_str().unwrap_or("") };
    let password_str = unsafe { CStr::from_ptr(password).to_str().unwrap_or("") };
    
    match Connection::open(db_path_str) {
        Ok(conn) => {
            // Set up SQLCipher encryption
            if let Err(e) = conn.pragma_update(None, "key", password_str) {
                eprintln!("Failed to set encryption key: {}", e);
                return -1;
            }
            
            if let Err(e) = conn.pragma_update(None, "cipher_compatibility", &"4") {
                eprintln!("Failed to set cipher compatibility: {}", e);
                return -1;
            }
            
            // Test that the database is accessible
            if let Err(e) = conn.execute("CREATE TABLE IF NOT EXISTS _test (id INTEGER)", []) {
                eprintln!("Failed to test database access: {}", e);
                return -1;
            }
            
            let conn_id = {
                let mut pool = CONNECTION_POOL.lock().unwrap();
                let id = pool.len() as i64 + 1;
                pool.insert(id, conn);
                id
            };
            conn_id
        }
        Err(e) => {
            eprintln!("Failed to open database: {}", e);
            -1
        }
    }
}

// Async SQL execution with callback
#[no_mangle]
pub extern "C" fn execute_sql_async(
    conn_id: i64,
    sql_query: *const c_char,
    callback: extern "C" fn(*const SQLResult),
) -> i64 {
    let sql_str = unsafe {
        CStr::from_ptr(sql_query).to_str().unwrap_or("").to_string()
    };
    
    // Generate unique callback ID
    let callback_id = {
        let mut next_id = NEXT_CALLBACK_ID.lock().unwrap();
        let id = *next_id;
        *next_id += 1;
        id
    };
    
    // Store callback
    {
        let mut registry = CALLBACK_REGISTRY.lock().unwrap();
        registry.insert(callback_id, callback);
    }
    
    // Spawn async task
    std::thread::spawn(move || {
        let result = execute_sql_internal(conn_id, sql_str);
        
        // Get and remove callback
        let callback = {
            let mut registry = CALLBACK_REGISTRY.lock().unwrap();
            registry.remove(&callback_id)
        };
        
        if let Some(cb) = callback {
            cb(&result);
        }
    });
    
    callback_id
}

// Internal SQL execution logic
fn execute_sql_internal(conn_id: i64, sql: String) -> SQLResult {
    let mut pool = CONNECTION_POOL.lock().unwrap();
    let conn = match pool.get_mut(&conn_id) {
        Some(c) => c,
        None => {
            return SQLResult {
                json_data: std::ptr::null_mut(),
                error_message: CString::new("Invalid connection ID").unwrap().into_raw(),
                success: false,
                rows_affected: 0,
            };
        }
    };
    
    // Determine if it's a SELECT query or modification query
    let trimmed_sql = sql.trim().to_lowercase();
    let is_select = trimmed_sql.starts_with("select") || 
                   trimmed_sql.starts_with("with") ||
                   trimmed_sql.starts_with("pragma");
    
    if is_select {
        // Execute SELECT query
        match conn.prepare(&sql) {
            Ok(mut stmt) => {
                let column_count = stmt.column_count();
                let column_names: Vec<String> = (0..column_count)
                    .map(|i| stmt.column_name(i).unwrap_or("unknown").to_string())
                    .collect();
                let mut json_rows = Vec::new();
                
                match stmt.query_map([], |row| {
                    let mut obj = serde_json::Map::new();
                    
                    for (i, column_name) in column_names.iter().enumerate() {
                        let value = if let Ok(s) = row.get::<_, String>(i) {
                            Value::String(s)
                        } else if let Ok(n) = row.get::<_, i64>(i) {
                            Value::Number(n.into())
                        } else if let Ok(f) = row.get::<_, f64>(i) {
                            Value::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
                        } else if let Ok(blob) = row.get::<_, Vec<u8>>(i) {
                            let engine = base64::engine::general_purpose::STANDARD;
                            Value::String(engine.encode(blob))
                        } else {
                            Value::Null
                        };
                        obj.insert(column_name.clone(), value);
                    }
                    Ok(Value::Object(obj))
                }) {
                    Ok(rows_iter) => {
                        for row_result in rows_iter {
                            match row_result {
                                Ok(row) => json_rows.push(row),
                                Err(e) => {
                                    return SQLResult {
                                        json_data: std::ptr::null_mut(),
                                        error_message: CString::new(format!("Row error: {}", e)).unwrap().into_raw(),
                                        success: false,
                                        rows_affected: 0,
                                    };
                                }
                            }
                        }
                        
                        let result_json = json!({
                            "rows": json_rows,
                            "count": json_rows.len()
                        });
                        
                        SQLResult {
                            json_data: CString::new(result_json.to_string()).unwrap().into_raw(),
                            error_message: std::ptr::null_mut(),
                            success: true,
                            rows_affected: json_rows.len() as i64,
                        }
                    }
                    Err(e) => {
                        SQLResult {
                            json_data: std::ptr::null_mut(),
                            error_message: CString::new(format!("Query error: {}", e)).unwrap().into_raw(),
                            success: false,
                            rows_affected: 0,
                        }
                    }
                }
            }
            Err(e) => {
                SQLResult {
                    json_data: std::ptr::null_mut(),
                    error_message: CString::new(format!("Query prepare error: {}", e)).unwrap().into_raw(),
                    success: false,
                    rows_affected: 0,
                }
            }
        }
    } else {
        // Execute modification query (INSERT, UPDATE, DELETE)
        match conn.execute(&sql, []) {
            Ok(rows_affected) => {
                let last_insert_rowid = conn.last_insert_rowid();
                
                let result_json = json!({
                    "rows_affected": rows_affected,
                    "last_insert_rowid": last_insert_rowid
                });
                
                SQLResult {
                    json_data: CString::new(result_json.to_string()).unwrap().into_raw(),
                    error_message: std::ptr::null_mut(),
                    success: true,
                    rows_affected: rows_affected as i64,
                }
            }
            Err(e) => {
                SQLResult {
                    json_data: std::ptr::null_mut(),
                    error_message: CString::new(format!("Execution error: {}", e)).unwrap().into_raw(),
                    success: false,
                    rows_affected: 0,
                }
            }
        }
    }
}

// Free SQL result memory
#[no_mangle]
pub extern "C" fn free_sql_result(result: *mut SQLResult) {
    if result.is_null() {
        return;
    }
    
    unsafe {
        let result_ref = &*result;
        
        if !result_ref.json_data.is_null() {
            let _ = CString::from_raw(result_ref.json_data);
        }
        
        if !result_ref.error_message.is_null() {
            let _ = CString::from_raw(result_ref.error_message);
        }
    }
}

// Close database connection
#[no_mangle]
pub extern "C" fn close_database_connection(conn_id: i64) -> bool {
    let mut pool = CONNECTION_POOL.lock().unwrap();
    pool.remove(&conn_id).is_some()
}

// Verify database encryption by attempting to open without password
#[no_mangle]
pub extern "C" fn verify_database_encryption(
    db_path: *const c_char,
) -> bool {
    let db_path_str = unsafe { CStr::from_ptr(db_path).to_str().unwrap_or("") };
    
    // Try to open the database without a password and read from it
    match Connection::open(db_path_str) {
        Ok(conn) => {
            // Try to read from the database - this should fail if encrypted
            match conn.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1") {
                Ok(mut stmt) => {
                    // If we can prepare and execute a statement, database is not encrypted
                    match stmt.query_map([], |_| Ok(())) {
                        Ok(_) => false, // Database is NOT encrypted
                        Err(_) => true, // Database is encrypted (query failed)
                    }
                }
                Err(_) => true, // Database is encrypted (prepare failed)
            }
        }
        Err(_) => true, // Database is encrypted (couldn't open)
    }
}
