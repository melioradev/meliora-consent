<h1 align="center">Meliora Consent</h1>

<p align="center">
  An accessible cookie banner for any website.<br>
  Reject as easy as accept · Google Consent Mode v2 · ten languages · no dependencies · no tracking.
</p>

<p align="center">
  <a href="https://melioradev.github.io/meliora-consent/"><strong>Live demo</strong></a> ·
  <a href="#install">Install</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="docs/screenshots/banner-light.png" width="420" alt="The banner at the bottom-left of a page, with Accept all, Reject all and Choose cookies buttons">
  &nbsp;
  <img src="docs/screenshots/dialog-light.png" width="420" alt="The cookie settings dialog with a switch for each category">
</p>

> **Status: 0.1.0, not yet released.** Every non-English string needs a native speaker's review before launch. Using this banner doesn't make a site compliant by itself, and none of this is legal advice.

---

## What it does

- **Nothing optional runs before a choice.** Analytics, marketing and other third-party scripts stay inert until their category is allowed. Ignoring the banner is not consent.
- **Reject is as easy as accept.** "Accept all", "Reject all" and "Choose cookies" sit together on the first layer, in the same style. There's no × and no "by continuing to browse…".
- **Specific choices.** The settings dialog has a switch per category (functional, analytics, marketing) and lists each category's cookies.
- **Easy to withdraw.** A "Cookie settings" button in your footer reopens the dialog. Turning a category off deletes its declared first-party cookies and reloads the page.
- **Google Consent Mode v2** defaults and updates, set before any Google tag loads.
- **Global Privacy Control** is honored: marketing stays off.
- **Accessible:** keyboard-first, WCAG 2.1 AA, never hides the element that has focus, works at 200% zoom and 320px width. Native `<dialog>` with a focus trap and Esc.
- **Follows the page language** (`<html lang>`) in ten languages, with right-to-left Hebrew and Arabic.
- **Works with the [Meliora accessibility panel](https://github.com/melioradev/meliora-accessibility):** the banner stays clear of its button and follows its High contrast, Stop animations and text size settings.
- **No banner when there's nothing to ask.** With no optional categories configured, it does nothing.

## Install

Copy the four files from `src/` to your site, then add this to `<head>`, **in this order**:

```html
<link rel="stylesheet" href="/consent/meliora-consent.css">
<script src="/consent/config.js"></script>                  <!-- your configuration, below -->
<script src="/consent/meliora-consent-boot.js"></script>     <!-- synchronous: before any tag -->

<!-- Third-party tags go after the boot script, tagged with their category: -->
<script type="text/plain" data-consent="analytics" async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
<script type="text/plain" data-consent="analytics" src="/js/analytics-init.js"></script>

<script src="/consent/meliora-consent-i18n.js" defer></script>
<script src="/consent/meliora-consent.js" defer></script>
```

And a button in your footer, on every page:

```html
<button type="button" data-consent-open hidden>Cookie settings</button>
```

It starts hidden and appears only when there are choices to make, so it never shows without JavaScript.

### Tagging scripts

- `type="text/plain"` makes the browser ignore the script. `data-consent` names its category: `functional`, `analytics` or `marketing` (several, space-separated, means all are needed).
- When the category is allowed, the script is re-created as a real script, in document order. Scripts without `async` keep their order. Use `data-type="module"` for module scripts.
- Use external files. Inline tagged scripts only run if your Content-Security-Policy allows them (a nonce is copied over).
- Add each vendor's domains to your CSP as usual. The banner's own files need nothing beyond `'self'`.

### Embeds

```html
<iframe data-consent="marketing" data-src="https://www.youtube.com/embed/…" data-provider="YouTube"
        title="Product demo video" width="560" height="315"></iframe>
```

Until the category is allowed, a placeholder takes the iframe's place: "This content is from YouTube. Showing it allows marketing cookies.", with "Allow marketing cookies and show" and "Cookie settings" buttons.

## Configuration

```js
window.MelioraConsentConfig = {
  policyUrl: {default: '/privacy/', he: '/he/privacy/'}, // or one URL
  policyVersion: '2026-11-15',      // change it whenever the cookie list or wording changes: everyone is asked again
  necessary: {cookies: [/* listed in the dialog, never blocked */]},
  categories: {                     // only the categories you list appear
    analytics: {
      cookies: [
        {name: '_ga', provider: 'Google Analytics', purpose: {default: 'Tells visitors apart', he: '…'}, duration: {default: '2 years', he: '…'}},
        {name: '_ga_*', provider: 'Google Analytics', purpose: {default: 'Keeps the session state'}, duration: {default: '2 years'}},
      ],
      storageKeys: [],              // localStorage keys to delete when the category is withdrawn
    },
    // functional: {...}, marketing: {...}
  },
  googleConsentMode: true,          // false if you don't use Google tags
  adsDataRedaction: true,
  honorGPC: true,
  renewAfterDays: 365,              // 180 for French audiences (CNIL)
  cookieDomain: null,               // e.g. '.example.com' to share the choice with subdomains
  logEndpoint: null,                // e.g. '/api/consent': see examples/consent-log-worker.mjs
  insertAfter: null,                // CSS selector; default: after the accessibility button, or the skip link
  text: {},                         // string overrides per language, e.g. {he: {title: '…'}, default: {…}}
};
```

Cookie names ending in `*` match by prefix. Every cookie your site sets should be listed: the tests in this repository fail on undeclared cookies, and yours should too.

## Google Consent Mode v2

The boot script calls `gtag('consent', 'default', …)` with everything denied (except `security_storage`) before any Google tag, then `gtag('consent', 'update', …)` with the stored choice. After each choice it sends an update and pushes `{event: 'meliora_consent_update', meliora_consent: {…}}` to the `dataLayer`.

| Category | Consent Mode signals |
|---|---|
| functional | `functionality_storage`, `personalization_storage` |
| analytics | `analytics_storage` |
| marketing | `ad_storage`, `ad_user_data`, `ad_personalization` |

- **Basic mode** (recommended): tag Google's scripts with `data-consent`. Nothing reaches Google before a choice.
- **Advanced mode:** leave Google's scripts untagged. They load at once and send cookieless pings while consent is denied. Whether that's acceptable is a legal decision for the site owner.
- With Google Tag Manager, put the boot script before the container snippet.

## JavaScript API

```js
MelioraConsent.get();              // {functional, analytics, marketing}, or null if undecided
MelioraConsent.has('analytics');   // true or false
MelioraConsent.open();             // opens the settings dialog
MelioraConsent.reset();            // forgets the choice, deletes declared cookies, reloads
document.addEventListener('meliora-consent', e => { /* e.detail: {choices, method, gpc} */ });
```

`<html data-consent="analytics marketing">` lists the allowed categories, for CSS.

## How the choice is stored

`localStorage` key `meliora.consent`:

```json
{"v":1,"id":"5f0c…","policy":"2026-11-15","ts":"2026-11-15T12:00:00.000Z","method":"custom","gpc":false,
 "choices":{"functional":false,"analytics":true,"marketing":false}}
```

The visitor is asked again when `policyVersion` changes, a category is added, or the choice is older than `renewAfterDays`. If storage is blocked, the choice lasts for the current page only.

## With the Meliora accessibility panel

- The panel's button is bottom-right, and the banner is a card at the bottom-left. When there isn't room for both side by side, the banner becomes a full-width sheet and sets `--meliora-consent-inset` so the panel's button moves above it (needs a meliora-accessibility version after 1.0.0).
- Tab order: skip link → accessibility button → its × → banner.
- High contrast, Stop animations and text size from the panel apply to the banner and the dialog.

## Accessibility

- Banner: a named region, early in the reading order, not focused or announced on load (it doesn't interrupt). After a choice, "Cookie choices saved" is announced and focus moves to `<main>`.
- Dialog: native `<dialog>`, focus starts on its title, Esc closes it without saving, and focus returns to the button that opened it.
- Switches are `<button aria-pressed>`. The knob position, not only its color, shows the state.
- Focus is never hidden behind the banner (WCAG 2.2, 2.4.11), and a spacer at the end of the page lets the last content scroll above it.
- All buttons are at least 44×44 px. The banner is never more than half the screen high.

## Languages

English · Arabic · Chinese (Simplified) · French · German · Hebrew · Italian · Russian · Spanish · Ukrainian

The banner uses the page's `<html lang>` and falls back to English. Strings are in `src/meliora-consent-i18n.js`.

## Development

```sh
npm install
npm run serve          # demo at http://127.0.0.1:8790/
npm run check          # syntax check
npx playwright test    # browser tests (Chromium, Firefox, WebKit)
```

The tests serve every page with a strict Content-Security-Policy and fail on any CSP violation or page error. The tests that run with the accessibility panel need a checkout of `meliora-accessibility` next to this repository, and are skipped otherwise.

## Not included

IAB TCF, regional variants by geolocation, automatic blocking of untagged scripts, a hosted cookie scanner, and US "Do Not Sell or Share" flows beyond honoring GPC.

## License

MIT with visible attribution: the "Made by Meliora Novotech Ltd" credit in the settings dialog must stay. See [LICENSE](LICENSE).
