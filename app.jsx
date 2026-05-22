// ============================================================
// app.jsx — main entry, language state, composes all sections
// ============================================================

function App() {
  const [lang, setLang] = React.useState('pl');
  const t = window.I18N[lang];

  return (
    <React.Fragment>
      <Ticker items={t.ticker} />
      <Nav t={t} lang={lang} setLang={setLang} />
      <Hero t={t} />
      <TrustBar t={t} />
      <Stack t={t} />
      <Pricing t={t} />
      <Services t={t} />
      <Savings t={t} />
      <Testimonials t={t} />
      <Dashboard t={t} />
      <Blog t={t} />
      <FAQ t={t} />
      <CTAStrip t={t} />
      <Footer t={t} lang={lang} />
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
