# DjVu Viewer — Chrome Extension

Chrome extension that opens `.djvu` files in-browser, powered by [djvu-rs](https://github.com/matyushkin/djvu-rs) compiled to WebAssembly.

No plugins. No servers. Fully offline.

## Features

- Intercepts navigation to `.djvu` URLs (http, https)
- Page navigation (←/→ keys or toolbar buttons)
- DPI/zoom slider (36–600 dpi, +/- keys)
- Instant re-render on zoom change

## Requirements

- [Rust toolchain](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) ≥ 0.13

```sh
rustup target add wasm32-unknown-unknown
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Building WASM

The viewer depends on `viewer/pkg/` which is built from the self-contained
wrapper in `wasm-build/`. It pulls `djvu-rs` from crates.io — no local
checkout of djvu-rs is needed.

Run from the repo root:

```sh
wasm-pack build --target web --out-dir "$PWD/viewer/pkg" wasm-build/
```

> `--out-dir` must be absolute (or use `$PWD/...`) because wasm-pack resolves
> relative paths against the crate directory, not the shell working directory.

## Loading in Chrome

1. Build WASM (see above)
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select this directory

## Packaging for Chrome Web Store

```sh
wasm-pack build --target web --out-dir "$PWD/viewer/pkg" wasm-build/
zip -r djvu-viewer.zip manifest.json background/ viewer/ rules/ icons/ \
  --exclude "viewer/pkg/package.json"
```

## Project structure

```
manifest.json          — MV3 manifest (wasm-unsafe-eval CSP)
background/
  service_worker.js    — extension lifecycle
rules/
  redirect_djvu.json   — declarativeNetRequest: intercept *.djvu → viewer
viewer/
  viewer.html          — canvas-based viewer UI
  viewer.js            — WASM integration and page controls
  pkg/                 — built WASM output (gitignored, build locally)
wasm-build/
  Cargo.toml           — cdylib wrapper that pulls djvu-rs from crates.io
  src/lib.rs
```

## Related

- [djvu-rs](https://github.com/matyushkin/djvu-rs) — the Rust DjVu decoder
- [djvu-rs on crates.io](https://crates.io/crates/djvu-rs)
- Issue [#119](https://github.com/matyushkin/djvu-rs/issues/119) — this extension
