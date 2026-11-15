// Browser tests for Meliora Consent (spec: COOKIE-CONSENT.md section 15, in melioradev/meliora-landing).
// Every page is served with a strict CSP; CSP violations and page errors fail the test.
const {test, expect} = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const LANGS = ['en', 'ar', 'zh', 'fr', 'de', 'he', 'it', 'ru', 'es', 'uk'];
const GATED = /\/demo\/(analytics|analytics-init|marketing|functional)\.js|\/demo\/embed\.html/;
const PANEL = '/tests/fixtures/panel.html';
const hasPanel = fs.existsSync(path.resolve(__dirname, '../../meliora-accessibility/src/meliora-a11y.js'));
const banner = page => page.locator('.mc-banner');
const dialog = page => page.locator('#mc-dialog');
const ran = page => page.evaluate(() => window.__demoRan || []);
const cookieNames = async page => (await page.context().cookies()).map(c => c.name).sort();
const dataLayer = page => page.evaluate(() => (window.dataLayer || []).map(e => (e && typeof e === 'object' && !Array.isArray(e) && 'length' in e ? Array.from(e) : e)));
const record = page => page.evaluate(() => JSON.parse(localStorage.getItem('meliora.consent')));
const ALL_ON = ['analytics', 'analytics-init', 'marketing', 'functional'];

async function axe(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished.catch(() => {}))));
  const result = await new AxeBuilder({page}).withTags(TAGS).analyze();
  expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
function trackGated(page) {
  const hits = [];
  page.on('request', request => { if (GATED.test(request.url())) hits.push(new URL(request.url()).pathname); });
  return hits;
}
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  page.__errors = [];
  page.on('pageerror', error => page.__errors.push(String(error)));
});
test.afterEach(async ({page}) => {
  expect(page.__errors).toEqual([]);
  expect(await page.evaluate(() => window.__csp || []).catch(() => [])).toEqual([]);
});

/* ---------- nothing before a choice ---------- */

test('nothing optional loads before a choice, or after Reject all and a reload', async ({page}) => {
  const hits = trackGated(page);
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await expect(page.locator('.mc-embed')).toBeVisible();
  await page.waitForTimeout(300);
  expect(hits).toEqual([]);
  expect(await ran(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.dataset.consent)).toBe('');
  await banner(page).getByRole('button', {name: 'Reject all'}).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator('.mc-status')).toHaveText('Cookie choices saved');
  expect(await record(page)).toMatchObject({v: 1, policy: '2026-11-15', method: 'reject-all', gpc: false, choices: {functional: false, analytics: false, marketing: false}});
  await page.reload();
  await page.waitForTimeout(300);
  await expect(banner(page)).toHaveCount(0);
  expect(hits).toEqual([]);
  expect(await cookieNames(page)).toEqual([]);
});

test('no optional categories configured: no banner, no extra markup, the footer button stays hidden', async ({page}) => {
  await page.goto('/tests/fixtures/none.html');
  await page.waitForLoadState('load');
  expect(await page.locator('.mc').count()).toBe(0);
  await expect(page.locator('[data-consent-open]')).toBeHidden();
  expect(await page.evaluate(() => [typeof window.MelioraConsent, typeof window.dataLayer, 'consent' in document.documentElement.dataset])).toEqual(['undefined', 'undefined', false]);
});

/* ---------- accepting ---------- */

test('Accept all releases the tags in document order, after the Consent Mode default', async ({page}) => {
  await page.goto('/');
  const initial = await dataLayer(page);
  expect(initial[0]).toEqual(['consent', 'default', {
    functionality_storage: 'denied', personalization_storage: 'denied', analytics_storage: 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', security_storage: 'granted', wait_for_update: 500,
  }]);
  expect(initial[1]).toEqual(['set', 'ads_data_redaction', true]);
  expect(initial.some(e => Array.isArray(e) && e[1] === 'update')).toBe(false);

  await banner(page).getByRole('button', {name: 'Accept all'}).click();
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  const after = await dataLayer(page);
  expect(after).toContainEqual(['consent', 'update', {
    functionality_storage: 'granted', personalization_storage: 'granted', analytics_storage: 'granted',
    ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
  }]);
  expect(after).toContainEqual({event: 'meliora_consent_update', meliora_consent: {functional: true, analytics: true, marketing: true}});
  expect(await page.evaluate(() => document.documentElement.dataset.consent)).toBe('functional analytics marketing');
  await expect(page.frameLocator('iframe[title="Product demo video"]').locator('body')).toContainText('Embedded content loaded');
  await expect(page.locator('.mc-embed')).toHaveCount(0);
  expect(await record(page)).toMatchObject({method: 'accept-all', choices: {functional: true, analytics: true, marketing: true}});

  // On the next page the stored choice applies before any tag: default first, then update, then the tags.
  await page.reload();
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  const reloaded = await dataLayer(page);
  expect(reloaded[0][1]).toBe('default');
  expect(reloaded.findIndex(e => Array.isArray(e) && e[1] === 'update')).toBeGreaterThan(0);
  await expect(banner(page)).toHaveCount(0);
});

