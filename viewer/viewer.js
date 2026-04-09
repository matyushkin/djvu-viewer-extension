import init, { WasmDocument } from './pkg/djvu_viewer_wasm.js';

let doc = null;
let currentPage = 0;
let currentDpi = 150;
let renderPending = false;

const canvas  = document.getElementById('canvas');
const status  = document.getElementById('status');
const errDiv  = document.getElementById('error');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const dpiRange = document.getElementById('dpi-range');
const dpiVal  = document.getElementById('dpi-val');
const filename = document.getElementById('filename');

async function main() {
  await init();

  // URL to fetch is passed as ?url=<original-url>.
  // regexSubstitution inserts the raw URL (not percent-encoded), so a second
  // '?' in the value would confuse URLSearchParams.  Parse manually instead.
  const search = location.search.slice(1); // strip leading '?'
  const djvuUrl = search.startsWith('url=') ? search.slice(4) : null;
  if (!djvuUrl) {
    showError('No DjVu URL specified.');
    return;
  }

  filename.textContent = djvuUrl.split('/').pop();
  status.textContent = 'Fetching…';

  let bytes;
  try {
    const resp = await fetch(djvuUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    bytes = new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    showError(`Failed to fetch: ${e.message}`);
    return;
  }

  status.textContent = 'Parsing…';
  try {
    doc = WasmDocument.from_bytes(bytes);
  } catch (e) {
    showError(`Parse error: ${e.message}`);
    return;
  }

  updateControls();
  await renderPage();
}

async function renderPage() {
  if (!doc) return;

  // Snapshot mutable state so rapid slider/key events can't cause a DPI
  // mismatch between width_at/height_at and render() calls.
  const page = doc.page(currentPage);
  const dpi  = currentDpi;

  // Debounce: if another render is already scheduled, skip this one — the
  // final render (after the user stops dragging) will pick up the latest DPI.
  if (renderPending) return;
  renderPending = true;

  const w = page.width_at(dpi);
  const h = page.height_at(dpi);
  status.textContent = `Rendering page ${currentPage + 1} at ${dpi} dpi…`;
  await new Promise(r => setTimeout(r, 0));
  renderPending = false;

  const t0 = performance.now();
  try {
    const pixels = page.render(dpi);
    const ms = (performance.now() - t0).toFixed(1);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
    status.textContent = `${w}×${h} px — ${ms} ms`;
  } catch (e) {
    showError(`Render error: ${e.message}`);
  }
}

function updateControls() {
  const count = doc ? doc.page_count() : 0;
  pageInfo.textContent = `${currentPage + 1} / ${count}`;
  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = currentPage >= count - 1;
}

function showError(msg) {
  errDiv.textContent = msg;
  status.textContent = 'Error';
}

prevBtn.addEventListener('click', () => { currentPage--; updateControls(); renderPage(); });
nextBtn.addEventListener('click', () => { currentPage++; updateControls(); renderPage(); });

dpiRange.addEventListener('input', e => {
  currentDpi = Number(e.target.value);
  dpiVal.textContent = currentDpi;
  renderPage();
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  && !prevBtn.disabled) { currentPage--; updateControls(); renderPage(); }
  if (e.key === 'ArrowRight' && !nextBtn.disabled) { currentPage++; updateControls(); renderPage(); }
  if ((e.key === '+' || e.key === '=') && currentDpi < 600) {
    currentDpi = Math.min(600, currentDpi + 24); dpiRange.value = currentDpi;
    dpiVal.textContent = currentDpi; renderPage();
  }
  if (e.key === '-' && currentDpi > 36) {
    currentDpi = Math.max(36, currentDpi - 24); dpiRange.value = currentDpi;
    dpiVal.textContent = currentDpi; renderPage();
  }
});

main();
