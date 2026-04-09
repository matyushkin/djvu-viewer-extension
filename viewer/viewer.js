import init, { WasmDocument } from '../pkg/djvu_rs.js';

let doc = null;
let currentPage = 0;
let currentDpi = 150;

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

  // URL to fetch is passed as ?url=<encoded> query param.
  const params = new URLSearchParams(location.search);
  const djvuUrl = params.get('url');
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
  const page = doc.page(currentPage);
  const w = page.width_at(currentDpi);
  const h = page.height_at(currentDpi);
  status.textContent = `Rendering page ${currentPage + 1} at ${currentDpi} dpi…`;
  await new Promise(r => setTimeout(r, 0));

  const t0 = performance.now();
  const pixels = page.render(currentDpi);
  const ms = (performance.now() - t0).toFixed(1);

  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0);
  status.textContent = `${w}×${h} px — ${ms} ms`;
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
