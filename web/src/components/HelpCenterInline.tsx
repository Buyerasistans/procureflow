import { useMemo, useState } from "react";
import SupportTicketWidget from "./SupportTicketWidget";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";
import "./HelpCenterInline.css";

const DOCS_BASE = "https://buyerasistans.info/docs";

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: string;
}

const ARTICLES: HelpArticle[] = [
  { id: "a1", title: "Aktivasyon nasıl yapılır?", summary: "Aktivasyon mailinden hesabınızı nasıl aktive edersiniz.", slug: "aktivasyon", category: "Başlangıç" },
  { id: "a2", title: "İlk girişten sonra ne yapmalıyım?", summary: "Aktivasyon sonrası tamamlamanız gereken adımlar.", slug: "aktivasyon/baslangic", category: "Başlangıç" },
  { id: "a3", title: "Şifremi nasıl değiştiririm?", summary: "Profil sayfasından şifre güncelleme adımları.", slug: "hesap/sifre", category: "Hesap" },
  { id: "b1", title: "Şirket bilgilerimi nasıl güncellerim?", summary: "Vergi no, adres ve telefon bilgisi güncelleme.", slug: "stratejik-ortak/sirket-bilgileri", category: "Stratejik Partner" },
  { id: "b2", title: "Kullanıcı nasıl davet ederim?", summary: "Ekibinizi platforma ekleme adımları.", slug: "stratejik-ortak/kullanici-daveti", category: "Stratejik Partner" },
  { id: "b3", title: "Tedarikçi nasıl eklenir?", summary: "Tedarikçi kaydı oluşturma ve yönetimi.", slug: "stratejik-ortak/tedarikci-ekleme", category: "Stratejik Partner" },
  { id: "b4", title: "Teklif talebi (RFQ) nasıl oluşturulur?", summary: "Satın alma talebi oluşturma ve tedarikçilere gönderme.", slug: "stratejik-ortak/ilk-teklif", category: "Stratejik Partner" },
  { id: "c1", title: "Tedarikçi profili nasıl tamamlanır?", summary: "İletişim, banka ve belge bilgilerini doldurma.", slug: "tedarikci/profil", category: "Tedarikçi" },
  { id: "c2", title: "Teklif nasıl verilir?", summary: "Açık teklif taleplerine yanıt verme.", slug: "tedarikci/teklif-verme", category: "Tedarikçi" },
];

const CATEGORIES = [...new Set(ARTICLES.map((a) => a.category))];

export default function HelpCenterInline() {
  const { locale } = useLocale();
  const t = usePublicTranslations("help_center", locale, {
    title: "Yardim Merkezi",
    subtitle: "Nasıl yardımcı olabiliriz?",
    articles_tab: "Makaleler",
    ticket_tab: "Destek Talebi",
    search_placeholder: "Kılavuzlarda ara...",
    all_categories: "Tümü",
    not_found: "Aranan kilavuz bulunamadi.",
    missing_prompt: "Aradiginizi bulamadin mi?",
    create_ticket: "Destek Talebi Olustur",
    view_all_docs: "Tüm Kılavuzları Görüntüle (buyerasistans.info/docs)",
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
    <section className="hci-section">
      <div className="hci-eyebrow">{t.title}</div>
      <div className="hci-title">{t.subtitle}</div>
      <div className="hci-tabs">
        <button type="button" onClick={() => setPanel("search")} className={`hci-tab${panel === "search" ? " hci-tab--active" : ""}`}>{t.articles_tab}</button>
        <button type="button" onClick={() => setPanel("ticket")} className={`hci-tab${panel === "ticket" ? " hci-tab--active" : ""}`}>{t.ticket_tab}</button>
      </div>

      {panel === "search" ? (
        <div className="hci-search-wrap">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search_placeholder} className="hci-input" />
          <div className="hci-cats">
            <button type="button" onClick={() => setActiveCategory(null)} className={`hci-cat-btn${!activeCategory ? " hci-cat-btn--active" : ""}`}>{t.all_categories}</button>
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setActiveCategory(cat === activeCategory ? null : cat)} className={`hci-cat-btn${cat === activeCategory ? " hci-cat-btn--active" : ""}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="hci-article-grid">
            {filteredArticles.length === 0 ? <div className="hci-not-found">{t.not_found}</div> : filteredArticles.map((article) => (
              <a key={article.id} href={`${DOCS_BASE}/${article.slug}`} target="_blank" rel="noreferrer" className="hci-article-link">
                <div className="hci-article-link__title">{article.title}</div>
                <div className="hci-article-link__summary">{article.summary}</div>
              </a>
            ))}
          </div>
          <a href={DOCS_BASE} target="_blank" rel="noreferrer" className="hci-docs-link">{t.view_all_docs}</a>
        </div>
      ) : (
        <div className="hci-ticket-wrap">
          <SupportTicketWidget embed source="help_center_page" />
        </div>
      )}
    </section>
  );
}
