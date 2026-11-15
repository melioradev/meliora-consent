/* Demo configuration. A real site lists its own categories and cookies here. */
window.MelioraConsentConfig = {
  policyUrl: '#cookie-policy',
  policyVersion: '2026-11-15',
  necessary: {
    cookies: [
      {name: 'meliora.consent', provider: 'This site', purpose: {default: 'Remembers your cookie choices (browser storage, not a cookie)', he: 'זוכרת את בחירות העוגיות שלך (אחסון בדפדפן, לא עוגייה)'}, duration: {default: '1 year', he: 'שנה'}},
    ],
  },
  categories: {
    functional: {
      cookies: [{name: 'demo.chat', provider: 'Example Chat', purpose: {default: 'Keeps the chat window open between pages', he: 'שומרת את חלון הצ׳אט פתוח בין דפים'}, duration: {default: 'Until cleared', he: 'עד למחיקה'}}],
      storageKeys: ['demo.chat'],
    },
    analytics: {
      cookies: [
        {name: '_demo_ga', provider: 'Example Analytics', purpose: {default: 'Tells visitors apart', he: 'מבדילה בין מבקרים'}, duration: {default: '1 hour (demo)', he: 'שעה (הדגמה)'}},
        {name: '_demo_ga_*', provider: 'Example Analytics', purpose: {default: 'Keeps the session state', he: 'שומרת את מצב הביקור'}, duration: {default: '1 hour (demo)', he: 'שעה (הדגמה)'}},
      ],
    },
    marketing: {
      cookies: [{name: '_demo_ads', provider: 'Example Ads', purpose: {default: 'Measures clicks on ads', he: 'מודדת הקלקות על מודעות'}, duration: {default: '1 hour (demo)', he: 'שעה (הדגמה)'}}],
    },
  },
  googleConsentMode: true,
  logEndpoint: null,
};
