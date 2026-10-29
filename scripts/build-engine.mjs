/*
 * Rebuilds engine/dfmsph22.wasm from the DFMSPH22 C sources.
 * Only needed after editing the C code — the compiled .wasm is committed, so deployments
 * (Vercel, Render, Docker) never need a C compiler.
 *
 * Requires zig (https://ziglang.org) on PATH, or:  pip install ziglang  (then ZIG="python -m ziglang")
 *   npm run build:engine
 */
import { execSync } from 'child_process';
import fs from 'fs';

const zig = process.env.ZIG || 'zig';
fs.mkdirSync('engine', { recursive: true });
execSync(`${zig} cc -target wasm32-wasi -O2 -s -std=c99 dfmsph22.c -lm -o engine/dfmsph22.wasm`, { stdio: 'inherit' });
console.log(`engine/dfmsph22.wasm: ${fs.statSync('engine/dfmsph22.wasm').size} bytes`);
