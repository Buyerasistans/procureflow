import NavBar from "../components/NavBar";
import DemoRequestForm from "../components/DemoRequestForm";
import { ROLE_LANDING_DATA } from "./roleLandingData";
import "./RoleLandingPage.css";

interface Props { pageKey: string; }

export default function RoleLandingPage({ pageKey }: Props) {
  const data = ROLE_LANDING_DATA[pageKey];

  if (!data) {
    return (
      <div style={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <p>Sayfa bulunamadı.</p>
      </div>
    );
  }

  const vars = { "--rlp-color": data.color, "--rlp-bg": data.colorBg, "--rlp-light": data.colorLight } as React.CSSProperties;

  return (
    <div className="rlp-root" style={vars}>
      <NavBar activePath="" />

      {/* ── HERO ── */}
      <section className="rlp-hero">
        <div className="rlp-hero-inner">
          <div className="rlp-hero-badge">{data.title}</div>
          <h1 className="rlp-hero-h1">{data.lead}</h1>
          <div className="rlp-hero-ctas">
            <a href={data.registerHref} className="rlp-btn rlp-btn--primary">{data.registerLabel}</a>
            <a href={data.loginHref} className="rlp-btn rlp-btn--ghost">{data.loginLabel}</a>
          </div>
        </div>
      </section>

      <div className="rlp-content">

        {/* ── DUAL ROLE NOTE ── */}
        {data.dualRoleNote && (
          <div className="rlp-dual-note">
            <span className="rlp-dual-note__icon">⇄</span>
            <span>{data.dualRoleNote}</span>
          </div>
        )}

        {/* ── WHY ── */}
        <section className="rlp-section">
          <h2 className="rlp-section-title">Neden {data.title}?</h2>
          <ul className="rlp-reasons">
            {data.reasons.map((r) => (
              <li key={r} className="rlp-reason-item">
                <span className="rlp-reason-check">✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── HOW ── */}
        <section className="rlp-section">
          <h2 className="rlp-section-title">Nasıl Çalışır?</h2>
          <div className="rlp-steps">
            {data.howSteps.map((step, i) => (
              <div key={step.title} className="rlp-step">
                <div className="rlp-step-num">{i + 1}</div>
                <div>
                  <div className="rlp-step-title">{step.title}</div>
                  <p className="rlp-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PLAN NOTE ── */}
        <section className="rlp-plan-note">
          <div className="rlp-plan-note__icon">💳</div>
          <p className="rlp-plan-note__text">{data.planNote}</p>
        </section>

        {/* ── DEMO + CTA GRID ── */}
        <section className="rlp-bottom-grid">
          <div>
            <h2 className="rlp-section-title">Demo Talep Et</h2>
            <DemoRequestForm audience={data.audience} source={`role_landing_${data.pageKey}`} accentColor={data.color} />
          </div>
          <div className="rlp-cta-block">
            <h2 className="rlp-section-title">Hemen Başla</h2>
            <p className="rlp-cta-block__desc">Kayıt ücretsiz. {data.planNote.split(".")[0]}.</p>
            <a href={data.registerHref} className="rlp-btn rlp-btn--primary rlp-btn--full">{data.registerLabel} →</a>
            <a href={data.loginHref} className="rlp-btn rlp-btn--ghost rlp-btn--full" style={{ marginTop: 8 }}>{data.loginLabel}</a>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="rlp-section">
          <h2 className="rlp-section-title">Sık Sorulan Sorular</h2>
          <div className="rlp-faq">
            {data.faq.map((item) => (
              <div key={item.q} className="rlp-faq-item">
                <div className="rlp-faq-q">{item.q}</div>
                <div className="rlp-faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </section>

      </div>

      <footer className="rlp-footer">
        © {new Date().getFullYear()} BUYER ASISTANS &nbsp;·&nbsp;
        <a href="/" className="rlp-footer-link">Ana Sayfa</a> &nbsp;·&nbsp;
        <a href="/demo" className="rlp-footer-link">Demo Talebi</a>
      </footer>
    </div>
  );
}
