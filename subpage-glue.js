// ============================================================
// subpage-glue.js — runs on all static subpages.
//   - populates the ticker
//   - PL/EN language toggle (stored in localStorage)
//   - spam-protected email assembly
// ============================================================
(function() {
  // ----- TICKER -----
  const tickerItems = {
    pl: [
      "99.99% UPTIME", "INFRASTRUKTURA • CONTABO • DE / USA / SG",
      "NVMe GEN4 W STANDARDZIE", "DDOS PROTECTION 24/7",
      "API + TERRAFORM", "WSPARCIE PO POLSKU", "ROZLICZENIE GODZINOWE",
    ],
    en: [
      "99.99% UPTIME", "INFRASTRUCTURE • CONTABO • DE / US / SG",
      "NVMe GEN4 BY DEFAULT", "DDOS PROTECTION 24/7",
      "API + TERRAFORM", "POLISH-SPEAKING SUPPORT", "HOURLY BILLING",
    ],
  };
  function paintTicker(lang) {
    const el = document.getElementById('ticker');
    if (!el) return;
    const items = tickerItems[lang] || tickerItems.pl;
    const doubled = [...items, ...items, ...items];
    el.innerHTML = doubled.map(s => `<span>${s}<span class="dot"> ◆</span></span>`).join('');
  }

  // ----- EMAIL ASSEMBLY -----
  function assembleEmails() {
    document.querySelectorAll('.js-mail').forEach(a => {
      const u = a.dataset.u, d = a.dataset.d;
      if (!u || !d) return;
      const addr = u + '@' + d;
      a.setAttribute('href', 'mailto:' + addr);
      // Only replace text if the element currently shows the obfuscated fallback
      const fb = a.querySelector('.email-fallback');
      if (fb) fb.textContent = addr;
    });
  }

  // ----- I18N -----
  // Pages register their EN dict via window.I18N_SUB[pageName].en = {...}
  const pageName = document.body.dataset.page || 'about';
  const dicts = (window.I18N_SUB && window.I18N_SUB[pageName]) || { en: {} };

  // Snapshot PL originals once.
  const snapshot = new Map();
  function snap() {
    document.querySelectorAll('[data-i]').forEach(el => {
      if (!snapshot.has(el)) snapshot.set(el, el.innerHTML);
    });
  }
  function applyLang(lang) {
    snap();
    document.querySelectorAll('[data-i]').forEach(el => {
      const key = el.dataset.i;
      if (lang === 'pl') {
        el.innerHTML = snapshot.get(el);
      } else {
        const v = dicts.en[key];
        if (v != null) el.innerHTML = v;
      }
    });
    document.documentElement.lang = lang;
    document.getElementById('lang-pl').classList.toggle('active', lang === 'pl');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    paintTicker(lang);
    try { localStorage.setItem('vps4u.lang', lang); } catch(e){}
  }

  // ----- INIT -----
  document.addEventListener('DOMContentLoaded', () => {
    let initial = 'pl';
    try { initial = localStorage.getItem('vps4u.lang') || 'pl'; } catch(e){}
    applyLang(initial);
    assembleEmails();

    document.getElementById('lang-pl')?.addEventListener('click', () => applyLang('pl'));
    document.getElementById('lang-en')?.addEventListener('click', () => applyLang('en'));

    // Active TOC highlighting (privacy page)
    const toc = document.querySelectorAll('.legal-toc li[data-target]');
    if (toc.length) {
      toc.forEach(li => li.addEventListener('click', () => {
        const id = li.dataset.target;
        const target = document.getElementById(id);
        if (target) {
          const top = target.getBoundingClientRect().top + window.pageYOffset - 90;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }));
      const sections = document.querySelectorAll('.legal-body section[id]');
      const onScroll = () => {
        let activeId = null;
        sections.forEach(sec => {
          const r = sec.getBoundingClientRect();
          if (r.top < 140) activeId = sec.id;
        });
        toc.forEach(li => li.classList.toggle('active', li.dataset.target === activeId));
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });
})();
