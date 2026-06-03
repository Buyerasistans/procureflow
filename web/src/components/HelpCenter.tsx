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
import "./HelpCenter.css";

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
  // Başlangıç
  { id: "a1", title: "Aktivasyon nasıl yapılır?", summary: "Aktivasyon mailinden hesabınızı nasıl aktive edersiniz.", slug: "aktivasyon", category: "Başlangıç" },
  { id: "a2", title: "İlk girişten sonra ne yapmalıyım?", summary: "Aktivasyon sonrası tamamlamanız gereken adımlar.", slug: "aktivasyon/baslangic", category: "Başlangıç" },
  { id: "a3", title: "Şifremi nasıl değiştiririm?", summary: "Profil sayfasından şifre güncelleme adımları.", slug: "hesap/sifre", category: "Hesap" },

  // Stratejik Partner
  { id: "b1", title: "Şirket bilgilerimi nasıl güncellerim?", summary: "Vergi no, adres ve telefon bilgisi güncelleme.", slug: "stratejik-ortak/sirket-bilgileri", category: "Stratejik Partner" },
  { id: "b2", title: "Kullanıcı nasıl davet ederim?", summary: "Ekibinizi platforma ekleme adımları.", slug: "stratejik-ortak/kullanici-daveti", category: "Stratejik Partner" },
  { id: "b3", title: "Tedarikçi nasıl eklenir?", summary: "Tedarikçi kaydı oluşturma ve yönetimi.", slug: "stratejik-ortak/tedarikci-ekleme", category: "Stratejik Partner" },
  { id: "b4", title: "Teklif talebi (RFQ) nasıl oluşturulur?", summary: "Satın alma talebi oluşturma ve tedarikçilere gönderme.", slug: "stratejik-ortak/ilk-teklif", category: "Stratejik Partner" },

  // Tedarikçi
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Yardim merkezi"
        className={`hc-fab${open ? " hc-fab--open" : ""}`}
      >
        {open ? "x" : "?"}
      </button>

      {open && (
        <div className="hc-panel">
          <div className="hc-panel__head">
            <div className="hc-panel__eyebrow">{t.title}</div>
            <div className="hc-panel__title">{t.subtitle}</div>
            <div className="hc-panel__tabs">
              <button
                type="button"
                onClick={() => setPanel("search")}
                className={`hc-tab${panel === "search" ? " hc-tab--active" : ""}`}
              >
                {t.articles_tab}
              </button>
              <button
                type="button"
                onClick={() => setPanel("ticket")}
                className={`hc-tab${panel === "ticket" ? " hc-tab--active" : ""}`}
              >
                {t.ticket_tab}
              </button>
            </div>
          </div>

          <div className="hc-panel__body">
            {panel === "search" ? (
              <div className="hc-search-panel">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search_placeholder}
                  className="hc-search-input"
                />

                <div className="hc-cats">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className={`hc-cat-btn${!activeCategory ? " hc-cat-btn--active" : ""}`}
                  >
                    {t.all_categories}
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                      className={`hc-cat-btn${cat === activeCategory ? " hc-cat-btn--active" : ""}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {filteredArticles.length === 0 ? (
                  <div className="hc-not-found">{t.not_found}</div>
                ) : (
                  <div className="hc-article-list">
                    {filteredArticles.map((article) => (
                      <a
                        key={article.id}
                        href={`${DOCS_BASE}/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hc-article-link"
                      >
                        <div className="hc-article-link__title">{article.title}</div>
                        <div className="hc-article-link__summary">{article.summary}</div>
                      </a>
                    ))}
                  </div>
                )}

                <div className="hc-support-cta">
                  <div className="hc-support-cta__title">{t.missing_prompt}</div>
                  <button
                    type="button"
                    onClick={() => setPanel("ticket")}
                    className="hc-support-cta__btn"
                  >
                    {t.create_ticket}
                  </button>
                </div>

                <a
                  href={DOCS_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hc-docs-link"
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
