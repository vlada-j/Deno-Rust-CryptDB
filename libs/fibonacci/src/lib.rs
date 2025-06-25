pub fn fibonacci_recursive(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2),
    }
}

pub fn wait() {
    std::thread::sleep(std::time::Duration::from_millis(1000));
}

static mut CALLBACK: Option<extern "C" fn(*const i8)> = None;

#[no_mangle]
pub extern "C" fn fibonacci(n: u32, result: *mut FfiResult) {
    if n > 0 {
        unsafe {
            if let Some(callback) = CALLBACK {
                let res = fibonacci_recursive(n);
                let msg = format!("Fibonacci({}) = {} \0", n, res);
                callback(msg.as_ptr() as *const i8);
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn sleep(n: u64) {
    std::thread::sleep(std::time::Duration::from_secs(n as u64));
    unsafe {
        if let Some(callback) = CALLBACK {
            callback(format!("Woke up after sleeping for {} seconds\0", n).as_ptr() as *const i8);
        }
    }
}

#[no_mangle]
pub extern "C" fn set_callback(callback: extern "C" fn(*const i8)) {
    unsafe {
        CALLBACK = Some(callback);
    }
}

use std::ffi::{CStr, CString};

fn str_to_i8(s: &str) -> *const i8 {
    let c_string = CString::new(s).expect("Failed to create CString");
    let ptr = c_string.into_raw();
    ptr as *const i8
}

fn i8_to_str(ptr: *const i8) -> String {
    unsafe {
        CStr::from_ptr(ptr)
            .to_str()
            .expect("The string could not be converted")
            .to_string()
    }
}
