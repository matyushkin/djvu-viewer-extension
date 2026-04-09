// Service worker for DjVu Viewer extension.
// Handles navigation interception for .djvu URLs via dynamic rules.

chrome.runtime.onInstalled.addListener(() => {
  console.log('DjVu Viewer installed.');
});

// Intercept fetch requests for .djvu files from the viewer page.
// The viewer fetches the original URL and passes the bytes to WASM.