test('every cookie set after Accept all is declared in the config', async ({page}) => {
  await page.goto('/');
  await banner(page).getByRole('button', {name: 'Accept all'}).click();
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  const declared = await page.evaluate(() => {
    const c = window.MelioraConsentConfig;
    return [...(c.necessary?.cookies || []), ...Object.values(c.categories).flatMap(x => x.cookies || [])].flatMap(x => x.name.split(/\s*,\s*/));
  });
  const names = await cookieNames(page);
  expect(names.length).toBeGreaterThan(0);
  expect(names.filter(n => !declared.some(d => (d.endsWith('*') ? n.startsWith(d.slice(0, -1)) : n === d)))).toEqual([]);
});

/* ---------- choosing and withdrawing ---------- */

test('Choose cookies: switches start off, Save stores only what was turned on', async ({page}) => {
  await page.goto('/');
  await banner(page).getByRole('button', {name: 'Choose cookies'}).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#mc-dialog-title')).toBeFocused();
  for (const name of ['Functional', 'Analytics', 'Marketing']) await expect(dialog(page).getByRole('button', {name, exact: true})).toHaveAttribute('aria-pressed', 'false');
  await expect(dialog(page).getByText('Always on')).toBeVisible();
  await dialog(page).getByRole('button', {name: 'Analytics', exact: true}).click();
  await dialog(page).getByRole('button', {name: 'Save choices'}).click();
  await expect(dialog(page)).toBeHidden();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator('main')).toBeFocused();
  await expect.poll(() => ran(page)).toEqual(['analytics', 'analytics-init']);
  expect(await record(page)).toMatchObject({method: 'custom', choices: {functional: false, analytics: true, marketing: false}});
});

test('withdrawing reloads the page, deletes declared cookies and storage, and the tags stay off', async ({page}) => {
  await page.goto('/');
  await banner(page).getByRole('button', {name: 'Accept all'}).click();
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  expect(await cookieNames(page)).toEqual(['_demo_ads', '_demo_ga', '_demo_ga_A1B2']);
  expect(await page.evaluate(() => localStorage.getItem('demo.chat'))).toBe('open');

  await page.locator('footer [data-consent-open]').click();
  for (const name of ['Analytics', 'Functional']) {
    const toggle = dialog(page).getByRole('button', {name, exact: true});
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  }
  await page.evaluate(() => { window.__beforeReload = true; });
  await dialog(page).getByRole('button', {name: 'Save choices'}).click();
  // Wait for the reload itself (the marker is gone), then for the remaining tag.
  await expect.poll(() => page.evaluate(() => !window.__beforeReload && (window.__demoRan || []).join()).catch(() => false)).toBe('marketing');
  await page.waitForLoadState('load');
  expect(await cookieNames(page)).toEqual(['_demo_ads']);
  expect(await page.evaluate(() => localStorage.getItem('demo.chat'))).toBeNull();
  expect(await record(page)).toMatchObject({method: 'custom', choices: {functional: false, analytics: false, marketing: true}});
});

