# DjVu Viewer — Chrome Extension

Chrome extension that opens `.djvu` files in-browser, powered by [djvu-rs](https://github.com/matyushkin/djvu-rs) compiled to WebAssembly.

No plugins. No servers. Fully offline.

## Features

- Intercepts navigation to `.djvu` URLs (http, https, file://)
- Page navigation (←/→ keys or toolbar buttons)
- DPI/zoom slider (36–600 dpi, +/- keys)
- Instant re-render on zoom change

## Build

```sh
# 1. Build the djvu-rs WASM package
cd ../djvu-rs
wasm-pack build --target web --out-dir ../djvu-viewer-extension/pkg --features wasm

# 2. Load in Chrome
# Open chrome://extensions/ → "Load unpacked" → select this directory
```

## Release build (for Web Store)

```sh
cd ../djvu-rs
wasm-pack build --release --target web --out-dir ../djvu-viewer-extension/pkg --features wasm
cd ../djvu-viewer-extension
zip -r djvu-viewer.zip . --exclude "*.git*" --exclude "node_modules/*"
```

## Related

- [djvu-rs](https://github.com/matyushkin/djvu-rs) — the Rust DjVu decoder
- Issue [#73](https://github.com/matyushkin/djvu-rs/issues/73) — WASM bindings
- Issue [#119](https://github.com/matyushkin/djvu-rs/issues/119) — this extension
