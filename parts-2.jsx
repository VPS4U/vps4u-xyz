// ============================================================
// parts-2: SectionHead, Stack, Pricing, Services
// ============================================================

function SectionHead({ num, title, lede, right }) {
  return (
    <div className="section-head">
      <div style={{flex:1, minWidth:320}}>
        <div className="section-num">{num}</div>
        <h2 className="section-title">
          {title.map((p,i)=> typeof p === 'string' ? <span key={i}>{p}</span> : <em key={i}>{p.i}</em>)}
        </h2>
      </div>
      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:14, maxWidth:480}}>
        {lede && <p className="section-lede" style={{margin:0}}>{lede}</p>}
        {right}
      </div>
    </div>
  );
}

function Stack({ t }) {
  return (
    <section className="section wrap">
      <SectionHead num={t.stack.num} title={t.stack.title} lede={t.stack.lede} />
      <div className="stack-grid">
        {t.stack.items.map((it, i) => (
          <div className="stack-cell" key={i}>
            <span className="num mono">{String(i+1).padStart(2,'0')}</span>
            <div className="ico">
              <StackIcon i={i}/>
            </div>
            <h3>{it.t}</h3>
            <p>{it.d}</p>
            <div className="mono" style={{marginTop:14, fontSize:11, color:'var(--accent)', letterSpacing:'.08em'}}>{it.n}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StackIcon({ i }) {
  // 8 distinct geometric/editorial mini-icons drawn in SVG
  const stroke = "var(--ink)";
  const acc = "var(--accent)";
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (i) {
    case 0: // NVMe — chip with bars
      return <svg {...common}><rect x="3.5" y="6.5" width="17" height="11" rx="1"/><line x1="7" y1="9.5" x2="17" y2="9.5" stroke={acc}/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="14.5" x2="13" y2="14.5"/><line x1="6" y1="6.5" x2="6" y2="4"/><line x1="10" y1="6.5" x2="10" y2="4"/><line x1="14" y1="6.5" x2="14" y2="4"/><line x1="18" y1="6.5" x2="18" y2="4"/></svg>;
    case 1: // KVM — nested squares
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17"/><rect x="7" y="7" width="10" height="10" stroke={acc}/><rect x="10" y="10" width="4" height="4"/></svg>;
    case 2: // EPYC — CPU
      return <svg {...common}><rect x="6" y="6" width="12" height="12"/><line x1="9" y1="6" x2="9" y2="3"/><line x1="12" y1="6" x2="12" y2="3"/><line x1="15" y1="6" x2="15" y2="3"/><line x1="9" y1="21" x2="9" y2="18"/><line x1="12" y1="21" x2="12" y2="18"/><line x1="15" y1="21" x2="15" y2="18"/><line x1="6" y1="9" x2="3" y2="9"/><line x1="6" y1="12" x2="3" y2="12"/><line x1="6" y1="15" x2="3" y2="15"/><line x1="21" y1="9" x2="18" y2="9"/><line x1="21" y1="12" x2="18" y2="12"/><line x1="21" y1="15" x2="18" y2="15"/><circle cx="12" cy="12" r="2.5" stroke={acc}/></svg>;
    case 3: // 10G — globe + arrow
      return <svg {...common}><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3.5" ry="8"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M14 8l3 3-3 3" stroke={acc}/></svg>;
    case 4: // DDoS — shield + check
      return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5L16 9" stroke={acc}/></svg>;
    case 5: // Backup — clock arrow
      return <svg {...common}><path d="M3 12a9 9 0 1 0 3.5-7.1"/><polyline points="3 4 3 8 7 8" stroke={acc}/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/></svg>;
    case 6: // API — code brackets
      return <svg {...common}><polyline points="8 7 3 12 8 17" stroke={acc}/><polyline points="16 7 21 12 16 17" stroke={acc}/><line x1="14" y1="5" x2="10" y2="19"/></svg>;
    case 7: // Support — chat
      return <svg {...common}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 3v6h-6" stroke={acc}/><circle cx="9" cy="13" r=".7" fill={stroke}/><circle cx="12" cy="13" r=".7" fill={stroke}/><circle cx="15" cy="13" r=".7" fill={stroke}/></svg>;
    default: return null;
  }
}

function Pricing({ t }) {
  const [yearly, setYearly] = useState(false);
  return (
    <section className="section wrap" id="pricing">
      <SectionHead
        num={t.pricing.num}
        title={t.pricing.title}
        lede={t.pricing.lede}
        right={
          <div className="pricing-toggle">
            <button className={!yearly?'on':''} onClick={()=>setYearly(false)}>{t.pricing.toggle.m}</button>
            <button className={yearly?'on':''} onClick={()=>setYearly(true)}>{t.pricing.toggle.y}<span className="save">{t.pricing.toggle.save}</span></button>
          </div>
        }
      />
      <div className="plans">
        {t.pricing.plans.map((p, i) => {
          const price = yearly ? (p.price * 0.8).toFixed(0) : p.price;
          return (
            <div key={i} className={"plan" + (p.featured ? " featured" : "")}>
              {p.featured && <div className="plan-tag">{t.pricing.featured}</div>}
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">
                <span className="cur">€</span>
                <span className="amt">{price}</span>
                <span className="per">{t.pricing.perMo}</span>
              </div>
              <div className="plan-specs">
                <div className="plan-spec"><span>CPU</span><b>{p.cpu}</b></div>
                <div className="plan-spec"><span>RAM</span><b>{p.ram}</b></div>
                <div className="plan-spec"><span>NVMe</span><b>{p.disk}</b></div>
                <div className="plan-spec"><span>NET</span><b>{p.net}</b></div>
              </div>
              <ul className="feat-list">
                {p.feats.map(fi => (<li key={fi}>{t.pricing.features[fi]}</li>))}
              </ul>
              <a href={p.stripe || "rejestracja.html"} target={p.stripe ? "_blank" : undefined} rel={p.stripe ? "noopener" : undefined} className={"btn " + (p.featured ? "btn-primary" : "")}>{t.pricing.cta} →</a>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Services({ t }) {
  return (
    <section className="section wrap" id="services">
      <SectionHead num={t.svc.num} title={t.svc.title} lede={t.svc.lede} />
      <div className="svc-grid">
        {t.svc.items.map((it, i) => (
          <div className="svc" key={i}>
            <div className="svc-hero">
              <ServiceArt art={it.art} />
            </div>
            <span className="svc-tag">{it.tag}</span>
            <h3>{it.title}</h3>
            <p>{it.desc}</p>
            <a href="rejestracja.html" className="svc-link">{it.link} →</a>
          </div>
        ))}
      </div>
    </section>
  );
}

function ServiceArt({ art }) {
  if (art === "wp") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 280 160" preserveAspectRatio="xMidYMid meet">
        <rect x="20" y="22" width="240" height="116" fill="var(--cream)" stroke="var(--ink)" strokeWidth="1.5"/>
        <rect x="20" y="22" width="240" height="14" fill="var(--ink)"/>
        <circle cx="30" cy="29" r="2" fill="var(--accent)"/>
        <circle cx="38" cy="29" r="2" fill="var(--cream)" opacity=".4"/>
        <circle cx="46" cy="29" r="2" fill="var(--cream)" opacity=".4"/>
        <rect x="34" y="48" width="100" height="10" fill="var(--ink)"/>
        <rect x="34" y="64" width="140" height="3" fill="var(--ink-2)" opacity=".5"/>
        <rect x="34" y="71" width="120" height="3" fill="var(--ink-2)" opacity=".5"/>
        <rect x="34" y="88" width="60" height="22" fill="var(--accent)"/>
        <text x="42" y="103" fontFamily="JetBrains Mono" fontSize="9" fill="#fff" fontWeight="700">BUY NOW</text>
        <rect x="190" y="50" width="56" height="68" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5"/>
        <text x="218" y="92" textAnchor="middle" fontFamily="Archivo Black" fontSize="28" fill="var(--ink)">W</text>
      </svg>
    );
  }
  if (art === "game") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 280 160" preserveAspectRatio="xMidYMid meet">
        <rect x="20" y="22" width="240" height="116" fill="#1a1a14" stroke="var(--ink)" strokeWidth="1.5"/>
        {/* minecraft-ish blocks */}
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
          const x = 30 + (i%6)*38;
          const y = 36 + Math.floor(i/6)*38;
          const colors = ['#5fa84a','#7d5a3c','#5fa84a','#7d5a3c','#7d5a3c','#5fa84a','#7d5a3c','#5fa84a','#7d5a3c','#5fa84a','#7d5a3c','#5fa84a'];
          return <g key={i}>
            <rect x={x} y={y} width="34" height="34" fill={colors[i]} stroke="var(--ink)" strokeWidth="1"/>
            <rect x={x+3} y={y+3} width="6" height="6" fill={colors[i]} opacity=".5"/>
          </g>;
        })}
        <rect x="30" y="116" width="220" height="18" fill="var(--accent)"/>
        <text x="140" y="129" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="#fff" fontWeight="700">► JOIN GAME · 12 / 32 ONLINE</text>
      </svg>
    );
  }
  if (art === "domain") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 280 160" preserveAspectRatio="xMidYMid meet">
        <rect x="20" y="58" width="240" height="44" fill="var(--cream)" stroke="var(--ink)" strokeWidth="1.5"/>
        <text x="30" y="86" fontFamily="JetBrains Mono" fontSize="16" fill="var(--ink)" fontWeight="700">twoja-domena</text>
        <text x="160" y="86" fontFamily="JetBrains Mono" fontSize="16" fill="var(--accent)" fontWeight="700">.xyz</text>
        <rect x="226" y="68" width="24" height="24" fill="var(--ink)"/>
        <path d="M232 80 l4 4 l8 -8" stroke="var(--accent)" strokeWidth="2" fill="none"/>
        <text x="30" y="124" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)">SSL ACTIVE · LET'S ENCRYPT · RENEWS AUTO</text>
        <g transform="translate(28, 36)">
          {['.pl','.com','.dev','.io','.app','.xyz'].map((tld, i) => (
            <g key={i} transform={`translate(${i*42}, 0)`}>
              <rect width="36" height="16" fill="none" stroke="var(--ink)" strokeWidth="1"/>
              <text x="18" y="12" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink)" fontWeight="600">{tld}</text>
            </g>
          ))}
        </g>
      </svg>
    );
  }
  return null;
}

Object.assign(window, { SectionHead, Stack, Pricing, Services, StackIcon, ServiceArt });
