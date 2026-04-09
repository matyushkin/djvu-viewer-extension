# djvu-viewer-extension

Chrome Manifest V3 extension that opens `.djvu` files natively in the browser, powered by [djvu-rs](https://github.com/matyushkin/djvu-rs) compiled to WebAssembly.

## Architecture

- `manifest.json` — MV3 manifest with `wasm-unsafe-eval` CSP
- `rules/redirect_djvu.json` — declarativeNetRequest: intercepts `*.djvu` navigations → viewer
- `background/service_worker.js` — registers dynamic rules
- `viewer/viewer.html` + `viewer/viewer.js` — canvas-based viewer

## WASM dependency

The viewer depends on `pkg/` built from djvu-rs with:

```sh
wasm-pack build --target web --out-dir viewer/pkg \
  /Users/leo/Code/djvu-rs --features wasm
```

`viewer/pkg/` is gitignored — must be built locally.

## Key rules

- Target: Chrome Manifest V3 only (no Firefox compat needed)
- No npm/bundler — plain ES modules loaded via `<script type="module">`
- `wasm-unsafe-eval` is required in CSP for WASM instantiation
- Keep viewer self-contained in `viewer/` (all assets relative)
- GitHub issue: https://github.com/matyushkin/djvu-rs/issues/119
