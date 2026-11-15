# Changelog

## 0.2.0 — 2026-11-15

- **One-line install:** `dist/meliora-consent.js` is the whole banner in one file. The stored choice and Consent Mode defaults apply at once, before any tag; the banner is built when the page is parsed; `meliora-consent.css` loads from next to the file. Settings can come from `data-` attributes on the script tag (`data-categories`, `data-policy`, `data-policy-<lang>`, `data-policy-version`, `data-consent-mode`, `data-gpc`, `data-renew-days`, `data-cookie-domain`, `data-log`, `data-insert-after`, `data-css="none"`). `window.MelioraConsentConfig` still works and wins over the attributes. The separate files in `src/` still work.
- `npm run build` regenerates `dist/`; `npm run check` fails when it is out of date.
- Meliora Accessibility 1.1.0 shows a "Cookie settings" button in its menu when this banner is on the page.
- The demo page uses the one-file build and has a snippet builder for the install.
- Tests: the whole suite now runs against the one-file build, plus tests for both packages installed with one tag each.

## 0.1.0 — 2026-11-15

First version, built to the spec in `COOKIE-CONSENT.md` (melioradev/meliora-landing).

- Banner with Accept all, Reject all and Choose cookies, all in the same style. No ×; ignoring the banner is not consent.
- Settings dialog: one switch per category (functional, analytics, marketing), "Always on" for necessary, cookie lists, Save / Reject all / Accept all.
- Tagged scripts (`type="text/plain" data-consent`) and embeds (`iframe data-consent data-src`) are released only after consent, in document order. Embeds get an accessible placeholder.
- Withdrawing a category deletes its declared first-party cookies and storage keys, then reloads.
- Google Consent Mode v2 defaults and updates, `ads_data_redaction`, and a `meliora_consent_update` dataLayer event.
- Global Privacy Control keeps marketing off.
- Choice stored in `localStorage` (`meliora.consent`), asked again on a new policy version, a new category, or after 365 days. Optional cookie for subdomains and optional consent log (example Cloudflare Worker with D1).
- Works with the Meliora accessibility panel: card beside its button, or a sheet that lifts it; follows its High contrast, Stop animations and text size settings.
- Focus never hidden behind the banner; spacer at the end of the page while it shows.
- Ten languages, following the page's `<html lang>`. Non-English strings need a native speaker's review.
- Works under a strict Content-Security-Policy (no inline scripts or styles).