test('Esc and the close button close the dialog without saving; focus returns to the opener', async ({page}) => {
  await page.goto('/');
  const footerButton = page.locator('footer [data-consent-open]');
  await expect(footerButton).toBeVisible();
  await footerButton.focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#mc-dialog-title')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', {name: 'Close'})).toBeFocused();
  await dialog(page).getByRole('button', {name: 'Analytics', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(footerButton).toBeFocused();
  await expect(banner(page)).toBeVisible();
  expect(await record(page)).toBeNull();
  await footerButton.click();
  await expect(dialog(page).getByRole('button', {name: 'Analytics', exact: true})).toHaveAttribute('aria-pressed', 'false');
  await dialog(page).getByRole('button', {name: 'Close'}).click();
  await expect(dialog(page)).toBeHidden();
  await expect(footerButton).toBeFocused();
});

test('an embed placeholder loads the embed after consent for its category only', async ({page}) => {
  await page.goto('/');
  const box = page.locator('.mc-embed');
  await expect(box).toHaveAttribute('aria-label', 'Product demo video');
  await expect(box).toContainText('This content is from Example Video. Showing it allows marketing cookies.');
  await box.getByRole('button', {name: 'Allow marketing cookies and show'}).click();
  await expect(page.frameLocator('iframe[title="Product demo video"]').locator('body')).toContainText('Embedded content loaded');
  await expect(banner(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.MelioraConsent.get())).toEqual({functional: false, analytics: false, marketing: true});
  expect(await record(page)).toMatchObject({method: 'embed'});
  await expect.poll(() => ran(page)).toEqual(['marketing']);
});

/* ---------- signals, storage and renewal ---------- */

test('Global Privacy Control keeps marketing off after Accept all; its own switch can still turn it on', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {get: () => true, configurable: true}));
  await page.goto('/');
  await expect(banner(page).locator('.mc-gpc')).toHaveText('Your browser asked sites not to sell or share your data, so marketing cookies are off.');
  await banner(page).getByRole('button', {name: 'Accept all'}).click();
  await expect.poll(() => ran(page)).toEqual(['analytics', 'analytics-init', 'functional']);
  expect(await record(page)).toMatchObject({method: 'accept-all', gpc: true, choices: {functional: true, analytics: true, marketing: false}});
  await expect(page.locator('.mc-embed')).toBeVisible();

  await page.locator('footer [data-consent-open]').click();
  const marketing = dialog(page).getByRole('button', {name: 'Marketing', exact: true});
  await expect(marketing).toHaveAttribute('aria-pressed', 'false');
  await marketing.click();
  await dialog(page).getByRole('button', {name: 'Save choices'}).click();
  await expect.poll(() => ran(page)).toEqual(['analytics', 'analytics-init', 'functional', 'marketing']);
});

test('storage blocked: no errors, and the banner comes back on the next page', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }, configurable: true}));
  await page.goto('/');
  await banner(page).getByRole('button', {name: 'Accept all'}).click();
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await page.waitForTimeout(200);
  expect(await ran(page)).toEqual([]);
});

test('the banner asks again after a policy change or when the choice is too old', async ({page}) => {
  const stored = (policy, daysAgo) => page.addInitScript(([p, d]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('meliora.consent', JSON.stringify({v: 1, id: 'x', policy: p, ts: new Date(Date.now() - d * 864e5).toISOString(), method: 'accept-all', gpc: false, choices: {functional: true, analytics: true, marketing: true}}));
  }, [policy, daysAgo]);
  await stored('2026-01-01', 1);
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  expect(await ran(page)).toEqual([]);

  const old = await page.context().newPage();
  old.__errors = [];
  await old.addInitScript(() => localStorage.setItem('meliora.consent', JSON.stringify({v: 1, id: 'y', policy: '2026-11-15', ts: new Date(Date.now() - 400 * 864e5).toISOString(), method: 'accept-all', gpc: false, choices: {functional: true, analytics: true, marketing: true}})));
  await old.goto('/');
  await expect(old.locator('.mc-banner')).toBeVisible();

  const fresh = await page.context().newPage();
  await fresh.addInitScript(() => localStorage.setItem('meliora.consent', JSON.stringify({v: 1, id: 'z', policy: '2026-11-15', ts: new Date().toISOString(), method: 'reject-all', gpc: false, choices: {functional: false, analytics: false, marketing: false}})));
  await fresh.goto('/');
  await fresh.waitForTimeout(200);
  await expect(fresh.locator('.mc-banner')).toHaveCount(0);
});

test('the optional consent log receives the choice without IP address or user agent', async ({page}) => {
  await page.goto('/tests/fixtures/log.html');
  await banner(page).getByRole('button', {name: 'Reject all'}).click();
  await expect.poll(async () => (await page.request.get('/api/consent')).json()).toMatchObject({method: 'reject-all', policy: '2026-11-15', gpc: false});
  const logged = await (await page.request.get('/api/consent')).json();
  expect(Object.keys(logged).sort()).toEqual(['choices', 'gpc', 'id', 'method', 'policy', 'ts']);
});

test('API: get, has, open and reset', async ({page}) => {
  await page.goto('/');
  expect(await page.evaluate(() => [window.MelioraConsent.get(), window.MelioraConsent.has('analytics')])).toEqual([null, false]);
  await page.evaluate(() => window.MelioraConsent.open());
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', {name: 'Accept all'}).click();
  expect(await page.evaluate(() => [window.MelioraConsent.has('analytics'), window.MelioraConsent.get()])).toEqual([true, {functional: true, analytics: true, marketing: true}]);
  await expect.poll(() => ran(page)).toEqual(ALL_ON);
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => window.MelioraConsent.reset())]);
  await expect(banner(page)).toBeVisible();
  expect(await cookieNames(page)).toEqual([]);
  expect(await ran(page)).toEqual([]);
});

