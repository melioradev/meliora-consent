/* Demo page: shows the current choice, which stand-in tags have run, and the cookies they set. */
(() => {
  const out = document.getElementById('demo-state');
  const render = () => {
    const choices = window.MelioraConsent?.get();
    const ran = window.__demoRan || [];
    out.textContent = [
      `Choice: ${choices ? Object.entries(choices).map(([c, on]) => `${c} ${on ? 'on' : 'off'}`).join(', ') : 'not made yet'}`,
      `Tags that ran: ${ran.length ? ran.join(', ') : 'none'}`,
      `Cookies: ${document.cookie || 'none'}`,
    ].join('\n');
  };
  document.addEventListener('meliora-consent', () => setTimeout(render, 100));
  document.getElementById('demo-reset').addEventListener('click', () => window.MelioraConsent?.reset());
  render();
  setTimeout(render, 300);
})();
