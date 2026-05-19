import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";

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
        name: "Baslangic",
        description: "Temel RFQ ve tedarikci operasyonlari",
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
        name: "Tedarikci Ucretsiz",
        description: "Temel tedarikci gorunurluk paketi",
        features: ["Profil olusturma", "Teklif yanitlama", "Aylik performans ozeti"],
      },
      {
        code: "supplier_prime",
        name: "Tedarikci Prime",
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#ecfeff,#f8fafc)", fontFamily: "'Segoe UI', sans-serif" }}>
      <NavBar activePath="/fiyatlandirma" />
      <main style={{ padding: "42px 20px" }}>
      <section style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 38, color: "#0f172a", marginBottom: 8 }}>Fiyatlandırma</h1>
        <p style={{ color: "#475569", marginBottom: 24, lineHeight: 1.7 }}>
          Fiyatlandirma icerigi artik Teklifler ve Tedarikciler sayfalarina dagitildi. Bu sayfa geriye donuk yonlendirme merkezi olarak tutulur.
        </p>

        <section id="stratejik" style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>Stratejik Partner Planlari</h2>
          <div style={gridStyle}>
            {config.strategic_partner.plans.map((p, i) => (
              <article key={p.code} style={{ ...cardStyle, border: i === 1 ? "2px solid #0f766e" : "1px solid #e2e8f0" }}>
                <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>{p.name}</h3>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>{p.description}</p>
                <div style={{ color: "#064e3b", fontWeight: 800, marginTop: 6 }}>
                  {priceLabel(p)}
                </div>
                <ul style={{ paddingLeft: 18, color: "#334155", fontSize: 14, lineHeight: 1.6 }}>
                  {(p.features || []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href={`/onboarding?tenant_type=strategic_partner&plan_code=${encodeURIComponent(p.code)}`} style={primaryBtn}>
                  Bu Plani Sec
                </a>
              </article>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <a href="/teklifler#planlar" style={primaryBtn}>Teklifler Planlarini Ac</a>
            <a href="/stratejik-ortaklik" style={outlineBtn}>Stratejik Partner Programi</a>
          </div>
        </section>

        <section id="tedarikci" style={{ marginBottom: 24 }}>
          <h2 style={sectionTitle}>Tedarikci Planlari</h2>
          <div style={gridStyle}>
            {config.supplier.plans.map((p, i) => (
              <article key={p.code} style={{ ...cardStyle, border: i === 1 ? "2px solid #0284c7" : "1px solid #e2e8f0" }}>
                <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22 }}>{p.name}</h3>
                <p style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>{p.description}</p>
                <div style={{ color: "#0c4a6e", fontWeight: 800, marginTop: 6 }}>
                  {priceLabel(p)}
                </div>
                <ul style={{ paddingLeft: 18, color: "#334155", fontSize: 14, lineHeight: 1.6 }}>
                  {(p.features || []).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href={`/onboarding?tenant_type=supplier&plan_code=${encodeURIComponent(p.code)}`} style={supplierBtn}>
                  Bu Plani Sec
                </a>
              </article>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <a href="/tedarikciler#planlar" style={supplierBtn}>Tedarikci Planlarini Ac</a>
            <a href="/tedarikci-ol" style={outlineBtn}>Tedarikci Programi</a>
            <a href="/supplier/login" style={outlineBtn}>Tedarikci Girisi</a>
          </div>
        </section>

        <section style={{ marginTop: 22, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
          <h2 style={{ marginTop: 0, color: "#0f172a" }}>Ayni Hosting + Ortak Veritabani Mimarisi</h2>
          <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Tum domainler ayni uygulama havuzunda calisir; canonical, hreflang ve yonlendirme kurallari ile duplicate-content riski azaltilir.
            Tek operasyon ekibiyle deployment ve gozlemleme kolaylasirken, kullanici deneyimi tutarli kalir.
          </p>
        </section>
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

const sectionTitle = {
  color: "#0f172a",
  marginBottom: 12,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: 14,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const primaryBtn = {
  background: "#0f766e",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  padding: "10px 14px",
};

const supplierBtn = {
  background: "#0284c7",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  padding: "10px 14px",
};

const outlineBtn = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  padding: "10px 14px",
};

