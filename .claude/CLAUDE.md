# djvu-viewer-extension

Chrome Manifest V3 extension that opens `.djvu` files natively in the browser, powered by [djvu-rs](https://github.com/matyushkin/djvu-rs) compiled to WebAssembly.

## Architecture

- `manifest.json` — MV3 manifest with `wasm-unsafe-eval` CSP
- `rules/redirect_djvu.json` — declarativeNetRequest: intercepts `*.djvu` navigations → viewer
- `background/service_worker.js` — registers dynamic rules
- `viewer/viewer.html` + `viewer/viewer.js` — canvas-based viewer

## WASM dependency

The viewer depends on `viewer/pkg/` built via the self-contained wrapper crate
in `wasm-build/` (depends on `djvu-rs` from crates.io — no local checkout needed):

```sh
wasm-pack build --target web \
  --out-dir /absolute/path/to/djvu-viewer-extension/viewer/pkg \
  wasm-build/
```

Or using an absolute path shorthand from the repo root:

```sh
wasm-pack build --target web --out-dir "$PWD/viewer/pkg" wasm-build/
```

`viewer/pkg/` and `wasm-build/target/` are gitignored — must be built locally.

> **Note:** `--out-dir` must be absolute (or use `$PWD/...`).  
> wasm-pack resolves relative paths against the crate directory, not the shell CWD.

## Key rules

- Target: Chrome Manifest V3 only (no Firefox compat needed)
- No npm/bundler — plain ES modules loaded via `<script type="module">`
- `wasm-unsafe-eval` is required in CSP for WASM instantiation
- Keep viewer self-contained in `viewer/` (all assets relative)
- GitHub issue: https://github.com/matyushkin/djvu-rs/issues/119
