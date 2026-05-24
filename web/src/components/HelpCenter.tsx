/**
 * HelpCenter - Sag alt kosede sabit "?" yardim butonu.
 * Acildiginda:
 *   1. Arama kutusu + kategorilere gore makaleler - buyerasistans.info/docs'a yonlendirir
 *   2. "Cevabi bulamadim" - SupportTicketWidget (destek talebi)
 *
 * App.tsx'e global olarak eklenebilir.
 */
import { useState, useMemo } from "react";
import SupportTicketWidget from "./SupportTicketWidget";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";

const DOCS_BASE = "https://buyerasistans.info/docs";

// ---------------------------------------------------------------------------
// Makale katalogu - kilavuz makaleler (buyerasistans.info/docs rotalarina bagli)
// ---------------------------------------------------------------------------

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: string;
}

const ARTICLES: HelpArticle[] = [
  // Baslangic
  { id: "a1", title: "Aktivasyon nasil yapilir?", summary: "Aktivasyon mailinden hesabinizi nasil aktive edersiniz.", slug: "aktivasyon", category: "Baslangic" },
  { id: "a2", title: "Ilk giristen sonra ne yapmaliyim?", summary: "Aktivasyon sonrasi tamamlamaniz gereken adimlar.", slug: "aktivasyon/baslangic", category: "Baslangic" },
  { id: "a3", title: "Sifremi nasil degistiririm?", summary: "Profil sayfasindan sifre guncelleme adimlari.", slug: "hesap/sifre", category: "Hesap" },

  // Stratejik Partner
  { id: "b1", title: "Sirket bilgilerimi nasil guncellerim?", summary: "Vergi no, adres ve telefon bilgisi guncelleme.", slug: "stratejik-ortak/sirket-bilgileri", category: "Stratejik Partner" },
  { id: "b2", title: "Kullanici nasil davet ederim?", summary: "Ekibinizi platforma ekleme adimlari.", slug: "stratejik-ortak/kullanici-daveti", category: "Stratejik Partner" },
  { id: "b3", title: "Tedarikçi nasıl eklenir?", summary: "Tedarikçi kaydı oluşturma ve yönetimi.", slug: "stratejik-ortak/tedarikci-ekleme", category: "Stratejik Partner" },
  { id: "b4", title: "Teklif talebi (RFQ) nasıl oluşturulur?", summary: "Satın alma talebi oluşturma ve tedarikçilere gönderme.", slug: "stratejik-ortak/ilk-teklif", category: "Stratejik Partner" },

  // Tedarikci
  { id: "c1", title: "Tedarikçi profili nasıl tamamlanır?", summary: "İletişim, banka ve belge bilgilerini doldurma.", slug: "tedarikci/profil", category: "Tedarikçi" },
  { id: "c2", title: "Teklif nasıl verilir?", summary: "Açık teklif taleplerine yanıt verme.", slug: "tedarikci/teklif-verme", category: "Tedarikçi" },
  { id: "c3", title: "Belge yükleme nasıl yapılır?", summary: "Zorunlu evrakları sisteme ekleme.", slug: "tedarikci/belgeler", category: "Tedarikçi" },

  // Fatura & Odeme
  { id: "d1", title: "Fatura nereden goruntulenir?", summary: "Abonelik faturalari ve odeme gecmisi.", slug: "fatura/goruntuleme", category: "Fatura & Odeme" },
  { id: "d2", title: "Odeme yontemi nasil degistirilir?", summary: "Kredi karti veya banka havalesi guncelleme.", slug: "fatura/odeme-yontemi", category: "Fatura & Odeme" },

  // Destek
  { id: "e1", title: "Destek talebi nasil acilir?", summary: "Platform personeline talep iletme adimlari.", slug: "destek/talep-acma", category: "Destek" },
  { id: "e2", title: "SLA süreleri nedir?", summary: "Önceliğe göre yanıt ve çözüm süreleri.", slug: "destek/sla", category: "Destek" },

  // İş Ortağı
  { id: "f1", title: "İş Ortağı programına nasıl katılırım?", summary: "Program koşulları ve kayıt adımları.", slug: "is-ortagi/program-kosullari", category: "İş Ortağı" },
];

