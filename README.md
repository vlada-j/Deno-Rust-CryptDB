# Deno Rust CryptDB

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An encrypted database (SqlCipher) built in Rust and integrated with the Deno CLI application, demonstrating seamless interoperability through Foreign Function Interface (FFI).

## Overview

This project showcases how to combine Deno's modern JavaScript runtime with Rust's performance and safety features, creating a secure and efficient application with encrypted database capabilities.
Created with the help of [Windsurf](https://windsurf.com/), a specialized AI assistant (agent).

## **CLI Interface**
Interactive command-line interface with multiple commands:
- `fibonacci <n>` - Calculate the nth Fibonacci number
- `sleep <ms>` - Demonstrate asynchronous FFI operations
- `test` - Run encrypted database functionality tests
- `help` - Display available commands and usage
- `version` - Show application version information


### Installation

1. **Build Rust libraries**
   ```bash
   # Build the Fibonacci library
   cd libs/fibonacci
   cargo build --release
   
   # Build the encrypted database library
   cd ../crypto-db
   cargo build --release
   cd ../..
   ```

2. **Run the application**
   ```bash
   deno run --allow-ffi --allow-read --allow-write src/main.ts
   ```

### Usage Examples

```bash
# Demonstrate async FFI with calculating Fibonacci number
deno run --allow-ffi src/main.ts fibonacci 10

# Test database functionality
deno run --allow-ffi --allow-read --allow-write src/main.ts test

# Demonstrate use of async callback from Rust
deno run --allow-ffi src/main.ts sleep 15
```


## Resources
- [Windsurf](https://windsurf.com/)
- [Create your encrypted database with SQLCipher and sqlx in Rust (for Windows)](https://medium.com/@lemalcs/create-your-encrypted-database-with-sqlcipher-and-sqlx-in-rust-for-windows-4d25a7e9f5b4)
- [Deno FFI Documentation](https://docs.deno.com/runtime/fundamentals/ffi/)
