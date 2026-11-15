/* One-file install: settings from this script tag's data- attributes, and the stylesheet that sits next to this file.
     <script src="…/dist/meliora-consent.min.js" data-policy="/privacy/" data-categories="analytics marketing"></script>
   Attributes: data-policy (and data-policy-he, …), data-policy-version, data-categories (functional analytics marketing),
   data-consent-mode="false", data-gpc="false", data-renew-days, data-cookie-domain, data-log, data-insert-after,
   data-css="none" (load the CSS yourself). window.MelioraConsentConfig, when the page sets it, wins over the attributes;
   use it for cookie lists. */
(() => {
  const script = document.currentScript;
  if (!script) return;
  const data = script.dataset;
  const config = window.MelioraConsentConfig = window.MelioraConsentConfig || {};
  const set = (key, value) => { if (!(key in config) && value !== undefined && value !== '') config[key] = value; };
  const urls = {};
  for (const [key, value] of Object.entries(data)) {
    const match = /^policy([A-Z][a-z]{1,2})?$/.exec(key); // data-policy, data-policy-he, … (not data-policy-version)
    if (match && value) urls[match[1] ? match[1].toLowerCase() : 'default'] = value;
  }
  if (Object.keys(urls).length) set('policyUrl', urls);
  set('policyVersion', data.policyVersion);
  if (data.categories) set('categories', Object.fromEntries(data.categories.split(/[\s,]+/).filter(Boolean).map(c => [c, {}])));
  if (data.consentMode) set('googleConsentMode', data.consentMode !== 'false');
  if (data.gpc) set('honorGPC', data.gpc !== 'false');
  if (data.renewDays) set('renewAfterDays', Number(data.renewDays));
  set('cookieDomain', data.cookieDomain);
  set('logEndpoint', data.log);
  set('insertAfter', data.insertAfter);
  // Only from the package's own file: bundled into a site's JavaScript, load dist/meliora-consent.css yourself.
  if (data.css !== 'none' && /meliora-consent(\.min)?\.js($|[?#])/.test(script.src)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = script.src.replace(/\.js(?=$|[?#])/, '.css'); // meliora-consent.min.js → meliora-consent.min.css
    link.setAttribute('blocking', 'render');
    script.after(link);
  }
})();
