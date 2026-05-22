// ============================================================
// parts-3: Savings calc, Testimonials, Dashboard, Blog, FAQ, CTA, Footer
// ============================================================

function Savings({ t }) {
  const [provider, setProvider] = useState(0);
  const [cpu, setCpu] = useState(4);
  const [ram, setRam] = useState(8);
  const [disk, setDisk] = useState(120);

  // hypothetical monthly costs
  const multipliers = [
    { aws: 12.0, doo: 6.5, us: 2.6 },   // AWS
    { aws: 11.5, doo: 6.5, us: 2.6 },   // GCP
    { aws: 6.5, doo: 6.5, us: 2.6 },    // DO
    { aws: 6.8, doo: 6.4, us: 2.6 },    // Linode
    { aws: 12.5, doo: 6.5, us: 2.6 },   // Azure
  ];
  const m = multipliers[provider];
  const base = cpu * 1.6 + ram * 0.7 + disk * 0.04;
  const awsCost = Math.round(base * m.aws);
  const doCost = Math.round(base * m.doo);
  const usCost = Math.round(base * m.us);
  const max = Math.max(awsCost, doCost, usCost);
  const yearly = (awsCost - usCost) * 12;

  return (
    <section className="section wrap">
      <SectionHead num={t.sav.num} title={t.sav.title} lede={t.sav.lede} />
      <div className="savings">
        <div className="savings-l">
          <div className="sv-input">
            <span className="sv-label">{t.sav.labels.cur}</span>
            <select value={provider} onChange={e=>setProvider(+e.target.value)}>
              {t.sav.cur.map((c,i)=>(<option key={i} value={i}>{c}</option>))}
            </select>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14}}>
            <div className="sv-input">
              <span className="sv-label">{t.sav.labels.cpu}</span>
              <input type="number" value={cpu} min={1} max={64} onChange={e=>setCpu(Math.max(1, +e.target.value || 1))}/>
            </div>
            <div className="sv-input">
              <span className="sv-label">{t.sav.labels.ram}</span>
              <input type="number" value={ram} min={1} max={256} onChange={e=>setRam(Math.max(1, +e.target.value || 1))}/>
            </div>
            <div className="sv-input">
              <span className="sv-label">{t.sav.labels.disk}</span>
              <input type="number" value={disk} min={20} max={4000} step={20} onChange={e=>setDisk(Math.max(20, +e.target.value || 20))}/>
            </div>
          </div>
          <div className="sv-bars" style={{marginTop:8}}>
            <div className="sv-bar" style={{color:'var(--ink)'}}>
              <span className="lab" style={{color:'var(--ink-2)'}}>{t.sav.bars.aws}</span>
              <span className="track" style={{background:'var(--cream-2)', borderColor:'var(--ink)'}}><span className="fill" style={{width:`${awsCost/max*100}%`, background:'var(--ink)'}}></span></span>
              <span className="amt">€{awsCost}/mo</span>
            </div>
            <div className="sv-bar" style={{color:'var(--ink)'}}>
              <span className="lab" style={{color:'var(--ink-2)'}}>{t.sav.bars.do}</span>
              <span className="track" style={{background:'var(--cream-2)', borderColor:'var(--ink)'}}><span className="fill" style={{width:`${doCost/max*100}%`, background:'var(--ink-2)'}}></span></span>
              <span className="amt">€{doCost}/mo</span>
            </div>
            <div className="sv-bar ours" style={{color:'var(--ink)'}}>
              <span className="lab" style={{color:'var(--accent)'}}>{t.sav.bars.us}</span>
              <span className="track" style={{background:'var(--cream-2)', borderColor:'var(--ink)'}}><span className="fill" style={{width:`${usCost/max*100}%`, background:'var(--accent)'}}></span></span>
              <span className="amt"><b>€{usCost}/mo</b></span>
            </div>
          </div>
        </div>
        <div className="savings-r">
          <span className="sv-label" style={{color:'#8a8578'}}>{t.sav.labels.out}</span>
          <div className="savings-big" style={{marginTop:14}}>
            €{yearly.toLocaleString('pl-PL')}
            <small>{t.sav.sub}</small>
          </div>
          <div style={{marginTop:32, display:'flex', flexDirection:'column', gap:12}}>
            <div style={{fontFamily:"'JetBrains Mono', monospace", fontSize:12, color:'#a8a299', lineHeight:1.7}}>
              <div>// Twoja konfiguracja:</div>
              <div>$ vps4u plan --cpu {cpu} --ram {ram}G --disk {disk}G</div>
              <div style={{color:'var(--accent)'}}>→ ROCZNIE TANIEJ O €{yearly}</div>
            </div>
            <a href="rejestracja.html" className="btn btn-primary btn-lg" style={{alignSelf:'flex-start', marginTop:8}}>{t.sav.cta} →</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials({ t }) {
  return (
    <section className="section wrap">
      <SectionHead num={t.test.num} title={t.test.title} lede={t.test.lede} />
      <div className="t-grid">
        {t.test.items.map((tm, i) => (
          <div className="t-card" key={i}>
            <div className="t-stars">★★★★★</div>
            <p className="t-quote">{tm.q}</p>
            <div className="t-author">
              <div className="t-avatar">{tm.a}</div>
              <div>
                <div className="t-name">{tm.n}</div>
                <div className="t-role">{tm.r}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ t }) {
  // Live-ish bouncing chart
  const [tick, setTick] = useState(0);
  useEffect(()=>{
    const id = setInterval(()=>setTick(x=>x+1), 1200);
    return ()=>clearInterval(id);
  }, []);
  // Generate chart pts deterministically per tick
  const pts = useMemo(()=>{
    const n = 36;
    return Array.from({length:n}, (_,i)=>{
      const x = (i/(n-1))*100;
      const y = 50 + Math.sin((i+tick)*0.4)*18 + Math.sin((i+tick)*0.13)*10 + (Math.sin(i*0.7+tick)*4);
      return [x, y];
    });
  }, [tick]);
  const path = pts.map((p,i)=> (i?'L':'M')+p[0]+','+p[1]).join(' ');
  const area = path + ` L100,100 L0,100 Z`;

  return (
    <section className="section wrap" id="panel">
      <SectionHead num={t.dash.num} title={t.dash.title} lede={t.dash.lede} />
      <div className="dash">
        <div className="dash-bar">
          <span className="ddot r"></span><span className="ddot y"></span><span className="ddot g"></span>
          <span className="url">{t.dash.url}</span>
          <span style={{width:60}}></span>
        </div>
        <div className="dash-body">
          <aside className="dash-side">
            <div className="group">{t.dash.side.g1}</div>
            {t.dash.side.a.map((s,i)=>(<span key={i} className={"dash-link " + (i===0?'active':'')}>{s}</span>))}
            <div className="group">{t.dash.side.g2}</div>
            {t.dash.side.b.map((s,i)=>(<span key={i} className="dash-link">{s}</span>))}
            <div className="group">{t.dash.side.g3}</div>
            {t.dash.side.c.map((s,i)=>(<span key={i} className="dash-link">{s}</span>))}
          </aside>
          <main className="dash-main">
            <div className="dash-h">
              <h4>{t.dash.title2}</h4>
              <span className="dash-pill">{t.dash.status}</span>
            </div>
            <div className="dash-stats">
              {t.dash.stats.map((s,i)=>(
                <div className="dash-stat" key={i}>
                  <div className="l">{s.l}</div>
                  <div className="v">{s.v}<span className="u">{s.u}</span></div>
                </div>
              ))}
            </div>
            <div className="dash-chart">
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute', top:0, left:0}}>
                <defs>
                  <linearGradient id="garea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#ef4a14" stopOpacity=".5"/>
                    <stop offset="1" stopColor="#ef4a14" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <g>
                  {[20,40,60,80].map(y=>(<line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#2a2823" strokeWidth=".3"/>))}
                </g>
                <path d={area} fill="url(#garea)"/>
                <path d={path} fill="none" stroke="#ef4a14" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
              </svg>
              <div style={{position:'absolute', top:14, left:16, fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'#7a7568', textTransform:'uppercase', letterSpacing:'.08em'}}>NETWORK · LAST 60 MIN</div>
              <div style={{position:'absolute', top:14, right:16, fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:'var(--accent)'}}>● LIVE</div>
            </div>
            <div className="dash-terminal">
              {t.dash.term.map((line, i) => (
                <div key={i}>
                  <span className={line.t}>{line.x}</span>
                  {i === t.dash.term.length - 1 && <span className="dash-cursor"></span>}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

function Blog({ t }) {
  const [cat, setCat] = React.useState(t.blog.cats[0]);
  const visiblePosts = cat === t.blog.cats[0]
    ? t.blog.posts
    : t.blog.posts.filter(p => p.cat === cat);

  return (
    <section className="section wrap" id="blog">
      <SectionHead num={t.blog.num} title={t.blog.title} lede={t.blog.lede} />

      {/* FEATURED */}
      <article className="blog-feat">
        <div className="feat-body">
          <span className="feat-tag">{t.blog.feat.tag}</span>
          <span className="feat-cat">{t.blog.feat.cat}</span>
          <h3 className="feat-title">{t.blog.feat.title}</h3>
          <p className="feat-ex">{t.blog.feat.ex}</p>
          <div className="feat-meta">{t.blog.feat.meta}</div>
          <a href="#blog" className="btn feat-cta">{t.blog.readMore} →</a>
        </div>
        <div className="feat-art">
          <FeatArt />
        </div>
      </article>

      {/* CATEGORY FILTER */}
      <div className="cat-bar">
        {t.blog.cats.map((c, i) => (
          <button key={i} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {/* POSTS GRID */}
      <div className="posts-grid">
        {visiblePosts.map((p, i) => (
          <article className="post-card" key={p.t}>
            <span className="pcat">{p.cat}</span>
            <h4>{p.t}</h4>
            <div className="pmeta">
              <span className="av">{p.a.split(' ').map(x=>x[0]).join('').slice(0,2)}</span>
              <span>{p.a}</span>
              <span className="dot">·</span>
              <span>{p.m}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="blog-foot">
        <span className="count">{visiblePosts.length} / {t.blog.posts.length} · {cat.toUpperCase()}</span>
        <a href="#blog" className="btn">{t.blog.readMore} →</a>
      </div>

      {/* POPULAR GUIDES + NEWSLETTER */}
      <div className="guides-block">
        <div className="guides-l">
          <div className="guides-head">
            <h3>{t.blog.guidesHead.split(' ').slice(0,-1).join(' ')} <em>{t.blog.guidesHead.split(' ').slice(-1)}</em></h3>
            <p>{t.blog.guidesLede}</p>
          </div>
          <ul className="guides-list">
            {t.blog.guides.map((g, i) => (
              <li className="guide-row" key={i}>
                <span className="gn">{String(i+1).padStart(2,'0')}</span>
                <span className="gt">{g.t}</span>
                <span className="gtime">{g.time}</span>
                <span className="greads">{g.reads} ↗</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="guides-r">
          <div className="newsletter">
            <span className="nlabel">◆ NEWSLETTER</span>
            <h4>{t.blog.newsletter.t}</h4>
            <p>{t.blog.newsletter.s}</p>
            <form onSubmit={e=>{e.preventDefault();}}>
              <input type="email" placeholder={t.blog.newsletter.ph} />
              <button type="submit">{t.blog.newsletter.cta}</button>
            </form>
            <div style={{fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#7a7568', textTransform:'uppercase', letterSpacing:'.1em', marginTop:8}}>
              {t.blog.newsletter.subs}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 420 340" preserveAspectRatio="xMidYMid meet" style={{maxWidth:'100%'}}>
      {/* Isometric-ish minecraft pile */}
      {Array.from({length:9}).map((_,r)=>(
        Array.from({length:14}).map((_,c)=>{
          const palette = ['#7d5a3c','#5fa84a','#1a1a14','#7d5a3c','#5fa84a','#3a2e22'];
          const fill = palette[(r*3 + c*5) % palette.length];
          const opacity = r === 0 || c === 0 || c === 13 ? '.7' : '.9';
          return <g key={r+'-'+c}>
            <rect x={c*30} y={r*30+5} width="30" height="30" fill={fill} stroke="#0e0d0a" strokeWidth="1" opacity={opacity}/>
            <rect x={c*30+4} y={r*30+9} width="6" height="6" fill="#0e0d0a" opacity=".22"/>
            <rect x={c*30+18} y={r*30+17} width="5" height="5" fill="#0e0d0a" opacity=".15"/>
          </g>;
        })
      ))}
      {/* Big PAPER text */}
      <text x="210" y="180" textAnchor="middle" fontFamily="Archivo Black" fontSize="52" fill="#fff" letterSpacing="-2" style={{paintOrder:'stroke'}} stroke="#0e0d0a" strokeWidth="3">MINECRAFT</text>
      <text x="210" y="208" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill="#fff" letterSpacing="2" fontWeight="700">PAPER · 1.21 · PTERODACTYL</text>
    </svg>
  );
}

function PostImg({ i }) {
  // Distinct editorial mini illustrations per post
  if (i === 0) return (
    <div className="post-img">
      <svg width="100%" height="100%" viewBox="0 0 280 160">
        <rect x="20" y="40" width="240" height="80" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5"/>
        <line x1="20" y1="60" x2="260" y2="60" stroke="var(--ink)" strokeWidth="1.5"/>
        <text x="30" y="55" fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink)">14:23 INCIDENT</text>
        <polyline points="30,100 60,90 90,95 110,75 140,85 170,60 200,70 230,40 255,50" fill="none" stroke="var(--accent)" strokeWidth="2"/>
        <circle cx="170" cy="60" r="4" fill="var(--accent)"/>
        <line x1="170" y1="60" x2="170" y2="120" stroke="var(--accent)" strokeDasharray="3,3"/>
      </svg>
    </div>
  );
  if (i === 1) return (
    <div className="post-img">
      <svg width="100%" height="100%" viewBox="0 0 280 160">
        <rect x="60" y="30" width="160" height="100" fill="#0082c9" stroke="var(--ink)" strokeWidth="1.5"/>
        <circle cx="140" cy="80" r="32" fill="#fff"/>
        <circle cx="140" cy="80" r="22" fill="#0082c9"/>
        <text x="140" y="148" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill="var(--ink)" fontWeight="700">NEXTCLOUD · 9 €/MO</text>
      </svg>
    </div>
  );
  if (i === 2) return (
    <div className="post-img">
      <svg width="100%" height="100%" viewBox="0 0 280 160">
        <rect x="30" y="40" width="100" height="80" fill="var(--cream)" stroke="var(--ink)" strokeWidth="1.5"/>
        <text x="80" y="80" textAnchor="middle" fontFamily="Archivo Black" fontSize="20" fill="var(--ink)">GEN3</text>
        <text x="80" y="105" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--muted)">3.5 GB/s</text>
        <rect x="150" y="40" width="100" height="80" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5"/>
        <text x="200" y="80" textAnchor="middle" fontFamily="Archivo Black" fontSize="20" fill="#fff">GEN4</text>
        <text x="200" y="105" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="#fff">5.2 GB/s</text>
        <text x="140" y="82" textAnchor="middle" fontFamily="Archivo Black" fontSize="18" fill="var(--ink)">vs</text>
      </svg>
    </div>
  );
  if (i === 3) return (
    <div className="post-img">
      <svg width="100%" height="100%" viewBox="0 0 280 160">
        <rect x="20" y="20" width="240" height="120" fill="#0e0d0a" stroke="var(--ink)" strokeWidth="1.5"/>
        <g fontFamily="JetBrains Mono" fontSize="10" fill="#5fd47e">
          <text x="32" y="42">resource "vps4u_server" "web" {`{`}</text>
          <text x="42" y="58" fill="#a8a299">  plan     = "medium"</text>
          <text x="42" y="74" fill="#a8a299">  region   = "nue"</text>
          <text x="42" y="90" fill="#a8a299">  image    = "ubuntu-24.04"</text>
          <text x="42" y="106" fill="#a8a299">  ssh_keys = [var.key]</text>
          <text x="32" y="122">{`}`}</text>
        </g>
      </svg>
    </div>
  );
  return null;
}

function FAQ({ t }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="section wrap" id="faq">
      <SectionHead num={t.faq.num} title={t.faq.title} />
      <div className="faq">
        {t.faq.items.map((it, i) => (
          <div key={i} className={"faq-item" + (open===i?' open':'')} onClick={()=>setOpen(open===i?-1:i)}>
            <div className="faq-q">
              <h4>{it.q}</h4>
              <span className="plus">+</span>
            </div>
            <div className="faq-a">{it.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTAStrip({ t }) {
  return (
    <section className="cta-strip">
      <div className="wrap ctas-row">
        <h2 className="ctas-h">
          {t.cta.title.map((p,i)=> typeof p === 'string' ? <span key={i}>{p}</span> : <em key={i}>{p.i}</em>)}
        </h2>
        <div style={{display:'flex', flexDirection:'column', gap:14, alignItems:'flex-start'}}>
          <p style={{margin:0, fontFamily:"'JetBrains Mono', monospace", fontSize:13, color:'#a8a299', textTransform:'uppercase', letterSpacing:'.08em'}}>{t.cta.sub}</p>
          <div style={{display:'flex', gap:12}}>
            <a href="rejestracja.html" className="btn btn-primary btn-lg">{t.cta.primary} →</a>
            <a href="mailto:info@vps4u.xyz" className="btn btn-lg" style={{background:'transparent', color:'var(--cream)', borderColor:'var(--cream)'}}>{t.cta.secondary}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ t, lang }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <div className="logo" style={{fontSize:24}}>
              <span className="badge">v4</span>
              <span>VPS4U<span style={{color:'var(--accent)'}}>.</span>xyz</span>
            </div>
            <p style={{fontFamily:"'JetBrains Mono', monospace", fontSize:12, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', maxWidth:280, marginTop:18, lineHeight:1.6}}>{t.foot.tag}</p>
          </div>
          {t.foot.cols.map((c, i) => (
            <div key={i}>
              <h5>{c.h}</h5>
              <ul>
                {c.l.map((l, j) => (
                  <li key={j}>
                    {l.mail
                      ? <a href={`mailto:${"info"}@${"vps4u.xyz"}`} rel="nofollow">{l.t}</a>
                      : <a href={l.h}>{l.t}</a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="giant-logo">
          VPS<em>4</em>U<span style={{color:'var(--accent)'}}>.</span>xyz
        </div>
        <div className="footer-bottom">
          {t.foot.bottom.map((b,i)=>(<span key={i}>{b}</span>))}
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Savings, Testimonials, Dashboard, Blog, FAQ, CTAStrip, Footer });