/* ---------- accessibility ---------- */

for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['en', 'dark'], ['ar', 'dark']]) {
  test(`axe: banner and dialog have no WCAG 2.1 AA violations (${lang}, ${scheme})`, async ({page}) => {
    await page.emulateMedia({colorScheme: scheme});
    await page.goto(`/?lang=${lang}`);
    await expect(banner(page)).toBeVisible();
    await axe(page);
    await banner(page).locator('[data-mc="choose"]').click();
    await expect(dialog(page)).toBeVisible();
    await page.evaluate(() => document.querySelectorAll('#mc-dialog details').forEach(d => { d.open = true; }));
    await axe(page);
  });
}

test('the banner follows the page language and direction, and stays at the physical left', async ({page}) => {
  await page.goto('/?lang=he');
  await expect(banner(page)).toHaveAttribute('dir', 'rtl');
  await expect(banner(page)).toHaveAttribute('lang', 'he');
  await expect(banner(page).getByRole('heading')).toHaveText('עוגיות באתר הזה');
  await expect(banner(page).getByRole('button', {name: 'דחיית הכול'})).toBeVisible();
  const box = await banner(page).boundingBox();
  expect(Math.round(box.x)).toBe(16);
  await page.goto('/?lang=pt');
  await expect(banner(page)).toHaveAttribute('lang', 'en');
  await expect(banner(page)).toHaveAttribute('dir', 'ltr');
});

test('the demo’s snippet builder writes the one-line install from the form', async ({page}) => {
  await page.goto('/');
  const out = page.locator('#snippet-output');
  await expect(out).toContainText('data-policy="/privacy/"');
  await expect(out).toContainText('data-categories="analytics"');
  await page.getByLabel('Hebrew policy URL').fill('/he/privacy/');
  await page.getByLabel('Marketing').check();
  await page.getByLabel('I use Google tags (Consent Mode v2)').uncheck();
  await expect(out).toContainText('data-policy-he="/he/privacy/"');
  await expect(out).toContainText('data-categories="analytics marketing"');
  await expect(out).toContainText('data-consent-mode="false"');
  await expect(out).toContainText('meliora-consent@v0.2.0/dist/meliora-consent.min.js');
});

test('Accept all and Reject all look identical', async ({page}) => {
  await page.goto('/');
  const look = name => banner(page).getByRole('button', {name}).evaluate(el => {
    const c = getComputedStyle(el);
    return {height: Math.round(el.getBoundingClientRect().height), background: c.backgroundColor, color: c.color, border: `${c.borderTopWidth} ${c.borderTopColor}`, weight: c.fontWeight, size: c.fontSize};
  });
  expect(await look('Accept all')).toEqual(await look('Reject all'));
  expect(await look('Accept all')).toEqual(await look('Choose cookies'));
});

/* ---------- with the accessibility panel ---------- */

