// Service worker for DjVu Viewer extension.
//
// Registers a dynamic declarativeNetRequest rule on install/update so that
// navigations to any http(s) URL ending in .djvu are redirected to the
// built-in viewer.
//
// Why dynamic (not static rules/redirect_djvu.json)?
//   Static rules cannot reference the extension's own chrome-extension://
//   URL at build time (the ID is only known at runtime).  Dynamic rules are
//   registered once on install and persist across browser sessions.

const RULE_ID = 1;

chrome.runtime.onInstalled.addListener(async () => {
  const viewerUrl = chrome.runtime.getURL('viewer/viewer.html');

  // Regex matches http(s) URLs whose path ends with .djvu, optionally followed
  // by a query string or fragment.  Case-insensitive via isUrlFilterCaseSensitive.
  //
  // \0 in regexSubstitution is the full matched URL; it is appended as the
  // raw ?url= value.  viewer.js reads location.search manually (not via
  // URLSearchParams) so a second '?' in the value is handled correctly.
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: viewerUrl + '?url=\\0',
          },
        },
        condition: {
          regexFilter: '^https?://[^?#]*\\.djvu([?#].*)?$',
          isUrlFilterCaseSensitive: false,
          resourceTypes: ['main_frame'],
        },
      },
    ],
  });

  console.log('[DjVu Viewer] redirect rule registered →', viewerUrl);
});