const CATEGORIES = [...new Set(ARTICLES.map((a) => a.category))];

// ---------------------------------------------------------------------------
// Bilesen
// ---------------------------------------------------------------------------

type Panel = "search" | "ticket";

export default function HelpCenter() {
  const { locale } = useLocale();
  const t = usePublicTranslations("help_center", locale, {
    title: "Yardim Merkezi",
    subtitle: "Nasil yardimci olabiliriz?",
    articles_tab: "Makaleler",
    ticket_tab: "Destek Talebi",
    search_placeholder: "Kilavuzlarda ara...",
    all_categories: "Tumu",
    not_found: "Aranan kilavuz bulunamadi.",
    missing_prompt: "Aradiginizi bulamadin mi?",
    create_ticket: "Destek Talebi Olustur",
    view_all_docs: "Tüm Kılavuzları Görüntüle (buyerasistans.info/docs)",
  });
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("search");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      const matchQuery = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
      const matchCat = !activeCategory || a.category === activeCategory;
      return matchQuery && matchCat;
    });
  }, [query, activeCategory]);

  return (
    <>
      {/* Floating buton */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Yardim merkezi"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9000,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          background: open ? "#1d4ed8" : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
          color: "white",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(29, 78, 216, 0.38)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {open ? "x" : "?"}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            right: 28,
            zIndex: 8999,
            width: 360,
            maxWidth: "calc(100vw - 40px)",
            maxHeight: "70vh",
            borderRadius: 20,
            background: "white",
            border: "1px solid #e2e8f0",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Panel basligi */}
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8", marginBottom: 4 }}>
              {t.title}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{t.subtitle}</div>
            {/* Tab */}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setPanel("search")}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: panel === "search" ? "#1d4ed8" : "#f1f5f9", color: panel === "search" ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
              >
                {t.articles_tab}
              </button>
              <button
                type="button"
                onClick={() => setPanel("ticket")}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: panel === "ticket" ? "#1d4ed8" : "#f1f5f9", color: panel === "ticket" ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
              >
                {t.ticket_tab}
              </button>
            </div>
          </div>

          {/* Panel icerigi - kaydirilabilir */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            {panel === "search" ? (
              <div style={{ display: "grid", gap: 10 }}>
                {/* Arama */}
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search_placeholder}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#0f172a", background: "#f8fafc", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                />

                {/* Kategori filtreleri */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    style={{ padding: "3px 10px", borderRadius: 999, border: "none", background: !activeCategory ? "#1d4ed8" : "#e2e8f0", color: !activeCategory ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 11 }}
                  >
                    {t.all_categories}
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                      style={{ padding: "3px 10px", borderRadius: 999, border: "none", background: cat === activeCategory ? "#1d4ed8" : "#e2e8f0", color: cat === activeCategory ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 11 }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Makale listesi */}
                {filteredArticles.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13, padding: "12px 0" }}>
                    {t.not_found}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {filteredArticles.map((article) => (
                      <a
                        key={article.id}
                        href={`${DOCS_BASE}/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 12px", textDecoration: "none", display: "block", transition: "background 0.15s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#eff6ff"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                      >
                        <div style={{ fontWeight: 700, color: "#1d4ed8", fontSize: 13 }}>{article.title}</div>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{article.summary}</div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Destek talebi CTA */}
                <div style={{ borderRadius: 14, border: "1px solid #bfdbfe", background: "#eff6ff", padding: "12px 14px", marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>
                    {t.missing_prompt}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanel("ticket")}
                    style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 13 }}
                  >
                    {t.create_ticket}
                  </button>
                </div>

                {/* Tam dokumantasyon linki */}
                <a
                  href={DOCS_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textAlign: "center", color: "#1d4ed8", fontWeight: 700, fontSize: 12, textDecoration: "underline", display: "block", paddingBottom: 4 }}
                >
                  {t.view_all_docs}
                </a>
              </div>
            ) : (
              <SupportTicketWidget embed source="help_center" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