test.describe('with the Meliora accessibility panel', () => {
  test.skip(!hasPanel, 'needs a checkout of melioradev/meliora-accessibility next to this repository');

  test('keyboard: skip link, accessibility button, ×, then the banner; a choice moves focus to main', async ({page}) => {
    await page.goto(PANEL);
    await page.waitForLoadState('load');
    await expect(page.locator('.a11y-trigger')).toBeVisible();
    await expect(banner(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.a11y-trigger')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.a11y-hide')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(banner(page).getByRole('link', {name: 'Cookie policy'})).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(banner(page).getByRole('button', {name: 'Accept all'})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(banner(page)).toHaveCount(0);
    await expect(page.locator('main')).toBeFocused();
  });

  test('the banner and the accessibility button never overlap', async ({page}) => {
    test.setTimeout(90000);
    const cases = [];
    for (const width of [1280, 800, 640, 480, 375, 320]) for (const scale of [1, 1.5, 2]) cases.push({width, scale, lang: 'en'});
    for (const lang of LANGS) { cases.push({width: 375, scale: 1, lang}); cases.push({width: 1280, scale: 2, lang}); }
    for (const {width, scale, lang} of cases) {
      await page.setViewportSize({width, height: 800});
      await page.goto(`${PANEL}?lang=${lang}`);
      await page.evaluate(s => { localStorage.setItem('meliora.a11y', JSON.stringify({scale: s})); }, scale);
      await page.reload();
      await expect(banner(page)).toBeVisible();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const [b, fab] = await Promise.all([banner(page).boundingBox(), page.locator('.a11y-fab').boundingBox()]);
      expect(intersects(b, fab), `${width}px, ${scale * 100}% text, ${lang}`).toBe(false);
      expect(b.height, `banner height at ${width}px, ${scale * 100}%`).toBeLessThanOrEqual(800 / 2 + 1);
      await page.evaluate(() => localStorage.clear());
    }
  });

  test('320px at 200% text: links focused with Tab are never hidden behind the banner', async ({page}) => {
    await page.setViewportSize({width: 320, height: 640});
    await page.addInitScript(() => { if (!localStorage.getItem('meliora.a11y')) localStorage.setItem('meliora.a11y', JSON.stringify({scale: 2})); });
    await page.goto(PANEL);
    await expect(banner(page)).toHaveClass(/mc-sheet/);
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      const hidden = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el.closest('main')) return null;
        const a = el.getBoundingClientRect(), b = document.querySelector('.mc-banner').getBoundingClientRect();
        return a.bottom > b.top + 1 ? `${el.textContent} bottom ${Math.round(a.bottom)} > banner top ${Math.round(b.top)}` : null;
      });
      expect(hidden).toBeNull();
    }
  });

  test('one tag each: settings from data- attributes, and each loads its own stylesheet', async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('meliora.a11y', JSON.stringify({contrast: true}));
      document.addEventListener('DOMContentLoaded', () => { window.__early = document.documentElement.className; }, {capture: true, once: true});
    });
    await page.goto('/tests/fixtures/one-line.html');
    await expect(page.locator('.a11y-trigger')).toBeVisible();
    await expect(banner(page)).toBeVisible();
    // Settings from the attributes; the boot parts ran in <head>, before the page was parsed.
    expect(await page.evaluate(() => window.__early)).toContain('a11y-contrast');
    expect(await page.evaluate(() => window.MelioraA11yConfig.statementUrl)).toEqual({default: '/accessibility/', he: '/accessibility/he/'});
    expect(await page.evaluate(() => [Object.keys(window.MelioraConsentState.config.categories), window.MelioraConsentState.config.policyVersion, typeof window.dataLayer])).toEqual([['analytics', 'marketing'], '7', 'undefined']);
    await expect(banner(page).getByRole('link', {name: 'Cookie policy'})).toHaveAttribute('href', '/privacy/');
    await expect(banner(page)).toContainText('analytics and marketing');
    expect(await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(l => new URL(l.href).pathname))).toEqual(['/demo/demo.css', '/panel-dist/meliora-a11y.css', '/dist/meliora-consent.css']);
    await axe(page);
    await banner(page).getByRole('button', {name: 'Accept all'}).click();
    await expect.poll(() => ran(page)).toEqual(['analytics']);
  });

  test('one tag each, in Hebrew: per-language links from the attributes', async ({page}) => {
    await page.goto('/tests/fixtures/one-line.html?lang=he');
    await expect(banner(page).getByRole('link', {name: 'מדיניות העוגיות'})).toHaveAttribute('href', '/he/privacy/');
  });

  test('the accessibility menu offers “Cookie settings” and hands focus back correctly', async ({page}) => {
    await page.goto('/tests/fixtures/one-line.html');
    await page.locator('.a11y-trigger').click();
    const panelDialog = page.locator('#a11y-panel');
    await expect(panelDialog).toBeVisible();
    const cookies = panelDialog.getByRole('button', {name: 'Cookie settings'});
    await expect(cookies).toBeVisible();
    await cookies.click();
    await expect(panelDialog).toBeHidden();
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('#mc-dialog-title')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('.a11y-trigger')).toBeFocused();
  });

  test('without the banner, the accessibility menu has no “Cookie settings”', async ({page}) => {
    await page.goto('/tests/fixtures/none.html');
    await page.addScriptTag({url: '/panel-dist/meliora-a11y.js'}).catch(() => {});
    await page.waitForFunction(() => window.MelioraA11y);
    await page.evaluate(() => window.MelioraA11y.open());
    await expect(page.locator('#a11y-panel')).toBeVisible();
    await expect(page.locator('#a11y-panel').getByRole('button', {name: 'Cookie settings'})).toHaveCount(0);
  });

  test('the panel’s High contrast setting applies to the banner and the dialog', async ({page}) => {
    await page.addInitScript(() => localStorage.setItem('meliora.a11y', JSON.stringify({contrast: true})));
    await page.goto(PANEL);
    const colors = loc => loc.evaluate(el => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.borderTopWidth, c.borderTopColor]; });
    expect(await colors(banner(page))).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)', '2px', 'rgb(0, 0, 0)']);
    await banner(page).locator('[data-mc="choose"]').click();
    expect(await colors(dialog(page))).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)', '2px', 'rgb(0, 0, 0)']);
    await axe(page);
  });
});
