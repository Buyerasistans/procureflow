import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import "./PricingPlansPage.css";

type Plan = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  features?: string[];
};

type PricingConfig = {
  strategic_partner: { plans: Plan[] };
  supplier: { plans: Plan[] };
};

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const fallbackConfig: PricingConfig = {
  strategic_partner: {
    plans: [
      {
        code: "starter",
        name: "Başlangıç",
        description: "Temel RFQ ve tedarikçi operasyonları",
        features: ["RFQ + teklif toplama", "Temel rapor ekranlari", "Standart destek"],
      },
      {
        code: "growth",
        name: "Gelisim",
        description: "Buyuyen ekipler icin gelismis raporlar",
        features: ["Onay akis otomasyonu", "Platform supplier pool", "KPI export + dashboard"],
      },
      {
        code: "enterprise",
        name: "Kurumsal",
        description: "Kurumsal entegrasyon ve ileri destek",
        features: ["ERP entegrasyonu", "Ozel SLA ve CSM", "Coklu domain marka katmani"],
      },
    ],
  },
  supplier: {
    plans: [
      {
        code: "supplier_free",
        name: "Tedarikçi Ücretsiz",
        description: "Temel tedarikçi görünürlük paketi",
        features: ["Profil olusturma", "Teklif yanitlama", "Aylik performans ozeti"],
      },
      {
        code: "supplier_prime",
        name: "Tedarikçi Prime",
        description: "Gelismis gorunurluk ve analiz",
        features: ["One cikarma", "Kategori bazli rapor", "Oncelikli destek"],
      },
    ],
  },
};

export default function PricingPlansPage() {
  const [config, setConfig] = useState<PricingConfig>(fallbackConfig);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/onboarding/public-pricing`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.strategic_partner?.plans && data?.supplier?.plans) {
          setConfig(data as PricingConfig);
        }
      })
      .catch(() => setConfig(fallbackConfig));
  }, []);

  return (
    <div className="ppp-root">
      <NavBar activePath="/fiyatlandirma" />
      <main className="ppp-main">
        <section className="ppp-container">
          <h1 className="ppp-h1">Fiyatlandırma</h1>
          <p className="ppp-lead">
            Fiyatlandırma içeriği artık Teklifler ve Tedarikçiler sayfalarına dağıtıldı. Bu sayfa geriye dönük yönlendirme merkezi olarak tutulur.
          </p>

          <section id="stratejik" className="ppp-section">
            <h2 className="ppp-section-h2">Stratejik Partner Planlari</h2>
            <div className="ppp-plan-grid">
              {config.strategic_partner.plans.map((p, i) => (
                <article key={p.code} className={i === 1 ? "ppp-card ppp-card--featured-strategic" : "ppp-card"}>
                  <h3 className="ppp-plan-h3">{p.name}</h3>
                  <p className="ppp-plan-desc">{p.description}</p>
                  <div className="ppp-plan-price--strategic">{priceLabel(p)}</div>
                  <ul className="ppp-plan-features">
                    {(p.features || []).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <a href={`/onboarding?tenant_type=strategic_partner&plan_code=${encodeURIComponent(p.code)}`} className="ppp-btn-primary">
                    Bu Plani Sec
                  </a>
                </article>
              ))}
            </div>
            <div className="ppp-btn-row">
              <a href="/teklifler#planlar" className="ppp-btn-primary">Teklifler Planlarini Ac</a>
              <a href="/stratejik-ortaklik" className="ppp-btn-outline">Stratejik Partner Programı</a>
            </div>
          </section>

          <section id="tedarikci" className="ppp-section">
            <h2 className="ppp-section-h2">Tedarikçi Planları</h2>
            <div className="ppp-plan-grid">
              {config.supplier.plans.map((p, i) => (
                <article key={p.code} className={i === 1 ? "ppp-card ppp-card--featured-supplier" : "ppp-card"}>
                  <h3 className="ppp-plan-h3">{p.name}</h3>
                  <p className="ppp-plan-desc">{p.description}</p>
                  <div className="ppp-plan-price--supplier">{priceLabel(p)}</div>
                  <ul className="ppp-plan-features">
                    {(p.features || []).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <a href={`/onboarding?tenant_type=supplier&plan_code=${encodeURIComponent(p.code)}`} className="ppp-btn-supplier">
                    Bu Plani Sec
                  </a>
                </article>
              ))}
            </div>
            <div className="ppp-btn-row">
              <a href="/tedarikciler#planlar" className="ppp-btn-supplier">Tedarikçi Planlarıni Ac</a>
              <a href="/tedarikci-ol" className="ppp-btn-outline">Tedarikçi Programı</a>
              <a href="/supplier/login" className="ppp-btn-outline">Tedarikçi Girişi</a>
            </div>
          </section>

          <div className="ppp-info-box">
            <h2 className="ppp-info-h2">Ayni Hosting + Ortak Veritabani Mimarisi</h2>
            <p className="ppp-info-p">
              Tum domainler ayni uygulama havuzunda calisir; canonical, hreflang ve yonlendirme kurallari ile duplicate-content riski azaltilir.
              Tek operasyon ekibiyle deployment ve gozlemleme kolaylasirken, kullanici deneyimi tutarli kalir.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function priceLabel(plan: Plan): string {
  if (!plan.price_monthly || plan.price_monthly <= 0) {
    return "Kuruma Ozel Teklif";
  }
  return `${plan.price_monthly.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay`;
}
