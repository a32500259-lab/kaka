(() => {
  if (window.__giftNoteSiteBridgeInstalled) return;
  window.__giftNoteSiteBridgeInstalled = true;
  const KEY = 'giftNoteThreadReferences';
  const origin = location.origin;

  function postError(requestId = '') {
    try {
      window.postMessage({
        source: 'gift-note-extension',
        type: 'references-error',
        requestId,
        reason: 'extension-context-unavailable',
        items: []
      }, origin);
    } catch {}
  }

  function storageGet() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        throw new Error('Extension context unavailable');
      }
      return chrome.storage.local.get(KEY);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function storageSet(value) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        throw new Error('Extension context unavailable');
      }
      return chrome.storage.local.set(value);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function publish(type, requestId = '') {
    storageGet().then(result => {
      const items = Array.isArray(result[KEY]) ? result[KEY] : [];
      window.postMessage({ source: 'gift-note-extension', type, requestId, items }, origin);
    }).catch(() => postError(requestId));
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
    storageGet().then(async result => {
      const items = Array.isArray(result[KEY]) ? result[KEY] : [];
      const filtered = items.filter(item => item?.id !== data.id);
      if (filtered.length === items.length) {
        window.postMessage({ source: 'gift-note-extension', type: 'delete-result', requestId, deleted: false, items }, origin);
        return;
      }
      await storageSet({ [KEY]: filtered });
      window.postMessage({ source: 'gift-note-extension', type: 'delete-result', requestId, deleted: true, items: filtered }, origin);
    }).catch(() => postError(requestId));
  });

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[KEY]) publish('references-updated');
      });
    }
  } catch {}

  window.dispatchEvent(new Event('gift-note-extension-ready'));
})();
