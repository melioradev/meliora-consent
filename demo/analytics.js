// Demo stand-in for an analytics tag: records that it ran and sets two first-party cookies.
(window.__demoRan = window.__demoRan || []).push('analytics');
document.cookie = '_demo_ga=1; path=/; max-age=3600; SameSite=Lax';
document.cookie = '_demo_ga_A1B2=1; path=/; max-age=3600; SameSite=Lax';
