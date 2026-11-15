/* Demo page: builds the install snippet from the form, and copies it. */
(() => {
  const form = document.getElementById('snippet-form');
  if (!form) return;
  const out = document.getElementById('snippet-output');
  const status = document.getElementById('snippet-status');
  const SRC = 'https://cdn.jsdelivr.net/gh/melioradev/meliora-consent@v0.2.0/dist/meliora-consent.min.js';
  const attr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const today = new Date().toISOString().slice(0, 10);
  if (!form.elements.version.value) form.elements.version.value = today;

  function build() {
    const f = form.elements;
    const categories = [...form.querySelectorAll('input[name="categories"]:checked')].map(c => c.value);
    const attrs = [];
    if (f.policy.value.trim()) attrs.push(`data-policy="${attr(f.policy.value.trim())}"`);
    if (f.policyHe.value.trim()) attrs.push(`data-policy-he="${attr(f.policyHe.value.trim())}"`);
    attrs.push(`data-policy-version="${attr(f.version.value.trim() || today)}"`);
    attrs.push(`data-categories="${categories.join(' ')}"`);
    if (!f.google.checked) attrs.push('data-consent-mode="false"');
    const example = categories[0] || 'analytics';
    return [
      '<!-- In <head>, before your tracking scripts, without defer: -->',
      `<script src="${SRC}"\n        ${attrs.join('\n        ')}></script>`,
      '',
      '<!-- Then tag each tracking script with its category: -->',
      `<script type="text/plain" data-consent="${example}" src="…"></script>`,
      '',
      '<!-- And in the footer of every page: -->',
      '<button type="button" data-consent-open hidden>Cookie settings</button>',
    ].join('\n') + (categories.length ? '' : '\n\n<!-- No categories ticked: the banner stays off, because there is nothing to ask. -->');
  }

  const update = () => { out.textContent = build(); status.textContent = ''; };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', event => event.preventDefault());
  document.getElementById('snippet-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      status.textContent = 'Copied.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(out);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = 'Selected: press Ctrl+C (⌘C on a Mac) to copy.';
    }
  });
  update();
})();
