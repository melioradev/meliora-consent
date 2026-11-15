/*! Meliora Consent — https://github.com/melioradev/meliora-consent
    Made by Meliora Novotech Ltd (https://melioranovotech.com). License: MIT with visible attribution. The
    "Made by Meliora Novotech Ltd" credit in the cookie settings dialog must stay. See LICENSE.

   meliora-consent-boot.js has already read the stored choice and set the Consent Mode defaults.
   This file builds the banner and the settings dialog, releases tagged scripts and embeds, and
   provides window.MelioraConsent. Spec: COOKIE-CONSENT.md in melioradev/meliora-landing. */
(() => {
  const S = window.MelioraConsentState;
  const I18N = window.MelioraConsentI18n;
  if (!S || !I18N || !S.configured.length) return;
  const {KEY, config, configured} = S;
  const html = document.documentElement;
  const REPO_URL = 'https://github.com/melioradev/meliora-consent';
  const SITE_URL = 'https://melioranovotech.com';

  /* ---------- language: the banner is page content, so it follows <html lang> ---------- */
  const base = (html.lang || 'en').toLowerCase().split('-')[0].replace(/^iw$/, 'he');
  const lang = I18N[base] && base !== 'order' ? base : 'en';
  const dir = I18N[lang].dir;
  const text = config.text || {};
  const t = key => text[lang]?.[key] ?? text.default?.[key] ?? I18N[lang][key] ?? I18N.en[key];
  const pick = v => (typeof v === 'string' ? v : v && typeof v === 'object' ? (v[lang] ?? v.default ?? v.en ?? '') : '');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const joinList = items => { try { return new Intl.ListFormat(lang, {type: 'conjunction'}).format(items); } catch { return items.join(', '); } };
  const policyHref = pick(config.policyUrl) || null;
  const CLOSE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const button = (action, label, extra = '') => `<button type="button" class="mc-btn" data-mc="${action}"${extra}>${esc(label)}</button>`;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  // "Accept all" never turns marketing on while the browser sends Global Privacy Control.
  const all = on => Object.fromEntries(configured.map(c => [c, on && !(S.gpc && c === 'marketing')]));
  const allowed = list => String(list || '').split(/\s+/).filter(Boolean).every(c => S.choices[c] === true);

  /* ---------- status message (also a live region) ---------- */
  const status = document.createElement('p');
  status.className = 'mc mc-status';
  status.setAttribute('role', 'status');
  status.lang = lang; status.dir = dir;
  document.body.append(status);
  let statusTimer;
  function announce(message) {
    status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  }

  function focusMain() {
    const main = document.querySelector('main');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), {once: true});
    }
    main.focus({preventScroll: true});
  }

  /* ---------- banner (first layer) ---------- */
  let banner = null, spacer = null, resizeObserver = null, fabObserver = null, frame = 0;
  const savedPadding = html.style.scrollPaddingBottom;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };

  function buildBanner() {
    banner = document.createElement('section');
    banner.className = 'mc mc-banner';
    banner.setAttribute('aria-labelledby', 'mc-title');
    banner.lang = lang; banner.dir = dir;
    const purposes = joinList(configured.map(c => t('purposes')[c]));
    banner.innerHTML = `<h2 id="mc-title" class="mc-title">${esc(t('title'))}</h2>
      <p class="mc-text">${esc(fill(t('intro'), {purposes}))}${policyHref ? ` <a href="${esc(policyHref)}">${esc(t('policy'))}</a>` : ''}</p>
      ${S.gpc ? `<p class="mc-gpc">${esc(t('gpcNote'))}</p>` : ''}
      <div class="mc-buttons">${button('accept', t('acceptAll'))}${button('reject', t('rejectAll'))}${button('choose', t('choose'), ' aria-haspopup="dialog" aria-controls="mc-dialog"')}</div>`;
    banner.addEventListener('click', event => {
      const control = event.target.closest('[data-mc]');
      if (!control) return;
      if (control.dataset.mc === 'accept') decide(all(true), 'accept-all');
      else if (control.dataset.mc === 'reject') decide(all(false), 'reject-all');
      else if (control.dataset.mc === 'choose') openDialog(control);
    });
    // Early in the reading and Tab order: after the accessibility button, otherwise after the skip link.
    const anchor = (config.insertAfter && document.querySelector(config.insertAfter))
      || document.querySelector('.a11y-fab')
      || document.querySelector('.skip, .skip-link, a[href="#main"], a[href="#content"]');
    if (anchor) anchor.after(banner); else document.body.prepend(banner);
    spacer = document.createElement('div');
    spacer.className = 'mc-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    document.body.append(spacer);
    document.addEventListener('focusin', keepFocusVisible);

    resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(banner);
    resizeObserver.observe(html);
    addEventListener('resize', schedule);
    watchFab();
    // The accessibility panel may load after this script: look again once the page is parsed.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { watchFab(); schedule(); }, {once: true});
    layout();
  }
  // Re-measure when the visitor hides, shows or drags the accessibility button.
  function watchFab() {
    const fab = document.querySelector('.a11y-fab');
    if (!fab || fabObserver || !banner) return;
    fabObserver = new MutationObserver(schedule);
    fabObserver.observe(fab, {attributes: true, attributeFilter: ['hidden', 'class']});
  }

  /* Card at the bottom-left when there is room beside the accessibility button (bottom-right),
     otherwise a full-width sheet that lifts the button by its height. Measured, not a media query,
     because the panel's text size scales rem and media queries ignore that. */
  function layout() {
    if (!banner) return;
    const rem = parseFloat(getComputedStyle(html).fontSize) || 16;
    const fab = document.querySelector('.a11y-fab');
    const fabSpace = fab && !fab.hidden && !fab.classList.contains('a11y-moved') ? 3.75 : 0;
    const sheet = html.clientWidth < rem * (28 + fabSpace);
    banner.classList.toggle('mc-sheet', sheet);
    const height = Math.ceil(banner.getBoundingClientRect().height);
    const clearance = height + (sheet ? 0 : Math.ceil(rem));
    html.style.setProperty('--meliora-consent-inset', sheet ? `${height}px` : '0px');
    html.style.scrollPaddingBottom = `${clearance}px`;
    spacer.style.height = `${clearance}px`;
  }

  /* Focus not obscured (WCAG 2.2, 2.4.11): browsers ignore scroll-padding when Tab moves focus,
     so an element that lands behind the banner is scrolled above it (scrollIntoView honors scroll-padding). */
  function keepFocusVisible(event) {
    const target = event.target;
    if (!banner || !(target instanceof Element) || banner.contains(target) || target.closest('dialog')) return;
    for (let el = target; el && el !== document.body; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') return;
    const r = target.getBoundingClientRect(), b = banner.getBoundingClientRect();
    if (r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right) target.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  }

  function removeBanner() {
    if (!banner) return false;
    const hadFocus = banner.contains(document.activeElement);
    resizeObserver?.disconnect(); fabObserver?.disconnect(); fabObserver = null; cancelAnimationFrame(frame);
    removeEventListener('resize', schedule);
    banner.remove(); banner = null;
    spacer.remove(); spacer = null;
    document.removeEventListener('focusin', keepFocusVisible);
    html.style.removeProperty('--meliora-consent-inset');
    html.style.scrollPaddingBottom = savedPadding;
    return hadFocus;
  }

  /* ---------- settings dialog (second layer) ---------- */
  let dialog = null, opener = null;
  const cookieList = entries => (Array.isArray(entries) && entries.length
    ? `<details class="mc-details"><summary>${esc(t('cookiesIn'))}</summary>${entries.map(c => `<dl class="mc-cookie">
        <div><dt>${esc(t('colName'))}</dt><dd><code>${esc(c.name)}</code></dd></div>
        <div><dt>${esc(t('colProvider'))}</dt><dd>${esc(pick(c.provider))}</dd></div>
        <div><dt>${esc(t('colPurpose'))}</dt><dd>${esc(pick(c.purpose))}</dd></div>
        <div><dt>${esc(t('colDuration'))}</dt><dd>${esc(pick(c.duration))}</dd></div></dl>`).join('')}</details>`
    : '');

  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.id = 'mc-dialog';
    dialog.className = 'mc mc-dialog';
    dialog.lang = lang; dialog.dir = dir;
    dialog.setAttribute('aria-labelledby', 'mc-dialog-title');
    const rows = configured.map(c => `<li class="mc-cat">
        <button type="button" class="mc-row" data-cat="${c}" aria-pressed="false" aria-describedby="mc-desc-${c}"><span class="mc-label">${esc(t(c))}</span><span class="mc-switch" aria-hidden="true"></span></button>
        <p class="mc-desc" id="mc-desc-${c}">${esc(t(`${c}Desc`))}</p>${cookieList(config.categories[c].cookies)}</li>`).join('');
    dialog.innerHTML = `<div class="mc-head"><h2 id="mc-dialog-title" class="mc-title" tabindex="-1">${esc(t('settingsTitle'))}</h2>
        <button type="button" class="mc-close" data-mc="close" aria-label="${esc(t('close'))}">${CLOSE}</button></div>
      <div class="mc-body">
        ${S.gpc ? `<p class="mc-gpc">${esc(t('gpcNote'))}</p>` : ''}
        <ul class="mc-cats">
          <li class="mc-cat"><div class="mc-row mc-fixed"><span class="mc-label">${esc(t('necessary'))}</span><span class="mc-always">${esc(t('alwaysOn'))}</span></div>
            <p class="mc-desc">${esc(t('necessaryDesc'))}</p>${cookieList(config.necessary?.cookies)}</li>
          ${rows}
        </ul>
        <div class="mc-buttons">${button('save', t('save'))}${button('reject', t('rejectAll'))}${button('accept', t('acceptAll'))}</div>
        ${policyHref ? `<p class="mc-policy"><a href="${esc(policyHref)}">${esc(t('policy'))}</a></p>` : ''}
        <p class="mc-credit">${esc(t('madeBy')).replace('{name}', `<a href="${REPO_URL}" rel="noopener">Meliora Novotech Ltd</a>`)} · <a href="${SITE_URL}" rel="noopener">melioranovotech.com</a></p>
      </div>`;
    dialog.addEventListener('click', event => {
      if (event.target === dialog) { // the backdrop
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
        return;
      }
      const toggle = event.target.closest('[data-cat]');
      if (toggle) { toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true')); return; }
      const action = event.target.closest('[data-mc]')?.dataset.mc;
      if (action === 'close') dialog.close();
      else if (action === 'accept') decide(all(true), 'accept-all');
      else if (action === 'reject') decide(all(false), 'reject-all');
      else if (action === 'save') {
        decide(Object.fromEntries(configured.map(c => [c, dialog.querySelector(`[data-cat="${c}"]`).getAttribute('aria-pressed') === 'true'])), 'custom');
      }
    });
    // Esc and the close button close without saving. Focus returns to the opener, or to <main> if it is gone.
    dialog.addEventListener('close', () => {
      const target = opener && opener.isConnected ? opener : null;
      opener = null;
      if (target) target.focus(); else focusMain();
    });
    document.body.append(dialog);
  }

  function openDialog(from) {
    if (!dialog) buildDialog();
    if (dialog.open) return;
    opener = from instanceof HTMLElement && from !== document.body ? from : null;
    for (const c of configured) dialog.querySelector(`[data-cat="${c}"]`).setAttribute('aria-pressed', String(S.choices[c] === true));
    dialog.showModal();
    dialog.querySelector('#mc-dialog-title').focus();
  }

  /* ---------- releasing scripts and embeds ---------- */
  function release() {
    // Tagged scripts, in document order. Ones without `async` keep their order (async = false).
    for (const old of document.querySelectorAll('script[type="text/plain"][data-consent]')) {
      if (!allowed(old.dataset.consent)) continue;
      const script = document.createElement('script');
      for (const {name, value} of [...old.attributes]) if (!['type', 'data-type', 'nonce'].includes(name)) script.setAttribute(name, value);
      script.type = old.dataset.type || 'text/javascript';
      if (old.nonce) script.nonce = old.nonce; // the nonce attribute reads as empty once the page has loaded
      if (!old.hasAttribute('async')) script.async = false;
      if (!old.hasAttribute('src')) script.text = old.text;
      old.replaceWith(script);
    }
    for (const iframe of document.querySelectorAll('iframe[data-consent][data-src]')) {
      if (allowed(iframe.dataset.consent)) showEmbed(iframe); else placeholder(iframe);
    }
  }

  function placeholder(iframe) {
    if (iframe.previousElementSibling?.classList.contains('mc-embed')) return;
    iframe.hidden = true;
    const cats = iframe.dataset.consent.split(/\s+/).filter(c => configured.includes(c));
    const category = joinList(cats.map(c => t('inline')[c]));
    let provider = iframe.dataset.provider || '';
    if (!provider) { try { provider = new URL(iframe.dataset.src, location.href).hostname.replace(/^www\./, ''); } catch { /* keep empty */ } }
    const box = document.createElement('div');
    box.className = 'mc mc-embed';
    box.lang = lang; box.dir = dir;
    box.setAttribute('role', 'group');
    if (iframe.title) box.setAttribute('aria-label', iframe.title);
    const w = Number(iframe.getAttribute('width')), h = Number(iframe.getAttribute('height'));
    if (w > 0 && h > 0) { box.style.aspectRatio = `${w} / ${h}`; box.style.maxInlineSize = `${w}px`; }
    box.innerHTML = `${iframe.title ? `<p class="mc-embed-title">${esc(iframe.title)}</p>` : ''}
      <p>${esc(fill(t('embedText'), {provider, category}))}</p>
      <div class="mc-buttons">${button('allow', fill(t('embedAllow'), {category}))}${button('settings', t('settingsTitle'), ' aria-haspopup="dialog" aria-controls="mc-dialog"')}</div>`;
    box.addEventListener('click', event => {
      const control = event.target.closest('[data-mc]');
      if (!control) return;
      if (control.dataset.mc === 'settings') { openDialog(control); return; }
      const next = {...all(false), ...(S.record ? S.choices : {})};
      for (const c of cats) next[c] = true;
      decide(next, 'embed');
    });
    iframe.before(box);
  }

  function showEmbed(iframe) {
    const box = iframe.previousElementSibling?.classList.contains('mc-embed') ? iframe.previousElementSibling : null;
    const hadFocus = Boolean(box?.contains(document.activeElement));
    iframe.src = iframe.dataset.src;
    iframe.removeAttribute('data-src');
    iframe.hidden = false;
    box?.remove();
    if (hadFocus) iframe.focus();
  }

  /* ---------- withdrawing: delete the category's declared first-party cookies and storage keys ---------- */
  function expire(name) {
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join('.')}`);
    for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
  }
  function forget(cats) {
    const names = document.cookie ? document.cookie.split('; ').map(c => c.split('=')[0]) : [];
    for (const c of cats) {
      const entry = config.categories[c] || {};
      for (const cookie of entry.cookies || []) {
        for (const pattern of String(cookie.name || '').split(/\s*,\s*/).filter(Boolean)) {
          (pattern.endsWith('*') ? names.filter(n => n.startsWith(pattern.slice(0, -1))) : [pattern]).forEach(expire);
        }
      }
      for (const key of entry.storageKeys || []) { try { localStorage.removeItem(key); } catch { /* blocked */ } }
    }
  }

  /* ---------- saving a choice ---------- */
  function writeCookie(record) {
    if (!config.cookieDomain) return;
    const days = Number(config.renewAfterDays) || 365;
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `meliora_consent=${encodeURIComponent(JSON.stringify(record))}; domain=${config.cookieDomain}; path=/; max-age=${Math.round(days * 86400)}; SameSite=Lax${secure}`;
  }
  function log(record) {
    if (!config.logEndpoint || !navigator.sendBeacon) return;
    const {id, policy, ts, method, choices, gpc} = record; // no IP address, no user agent
    try { navigator.sendBeacon(config.logEndpoint, new Blob([JSON.stringify({id, policy, ts, method, choices, gpc})], {type: 'application/json'})); } catch { /* best effort */ }
  }

  function decide(next, method) {
    const before = S.record ? {...S.choices} : null;
    const record = {
      v: 1, id: S.record?.id || uuid(), policy: String(config.policyVersion ?? ''), ts: new Date().toISOString(),
      method, gpc: S.gpc, choices: Object.fromEntries(configured.map(c => [c, next[c] === true])),
    };
    try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* lasts for this page view only */ }
    writeCookie(record);
    S.record = record;
    S.choices = S.effective(record);
    S.apply(S.choices);
    if (S.consentMode) window.dataLayer.push({event: 'meliora_consent_update', meliora_consent: {...S.choices}});
    document.dispatchEvent(new CustomEvent('meliora-consent', {detail: {choices: {...S.choices}, method, gpc: S.gpc}}));
    log(record);
    // A script that has run can't be unloaded: delete what the withdrawn categories left behind, then reload.
    const withdrawn = before ? configured.filter(c => before[c] && !S.choices[c]) : [];
    if (withdrawn.length) { forget(withdrawn); location.reload(); return; }
    release();
    const bannerHadFocus = removeBanner();
    if (dialog?.open) dialog.close();
    announce(t('saved'));
    if (bannerHadFocus) focusMain();
  }

  /* ---------- start ---------- */
  for (const control of document.querySelectorAll('[data-consent-open]')) {
    control.hidden = false;
    control.addEventListener('click', event => { event.preventDefault(); openDialog(control); });
  }
  release();
  if (!S.record) buildBanner();

  window.MelioraConsent = {
    get: () => (S.record ? {...S.choices} : null),
    has: category => Boolean(S.record && S.choices[category] === true),
    open: () => openDialog(document.activeElement),
    reset: () => {
      try { localStorage.removeItem(KEY); } catch { /* blocked */ }
      if (config.cookieDomain) document.cookie = `meliora_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${config.cookieDomain}`;
      forget(configured.filter(c => S.choices[c]));
      location.reload();
    },
  };
})();
