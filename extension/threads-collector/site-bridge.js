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
    if (event.source !== window || event.origin !== origin || data?.source !== 'gift-note-site') return;
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    if (data.type === 'get-references') {
      publish('references', requestId);
      return;
    }
    if (data.type !== 'delete-reference' || typeof data.id !== 'string' || data.id.length > 100) return;
    chrome.storage.local.get(KEY).then(async result => {
      const items = Array.isArray(result[KEY]) ? result[KEY] : [];
      const filtered = items.filter(item => item?.id !== data.id);
      if (filtered.length === items.length) {
        window.postMessage({ source: 'gift-note-extension', type: 'delete-result', requestId, deleted: false, items }, origin);
        return;
      }
      await chrome.storage.local.set({ [KEY]: filtered });
      window.postMessage({ source: 'gift-note-extension', type: 'delete-result', requestId, deleted: true, items: filtered }, origin);
    }).catch(() => {
      window.postMessage({ source: 'gift-note-extension', type: 'delete-result', requestId, deleted: false, items: [] }, origin);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) publish('references-updated');
  });

  window.dispatchEvent(new Event('gift-note-extension-ready'));
})();
