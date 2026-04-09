import init, { WasmDocument } from './pkg/djvu_viewer_wasm.js';

let doc = null;
let currentPage = 0;
let currentDpi = 150;
let renderPending = false;

const canvas         = document.getElementById('canvas');
const canvasWrap     = document.getElementById('canvas-wrap');
const pageContainer  = document.getElementById('page-container');
const textLayer      = document.getElementById('text-layer');
const dropZone   = document.getElementById('drop-zone');
const status     = document.getElementById('status');
const errDiv     = document.getElementById('error');
const pageInfo   = document.getElementById('page-info');
const prevBtn    = document.getElementById('prev-btn');
const nextBtn    = document.getElementById('next-btn');
const dpiRange   = document.getElementById('dpi-range');
const dpiVal     = document.getElementById('dpi-val');
const filenameEl = document.getElementById('filename');
const openBtn    = document.getElementById('open-btn');
const fileInput  = document.getElementById('file-input');
const fitWBtn    = document.getElementById('fit-w-btn');
const fitPBtn    = document.getElementById('fit-p-btn');

// ── Initialise WASM ───────────────────────────────────────────────────────────

async function main() {
  await init();

  const search = location.search.slice(1);
  const djvuUrl = search.startsWith('url=') ? search.slice(4) : null;

  if (!djvuUrl) {
    // No URL → stay on drop-zone, nothing more to do until user picks a file.
    status.textContent = 'Ready';
    return;
  }

  filenameEl.textContent = djvuUrl.split('/').pop();
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

  await parseAndRender(bytes);
}

// ── Load helpers ─────────────────────────────────────────────────────────────

async function parseAndRender(bytes) {
  if (doc) { doc.free(); doc = null; }
  status.textContent = 'Parsing…';
  errDiv.textContent = '';
  try {
    doc = WasmDocument.from_bytes(bytes);
  } catch (e) {
    showError(`Parse error: ${e.message}`);
    return;
  }

  // Show canvas, hide drop-zone.
  canvas.style.display = 'block';
  dropZone.style.display = 'none';

  currentPage = 0;
  updateControls();
  fitWidth();        // open at fit-to-width so first page is always visible
}

async function loadFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.djvu')) {
    showError('Not a .djvu file.');
    return;
  }
  filenameEl.textContent = file.name;
  status.textContent = 'Reading…';
  errDiv.textContent = '';
  const bytes = new Uint8Array(await file.arrayBuffer());
  await parseAndRender(bytes);
}

// ── Render ────────────────────────────────────────────────────────────────────

async function renderPage() {
  if (!doc) return;

  // Debounce: skip intermediate renders while a render is in flight.
  if (renderPending) return;
  renderPending = true;

  // Snapshot mutable state — rapid slider/key events must not cause a DPI
  // mismatch between width_at/height_at and render().
  const page = doc.page(currentPage);
  const dpi  = currentDpi;

  const w = page.width_at(dpi);
  const h = page.height_at(dpi);
  status.textContent = `Rendering page ${currentPage + 1} at ${dpi} dpi…`;
  await new Promise(r => setTimeout(r, 0));
  renderPending = false;

  const t0 = performance.now();
  try {
    const pixels = page.render(dpi);
    const ms = (performance.now() - t0).toFixed(1);
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
    pixels.free();
    status.textContent = `${w}×${h} px — ${ms} ms`;
    pageContainer.style.width  = w + 'px';
    pageContainer.style.height = h + 'px';
    renderTextLayer(page, w, h);
  } catch (e) {
    showError(`Render error: ${e.message}`);
  } finally {
    page.free();
  }
}

// ── Text layer ────────────────────────────────────────────────────────────────

function renderTextLayer(page, w, h) {
  textLayer.innerHTML = '';
  textLayer.style.width  = w + 'px';
  textLayer.style.height = h + 'px';

  let json;
  try { json = page.text_zones_json(currentDpi); } catch { return; }
  if (!json) return;

  const zones = JSON.parse(json);
  for (const z of zones) {
    if (!z.w || !z.h || !z.t) continue;
    const span = document.createElement('span');
    span.textContent = z.t;
    span.style.left     = z.x + 'px';
    span.style.top      = z.y + 'px';
    span.style.width    = z.w + 'px';
    span.style.height   = z.h + 'px';
    span.style.fontSize = z.h + 'px';
    textLayer.appendChild(span);
  }

  // Scale each span horizontally so it fills exactly the zone width
  for (const span of textLayer.children) {
    const nw = span.scrollWidth;
    if (nw > 0) span.style.transform = `scaleX(${parseInt(span.style.width) / nw})`;
  }
}

// ── Zoom helpers ─────────────────────────────────────────────────────────────

function setDpi(dpi) {
  currentDpi = Math.max(36, Math.min(600, Math.round(dpi)));
  dpiRange.value    = currentDpi;
  dpiVal.textContent = currentDpi;
}

function fitWidth() {
  if (!doc) return;
  const page      = doc.page(currentPage);
  const pageDpi   = page.dpi();
  const nativeW   = page.width_at(pageDpi);
  const available = canvasWrap.clientWidth - 32; // 16 px padding × 2
  page.free();
  setDpi(available * pageDpi / nativeW);
  renderPage();
}

function fitPage() {
  if (!doc) return;
  const page      = doc.page(currentPage);
  const pageDpi   = page.dpi();
  const nativeW   = page.width_at(pageDpi);
  const nativeH   = page.height_at(pageDpi);
  page.free();
  const availW    = canvasWrap.clientWidth  - 32;
  const availH    = canvasWrap.clientHeight - 32;
  setDpi(Math.min(availW * pageDpi / nativeW, availH * pageDpi / nativeH));
  renderPage();
}

// ── UI helpers ────────────────────────────────────────────────────────────────

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

// ── Event listeners ───────────────────────────────────────────────────────────

prevBtn.addEventListener('click', () => { currentPage--; updateControls(); renderPage(); });
nextBtn.addEventListener('click', () => { currentPage++; updateControls(); renderPage(); });

dpiRange.addEventListener('input', e => {
  currentDpi = Number(e.target.value);
  dpiVal.textContent = currentDpi;
  renderPage();
});

fitWBtn.addEventListener('click', fitWidth);
fitPBtn.addEventListener('click', fitPage);

openBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });

// Drag-and-drop
canvasWrap.addEventListener('dragenter', e => { e.preventDefault(); canvasWrap.classList.add('drag-over'); });
canvasWrap.addEventListener('dragover',  e => { e.preventDefault(); });
canvasWrap.addEventListener('dragleave', e => { if (!canvasWrap.contains(e.relatedTarget)) canvasWrap.classList.remove('drag-over'); });
canvasWrap.addEventListener('drop', e => {
  e.preventDefault();
  canvasWrap.classList.remove('drag-over');
  loadFile(e.dataTransfer.files[0]);
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  && !prevBtn.disabled) { currentPage--; updateControls(); renderPage(); }
  if (e.key === 'ArrowRight' && !nextBtn.disabled) { currentPage++; updateControls(); renderPage(); }
  if ((e.key === '+' || e.key === '=') && currentDpi < 600) {
    setDpi(currentDpi + 24); renderPage();
  }
  if (e.key === '-' && currentDpi > 36) {
    setDpi(currentDpi - 24); renderPage();
  }
  if (e.key === 'w' || e.key === 'W') fitWidth();
  if (e.key === 'f' || e.key === 'F') fitPage();
});

main();
