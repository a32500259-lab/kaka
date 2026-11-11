(() => {
  if (document.querySelector('[data-gift-note-collector-manager]')) return;
  document.querySelectorAll('[data-gift-note-collector]').forEach(el => el.remove());
  const manager = document.createElement('span');
  manager.setAttribute('data-gift-note-collector-manager', '');
  manager.hidden = true;
  document.documentElement.append(manager);
  if (window.__giftNoteThreadsCollectorInstalled) return;
  window.__giftNoteThreadsCollectorInstalled = true;

  const INSTALLED = 'data-gift-note-collector';
  const hosts = new Map();
  let queued = false;

  function postUrl(anchor) {
    try {
      const url = new URL(anchor.href, location.href);
      if (!/threads\.com$/.test(url.hostname) || !/\/post\//.test(url.pathname)) return '';
      url.hostname = 'www.threads.com';
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname.replace(/\/+$/, '');
      return url.href;
    } catch { return ''; }
  }

  function postKey(url) {
    try {
      const path = new URL(url).pathname;
      const marker = path.indexOf('/post/');
      return marker < 0 ? url : `post:${path.slice(marker + 6).split('/')[0]}`;
    } catch { return url; }
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight &&
      rect.right > 0 && rect.left < innerWidth && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findCard(anchor) {
    let node = anchor;
    let fallback = anchor.parentElement;
    for (let depth = 0; depth < 10 && node.parentElement; depth++) {
      node = node.parentElement;
      const text = (node.innerText || '').trim();
      const rect = node.getBoundingClientRect();
      if (node.matches('article,[role="article"]')) return node;
      if (rect.width > 260 && rect.height > 80 && text.length >= 20 && text.length <= 3000) {
        fallback = node;
        const actions = node.querySelectorAll('button,[role="button"]');
        if (actions.length >= 2) return node;
      }
    }
    return fallback;
  }

  function readPost(card, url) {
    const text = (card.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 12 || text.length > 8000) return null;
    const controls = [...card.querySelectorAll('[aria-label],button,[role="button"]')]
      .map(button => `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.innerText || ''} ${button.textContent || ''}`.trim());
    const number = pattern => {
      for (const control of controls) {
        if (!pattern.test(control)) continue;
        const match = control.match(/[\d,.]+\s*(?:만|천|K|M)?/i);
        if (match) return match[0].replace(/\s/g, '');
      }
      return null;
    };
    return {
      text,
      author: (card.querySelector('a[href*="/@"]')?.innerText || '').trim().slice(0, 80),
      date: card.querySelector('time')?.getAttribute('datetime') || card.querySelector('time')?.innerText || '',
      views: number(/조회|view/i),
      likes: number(/좋아요|like|heart/i),
      url,
      source: 'visible-threads-page'
    };
  }

  function makeControl(card, url, key) {
    if (hosts.has(key)) return;
    for (const existing of document.querySelectorAll('[data-gift-note-post-key]')) {
      if (existing.getAttribute('data-gift-note-post-key') === key) return;
    }
    const host = document.createElement('div');
    host.setAttribute(INSTALLED, '');
    host.setAttribute('data-gift-note-post-key', key);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;z-index:2147483646;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .wrap{position:relative;display:flex;align-items:center;gap:6px}
      button{font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;border:0;box-shadow:0 2px 9px #173d312b}
      .icon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#168b73;border:1px solid #d5e8de}
      .icon:hover{background:#e6f7f0;transform:translateY(-1px)}
      .icon svg{width:17px;height:17px}
      .counts{padding:6px 8px;border:1px solid #dce8df;border-radius:999px;background:#fff;color:#315848;font-size:10px;white-space:nowrap;box-shadow:0 2px 9px #173d311c}
      .menu{display:none;align-items:center;gap:8px;padding:5px 7px 5px 10px;border:1px solid #dce8df;border-radius:999px;background:#fff;color:#35584b;white-space:nowrap}
      .wrap.open .menu{display:flex}
      .save{border-radius:999px;padding:8px 11px;background:#079b81;color:#fff}
      .save:disabled{background:#728b80;cursor:default}
      .close{font-size:14px;background:transparent;color:#74847b;padding:2px}
    </style><div class="wrap"><span class="counts" aria-live="polite">조회 — · ♥ —</span><button class="icon" aria-label="선물노트 수집 메뉴 열기" title="선물노트"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5h13v16l-6.5-4-6.5 4z"/><path d="M9 8h6m-6 3h4"/></svg></button><div class="menu"><span>참고 글</span><button class="save">수집하기</button><button class="close" aria-label="닫기">×</button></div></div>`;
    const wrap = shadow.querySelector('.wrap');
    const icon = shadow.querySelector('.icon');
    const counts = shadow.querySelector('.counts');
    const post = readPost(card, url);
    counts.textContent = `조회 ${post?.views || '—'} · ♥ ${post?.likes || '—'}`;
    const save = shadow.querySelector('.save');
    icon.addEventListener('click', () => wrap.classList.toggle('open'));
    shadow.querySelector('.close').addEventListener('click', () => wrap.classList.remove('open'));
    save.addEventListener('click', async () => {
      const selectedPost = readPost(card, url);
      if (!selectedPost) { save.textContent = '글을 읽지 못했어요'; return; }
      save.disabled = true;
      try {
        const current = await chrome.storage.local.get('giftNoteThreadReferences');
        const entries = Array.isArray(current.giftNoteThreadReferences) ? current.giftNoteThreadReferences : [];
        if (entries.some(item => item.url === url)) save.textContent = '이미 저장됨';
        else {
          entries.unshift({ ...selectedPost, id: crypto.randomUUID(), collectedAt: new Date().toISOString() });
          await chrome.storage.local.set({ giftNoteThreadReferences: entries.slice(0, 300) });
          save.textContent = '저장했어요 ✓';
        }
      } catch { save.textContent = '저장에 실패했어요'; }
    });
    document.documentElement.append(host);
    hosts.set(key, { host, card, counts, url });
  }

  function positionControls() {
    for (const [key, entry] of hosts) {
      if (!entry.card.isConnected) { entry.host.remove(); hosts.delete(key); continue; }
      if (!isVisible(entry.card)) { entry.host.style.display = 'none'; continue; }
      const rect = entry.card.getBoundingClientRect();
      const post = readPost(entry.card, entry.url);
      if (post) entry.counts.textContent = `조회 ${post.views || '—'} · ♥ ${post.likes || '—'}`;
      entry.host.style.display = 'block';
      entry.host.style.top = `${Math.max(8, Math.min(innerHeight - 42, rect.top + 10))}px`;
      entry.host.style.left = `${Math.max(8, Math.min(innerWidth - 42, rect.right - 40))}px`;
    }
  }

  function scan() {
    queued = false;
    for (const anchor of document.querySelectorAll('a[href*="/post/"]')) {
      const url = postUrl(anchor);
      const key = postKey(url);
      if (!url || hosts.has(key) || !isVisible(anchor)) continue;
      const card = findCard(anchor);
      if (card && !card.querySelector(`[${INSTALLED}]`)) makeControl(card, url, key);
    }
    positionControls();
  }

  function scheduleScan() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(scan);
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('scroll', positionControls, { passive: true });
  addEventListener('resize', positionControls, { passive: true });
  scheduleScan();
})();
