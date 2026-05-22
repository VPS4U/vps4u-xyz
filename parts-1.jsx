// ============================================================
// parts-1: Ticker, Nav, Hero, Configurator
// ============================================================
const { useState, useEffect, useMemo, useRef } = React;

function Ticker({ items }) {
  const doubled = [...items, ...items, ...items];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {doubled.map((s, i) => (
          <span key={i}>{s}<span className="dot"> ◆</span></span>
        ))}
      </div>
    </div>
  );
}

function Nav({ t, lang, setLang }) {
  return (
    <nav className="nav">
      <div className="wrap nav-row">
        <a href="index.html" className="logo">
          <span className="badge">v4</span>
          <span>VPS4U<span style={{color:'var(--accent)'}}>.</span>xyz</span>
        </a>
        <div className="nav-links">
          <a href="#config">{t.nav.vps}</a>
          <a href="#services">{t.nav.services}</a>
          <a href="#pricing">{t.nav.pricing}</a>
          <a href="o-mnie.html">{lang==='pl'?'O mnie':'About'}</a>
          <a href="#blog">{t.nav.blog}</a>
        </div>
        <div className="nav-right">
          <div className="lang">
            <button className={lang==='pl'?'active':''} onClick={()=>setLang('pl')}>PL</button>
            <button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button>
          </div>
          <a href="logowanie.html" className="btn" style={{padding:'8px 14px', fontSize:13}}>{t.nav.login}</a>
          <a href="rejestracja.html" className="btn btn-primary" style={{padding:'8px 14px', fontSize:13}}>{t.nav.signup}</a>
        </div>
      </div>
    </nav>
  );
}

function Hero({ t }) {
  return (
    <section className="hero wrap">
      <div className="hero-grid">
        <div>
          <span className="eyebrow"><span className="dot"></span>{t.hero.eyebrow}</span>
          <h1 className="h1">
            {t.hero.titlePre}<br/>
            <span className="stroke">{t.hero.titleMid}</span> <em>{t.hero.titleEm}</em>
          </h1>
          <p className="hero-sub">{t.hero.sub}</p>
          <div className="hero-cta">
            <a href="#pricing" className="btn btn-primary btn-lg">{t.hero.ctaPrimary} →</a>
            <a href="#pricing" className="btn btn-lg">{t.hero.ctaSecondary}</a>
          </div>
          <div className="hero-meta">
            {t.hero.meta.map((m,i)=>(
              <div key={i}>
                <div className="big">{m.big}</div>
                <div className="lbl">{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <Configurator t={t} />
      </div>
    </section>
  );
}

const CPU_OPTS = [1, 2, 4, 6, 8, 12, 16, 24];
const RAM_OPTS = [1, 2, 4, 8, 16, 32, 64, 128];
const DISK_OPTS = [20, 40, 80, 160, 240, 480, 960, 1920];

function Configurator({ t }) {
  const [cpuI, setCpuI] = useState(2);   // 4 vCPU
  const [ramI, setRamI] = useState(3);   // 8 GB
  const [diskI, setDiskI] = useState(4); // 240 GB
  const [os, setOs] = useState(0);
  const [loc, setLoc] = useState(1);
  const [bill, setBill] = useState(1);
  const [addons, setAddons] = useState({});

  const cpu = CPU_OPTS[cpuI];
  const ram = RAM_OPTS[ramI];
  const disk = DISK_OPTS[diskI];

  const basePrice = useMemo(() => {
    // simple linear model
    return Math.round(cpu * 3.2 + ram * 1.1 + disk * 0.06 + 2);
  }, [cpu, ram, disk]);

  const addonPrices = { backup: 2, ddos: 3, ipv4: 1, panel: 8 };
  const addonCost = Object.entries(addons).reduce((s, [k, v]) => v ? s + addonPrices[k] : s, 0);
  const monthly = basePrice + addonCost;

  let display = monthly;
  let displayUnit = t.cfg.totalPer;
  if (bill === 0) { display = (monthly / 720).toFixed(3); displayUnit = bill === 0 ? (t === window.I18N.pl ? 'godzinowo • bez VAT' : 'hourly • VAT excl.') : displayUnit; }
  if (bill === 2) { display = Math.round(monthly * 12 * 0.8); displayUnit = (t === window.I18N.pl ? 'rocznie • oszczędzasz 20%' : 'yearly • saving 20%'); }

  return (
    <div className="config" id="config">
      <div className="config-head">
        <span>{t.cfg.head}</span>
        <div className="dots"><span></span><span></span><span></span></div>
      </div>
      <div className="config-body">
        <div className="cfg-row">
          <span className="label">{t.cfg.cpu}</span>
          <span className="value">{cpu}<span className="unit">vCPU</span></span>
        </div>
        <input type="range" min={0} max={CPU_OPTS.length-1} value={cpuI} step={1} onChange={e=>setCpuI(+e.target.value)} className="cfg-slider"/>

        <div className="cfg-row">
          <span className="label">{t.cfg.ram}</span>
          <span className="value">{ram}<span className="unit">GB</span></span>
        </div>
        <input type="range" min={0} max={RAM_OPTS.length-1} value={ramI} step={1} onChange={e=>setRamI(+e.target.value)} className="cfg-slider"/>

        <div className="cfg-row">
          <span className="label">{t.cfg.disk}</span>
          <span className="value">{disk}<span className="unit">GB NVMe</span></span>
        </div>
        <input type="range" min={0} max={DISK_OPTS.length-1} value={diskI} step={1} onChange={e=>setDiskI(+e.target.value)} className="cfg-slider"/>

        <div className="cfg-row" style={{marginTop:6}}>
          <span className="label">{t.cfg.loc}</span>
          <span className="value" style={{fontSize:14, fontFamily:"'JetBrains Mono', monospace"}}>{t.cfg.locOpts[loc]}</span>
        </div>
        <div className="cfg-pillrow">
          {t.cfg.locOpts.map((o,i)=>(
            <button key={i} className={loc===i?'on':''} onClick={()=>setLoc(i)}>{o}</button>
          ))}
        </div>

        <div className="cfg-row">
          <span className="label">{t.cfg.bill}</span>
        </div>
        <div className="cfg-pillrow">
          {t.cfg.billOpts.map((o,i)=>(
            <button key={i} className={bill===i?'on':''} onClick={()=>setBill(i)}>{o}</button>
          ))}
        </div>

        <div className="cfg-row" style={{marginTop:6}}>
          <span className="label">{t.cfg.addons}</span>
        </div>
        <div className="cfg-toggles">
          {t.cfg.addonsList.map(a => (
            <label key={a.id} className="cfg-toggle">
              <span className="lt">
                <input type="checkbox" checked={!!addons[a.id]} onChange={e=>setAddons(s=>({...s,[a.id]:e.target.checked}))}/>
                {a.l}
              </span>
              <span className="price">{a.p}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="config-foot">
        <div className="price-total">
          <span className="big"><span className="cur">€</span>{display}</span>
          <span className="sub">{displayUnit}</span>
        </div>
        <button className="btn btn-ink btn-lg">{t.cfg.cta} →</button>
      </div>
    </div>
  );
}

function TrustBar({ t }) {
  return (
    <div className="trustbar">
      <div className="wrap trustbar-row">
        <span className="label">{t.trust.label} ↓</span>
        <div className="trust-logos">
          {t.trust.brands.map((b,i)=>(<span key={i}>{b}</span>))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Ticker, Nav, Hero, Configurator, TrustBar });
