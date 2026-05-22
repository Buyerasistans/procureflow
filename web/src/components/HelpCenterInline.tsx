import { useMemo, useState } from "react";
import SupportTicketWidget from "./SupportTicketWidget";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";

const DOCS_BASE = "https://buyerasistans.info/docs";

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: string;
}

const ARTICLES: HelpArticle[] = [
  { id: "a1", title: "Aktivasyon nasil yapilir?", summary: "Aktivasyon mailinden hesabinizi nasil aktive edersiniz.", slug: "aktivasyon", category: "Baslangic" },
  { id: "a2", title: "Ilk giristen sonra ne yapmaliyim?", summary: "Aktivasyon sonrasi tamamlamaniz gereken adimlar.", slug: "aktivasyon/baslangic", category: "Baslangic" },
  { id: "a3", title: "Sifremi nasil degistiririm?", summary: "Profil sayfasindan sifre guncelleme adimlari.", slug: "hesap/sifre", category: "Hesap" },
  { id: "b1", title: "Sirket bilgilerimi nasil guncellerim?", summary: "Vergi no, adres ve telefon bilgisi guncelleme.", slug: "stratejik-ortak/sirket-bilgileri", category: "Stratejik Partner" },
  { id: "b2", title: "Kullanici nasil davet ederim?", summary: "Ekibinizi platforma ekleme adimlari.", slug: "stratejik-ortak/kullanici-daveti", category: "Stratejik Partner" },
  { id: "b3", title: "Tedarikci nasil eklenir?", summary: "Tedarikci kaydi olusturma ve yonetimi.", slug: "stratejik-ortak/tedarikci-ekleme", category: "Stratejik Partner" },
  { id: "b4", title: "Teklif talebi (RFQ) nasil olusturulur?", summary: "Satin alma talebi olusturma ve tedarikcilere gonderme.", slug: "stratejik-ortak/ilk-teklif", category: "Stratejik Partner" },
  { id: "c1", title: "Tedarikci profili nasil tamamlanir?", summary: "Iletisim, banka ve belge bilgilerini doldurma.", slug: "tedarikci/profil", category: "Tedarikci" },
  { id: "c2", title: "Teklif nasil verilir?", summary: "Acik teklif taleplerine yanit verme.", slug: "tedarikci/teklif-verme", category: "Tedarikci" },
];

const CATEGORIES = [...new Set(ARTICLES.map((a) => a.category))];

export default function HelpCenterInline() {
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
    view_all_docs: "Tum Kilavuzlari Goruntule (buyerasistans.info/docs)",
  });
  const [panel, setPanel] = useState<"search" | "ticket">("search");
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
    <section style={{ marginTop: 16, background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8" }}>{t.title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>{t.subtitle}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => setPanel("search")} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: panel === "search" ? "#1d4ed8" : "#f1f5f9", color: panel === "search" ? "white" : "#334155", fontWeight: 700, cursor: "pointer" }}>{t.articles_tab}</button>
        <button type="button" onClick={() => setPanel("ticket")} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: panel === "ticket" ? "#1d4ed8" : "#f1f5f9", color: panel === "ticket" ? "white" : "#334155", fontWeight: 700, cursor: "pointer" }}>{t.ticket_tab}</button>
      </div>

      {panel === "search" ? (
        <div style={{ marginTop: 12 }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search_placeholder} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid #dbe3ee", background: "#f8fafc" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={() => setActiveCategory(null)} style={{ padding: "4px 10px", borderRadius: 999, border: "none", background: !activeCategory ? "#1d4ed8" : "#e2e8f0", color: !activeCategory ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{t.all_categories}</button>
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat === activeCategory ? null : cat)} style={{ padding: "4px 10px", borderRadius: 999, border: "none", background: cat === activeCategory ? "#1d4ed8" : "#e2e8f0", color: cat === activeCategory ? "white" : "#334155", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 8 }}>
            {filteredArticles.length === 0 ? <div style={{ color: "#64748b" }}>{t.not_found}</div> : filteredArticles.map((article) => (
              <a key={article.id} href={`${DOCS_BASE}/${article.slug}`} target="_blank" rel="noreferrer" style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, textDecoration: "none", background: "#f8fafc" }}>
                <div style={{ color: "#1d4ed8", fontWeight: 700 }}>{article.title}</div>
                <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{article.summary}</div>
              </a>
            ))}
          </div>
          <a href={DOCS_BASE} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: "#1d4ed8", fontWeight: 700 }}>{t.view_all_docs}</a>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <SupportTicketWidget embed source="help_center_page" />
        </div>
      )}
    </section>
  );
}
