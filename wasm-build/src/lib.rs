//! WebAssembly bindings for the DjVu Viewer Chrome extension.
//!
//! Exposes [`WasmDocument`] and [`WasmPage`] to JavaScript via wasm-bindgen,
//! delegating all DjVu decoding and rendering to the `djvu-rs` crate.
//!
//! ## JavaScript API
//!
//! ```js
//! import init, { WasmDocument } from './pkg/djvu_viewer_wasm.js';
//! await init();
//! const doc = WasmDocument.from_bytes(new Uint8Array(buffer));
//! const page = doc.page(0);
//! const pixels = page.render(150);   // Uint8ClampedArray, RGBA
//! const img = new ImageData(pixels, page.width_at(150), page.height_at(150));
//! ctx.putImageData(img, 0, 0);
//! ```

use std::sync::Arc;

use djvu_rs::{
    DjVuDocument,
    djvu_render::{RenderOptions, Resampling, UserRotation, render_pixmap},
};
use wasm_bindgen::prelude::*;

// ── WasmDocument ─────────────────────────────────────────────────────────────

/// A parsed DjVu document.
///
/// Created from raw bytes via [`WasmDocument::from_bytes`].
#[wasm_bindgen]
pub struct WasmDocument {
    inner: Arc<DjVuDocument>,
}

#[wasm_bindgen]
impl WasmDocument {
    /// Parse a DjVu document from a byte slice.
    ///
    /// Throws a JavaScript `Error` if the bytes are not a valid DjVu file.
    pub fn from_bytes(data: &[u8]) -> Result<WasmDocument, JsError> {
        let doc = DjVuDocument::parse(data).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmDocument {
            inner: Arc::new(doc),
        })
    }

    /// Total number of pages in the document.
    pub fn page_count(&self) -> u32 {
        self.inner.page_count() as u32
    }

    /// Return a handle to page `index` (0-based).
    ///
    /// Throws if `index >= page_count()`.
    pub fn page(&self, index: u32) -> Result<WasmPage, JsError> {
        let count = self.inner.page_count();
        if index as usize >= count {
            return Err(JsError::new(&format!(
                "page index {index} out of range (document has {count} pages)"
            )));
        }
        Ok(WasmPage {
            doc: Arc::clone(&self.inner),
            index: index as usize,
        })
    }
}

// ── WasmPage ─────────────────────────────────────────────────────────────────

/// A single page within a [`WasmDocument`].
#[wasm_bindgen]
pub struct WasmPage {
    doc: Arc<DjVuDocument>,
    index: usize,
}

#[wasm_bindgen]
impl WasmPage {
    /// Native DPI stored in the INFO chunk.
    pub fn dpi(&self) -> u32 {
        self.doc
            .page(self.index)
            .map(|p| p.dpi() as u32)
            .unwrap_or(300)
    }

    /// Output width in pixels when rendered at `target_dpi`.
    pub fn width_at(&self, target_dpi: u32) -> u32 {
        self.doc
            .page(self.index)
            .map(|p| {
                let scale = target_dpi as f32 / p.dpi() as f32;
                ((p.width() as f32 * scale).round() as u32).max(1)
            })
            .unwrap_or(1)
    }

    /// Output height in pixels when rendered at `target_dpi`.
    pub fn height_at(&self, target_dpi: u32) -> u32 {
        self.doc
            .page(self.index)
            .map(|p| {
                let scale = target_dpi as f32 / p.dpi() as f32;
                ((p.height() as f32 * scale).round() as u32).max(1)
            })
            .unwrap_or(1)
    }

    /// Render the page at `target_dpi` and return raw RGBA pixels
    /// (`Uint8ClampedArray`, suitable for `new ImageData(pixels, w, h)`).
    ///
    /// Throws on decode error.
    pub fn render(&self, target_dpi: u32) -> Result<js_sys::Uint8ClampedArray, JsError> {
        let page = self
            .doc
            .page(self.index)
            .map_err(|e| JsError::new(&e.to_string()))?;

        let scale = target_dpi as f32 / page.dpi() as f32;
        let w = ((page.width() as f32 * scale).round() as u32).max(1);
        let h = ((page.height() as f32 * scale).round() as u32).max(1);

        let opts = RenderOptions {
            width: w,
            height: h,
            scale,
            bold: 0,
            // aa: true applies a 2×2 box-filter downscale after rendering,
            // halving both dimensions.  width_at/height_at return the full
            // target size, so the ImageData constructor would get a size
            // mismatch.  Keep aa:false; the viewer can add CSS smoothing.
            aa: false,
            rotation: UserRotation::None,
            permissive: true,
            resampling: Resampling::Bilinear,
        };

        let pm = render_pixmap(page, &opts).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(js_sys::Uint8ClampedArray::from(pm.data.as_slice()))
    }
}
