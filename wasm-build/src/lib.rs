// This crate exists solely to build the djvu-rs WASM bindings for the
// djvu-viewer Chrome extension.  All #[wasm_bindgen] exports (WasmDocument,
// WasmPage) are defined in djvu-rs with the "wasm" feature and are
// automatically included in the linked cdylib output by wasm-bindgen.
//
// Build command (run from the extension root):
//   wasm-pack build --target web --out-dir viewer/pkg wasm-build/
