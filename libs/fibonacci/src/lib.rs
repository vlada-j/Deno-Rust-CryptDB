pub fn fibonacci_recursive(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2),
    }
}

static mut CALLBACK: Option<extern "C" fn(*const i8)> = None;

#[repr(C)]
pub struct FfiResult {
    success: bool,
    value: u64,
    error_code: i32,
}

#[no_mangle]
pub extern "C" fn fibonacci(n: u32, _result: *mut FfiResult) {
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
            callback(format!("Rust has now woken up.\0").as_ptr() as *const i8);
        }
    }
}

#[no_mangle]
pub extern "C" fn set_callback(callback: extern "C" fn(*const i8)) {
    unsafe {
        CALLBACK = Some(callback);
    }
}

