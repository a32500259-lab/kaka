(() => {
  if (window.__giftNoteSiteBridgeInstalled) return;
  window.__giftNoteSiteBridgeInstalled = true;
  const KEY = 'giftNoteThreadReferences';
  const origin = location.origin;

  function publish(type, requestId = '') {
    chrome.storage.local.get(KEY).then(result => {
      const items = Array.isArray(result[KEY]) ? result[KEY] : [];
      window.postMessage({ source: 'gift-note-extension', type, requestId, items }, origin);
    }).catch(() => {
      window.postMessage({ source: 'gift-note-extension', type: 'references-error', items: [] }, origin);
    });
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || event.origin !== origin || data?.source !== 'gift-note-site' || data.type !== 'get-references') return;
    publish('references', typeof data.requestId === 'string' ? data.requestId : '');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) publish('references-updated');
  });

  window.dispatchEvent(new Event('gift-note-extension-ready'));
})();
