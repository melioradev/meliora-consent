// Demo only: ?lang=he (or any of the ten languages) sets the page language, which the banner follows (the demo text
// itself stays in English), and ?gpc=1 simulates Global Privacy Control.
(() => {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang');
  if (lang && /^[a-z]{2}$/.test(lang)) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr';
  }
  if (params.get('gpc') === '1') Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {get: () => true, configurable: true});
})();
