/*! Meliora Consent — https://github.com/melioradev/meliora-consent — MIT with visible attribution, see LICENSE. */
/* Runs synchronously in <head>: after the site's config, before any tagged or Google script.
   Reads the stored choice, sets the Google Consent Mode defaults (and the stored update), and writes the
   allowed categories to <html data-consent>. With no optional categories configured, it does nothing. */
(() => {
  const KEY = 'meliora.consent';
  const CATEGORIES = ['functional', 'analytics', 'marketing'];
  const config = window.MelioraConsentConfig || {};
  const configured = CATEGORIES.filter(c => config.categories && config.categories[c]);
  const state = {KEY, CATEGORIES, config, configured, record: null, choices: {}, gpc: false};
  window.MelioraConsentState = state;
  if (!configured.length) return;

  const html = document.documentElement;
  state.gpc = config.honorGPC !== false && navigator.globalPrivacyControl === true && configured.includes('marketing');
  const policy = String(config.policyVersion ?? '');
  const maxAge = (Number(config.renewAfterDays) || 365) * 864e5;

  // A stored choice counts only for the current policy version, with every configured category answered, and while recent.
  let record = null;
  try { record = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* storage blocked: undecided */ }
  // With `cookieDomain`, a choice made on another subdomain arrives as the meliora_consent cookie.
  if (!record && config.cookieDomain) {
    const match = document.cookie.match(/(?:^|; )meliora_consent=([^;]*)/);
    try { record = match ? JSON.parse(decodeURIComponent(match[1])) : null; } catch { record = null; }
  }
  const valid = record && typeof record === 'object' && record.v === 1 && record.policy === policy
    && record.choices && configured.every(c => typeof record.choices[c] === 'boolean')
    && Date.now() - Date.parse(record.ts) < maxAge;
  state.record = valid ? record : null;

  // Effective choices. A GPC signal that appeared after the choice was made turns marketing off.
  const effective = rec => {
    const choices = {};
    for (const c of configured) choices[c] = Boolean(rec && rec.choices[c]);
    if (state.gpc && rec && !rec.gpc) choices.marketing = false;
    return choices;
  };
  state.choices = effective(state.record);

  // Google Consent Mode v2: functional → functionality/personalization, analytics → analytics, marketing → ads.
  const value = on => (on ? 'granted' : 'denied');
  const signals = c => ({
    functionality_storage: value(c.functional), personalization_storage: value(c.functional),
    analytics_storage: value(c.analytics),
    ad_storage: value(c.marketing), ad_user_data: value(c.marketing), ad_personalization: value(c.marketing),
  });
  const consentMode = config.googleConsentMode !== false;
  if (consentMode) {
    window.dataLayer = window.dataLayer || [];
    // gtag must push the Arguments object itself; Google's tag ignores a plain array.
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {...signals({}), security_storage: 'granted', wait_for_update: 500});
    if (config.adsDataRedaction !== false) window.gtag('set', 'ads_data_redaction', true);
  }

  function apply(choices) {
    html.dataset.consent = configured.filter(c => choices[c]).join(' ');
    if (consentMode) window.gtag('consent', 'update', signals(choices));
  }
  if (state.record) apply(state.choices); else html.dataset.consent = '';
  Object.assign(state, {apply, effective, signals, consentMode});
})();
