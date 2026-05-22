// ============================================================
// cookie-banner.js — minimum-fuss cookie consent (RODO / ePrivacy).
// Shown once until accepted; choice stored in localStorage.
// ============================================================
(function() {
  const KEY = 'vps4u.cookies';
  function getLang() {
    try { return localStorage.getItem('vps4u.lang') || 'pl'; } catch(e) { return 'pl'; }
  }
  function getChoice() {
    try { return localStorage.getItem(KEY); } catch(e) { return null; }
  }
  function setChoice(v) {
    try { localStorage.setItem(KEY, v); } catch(e) {}
  }

  const COPY = {
    pl: {
      title: "Ciasteczka & prywatność",
      body: "Używam tylko ciasteczek niezbędnych do działania strony (sesja, język) oraz analityki Plausible — która <strong>nie używa ciasteczek</strong>. Nie ma Google Analytics, nie ma Pixela, nie ma trackerów reklamowych. Możesz zaakceptować wszystko jednym kliknięciem.",
      acceptAll: "Akceptuję wszystko",
      essentialOnly: "Tylko niezbędne",
      more: "Polityka prywatności →",
    },
    en: {
      title: "Cookies & privacy",
      body: "I only use cookies that are strictly required to run the site (session, language) plus Plausible analytics — which <strong>does not use cookies</strong>. No Google Analytics, no Pixel, no ad trackers. You can accept everything with one click.",
      acceptAll: "Accept all",
      essentialOnly: "Essential only",
      more: "Privacy policy →",
    },
  };

  function render() {
    if (getChoice()) return;
    const lang = getLang();
    const c = COPY[lang] || COPY.pl;

    const el = document.createElement('div');
    el.className = 'cookie-banner';
    el.innerHTML = `
      <div class="cookie-inner">
        <div class="cookie-text">
          <div class="cookie-title">
            <span class="cookie-icon">🍪</span>
            ${c.title}
          </div>
          <p>${c.body}</p>
          <a href="polityka-prywatnosci.html" class="cookie-more">${c.more}</a>
        </div>
        <div class="cookie-actions">
          <button class="btn cookie-essential" type="button">${c.essentialOnly}</button>
          <button class="btn btn-primary cookie-all" type="button">${c.acceptAll}</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    el.querySelector('.cookie-all').addEventListener('click', () => { setChoice('all'); dismiss(el); });
    el.querySelector('.cookie-essential').addEventListener('click', () => { setChoice('essential'); dismiss(el); });
  }

  function dismiss(el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
