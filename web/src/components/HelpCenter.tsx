import { useState, useMemo } from "react";
import SupportTicketWidget from "./SupportTicketWidget";
import "./HelpCenter.css";

const DOCS_BASE = "https://buyerasistans.info/docs";

// ── Makale katalogu ──────────────────────────────────────────────────────────

interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category: string;
  icon: string;
}

const ARTICLES: HelpArticle[] = [
  // Başlangıç
  { id: "a1", icon: "🚀", title: "Aktivasyon nasıl yapılır?",          summary: "Aktivasyon mailinden hesabınızı aktive etme adımları.",        slug: "aktivasyon",                          category: "Başlangıç" },
  { id: "a2", icon: "📋", title: "İlk girişten sonra ne yapmalıyım?",  summary: "Tamamlamanız gereken ilk kurulum adımları.",                    slug: "aktivasyon/baslangic",                category: "Başlangıç" },
  { id: "a3", icon: "🔑", title: "Şifremi nasıl değiştiririm?",        summary: "Profil sayfasından güvenli şifre güncelleme.",                  slug: "hesap/sifre",                         category: "Hesap" },
  { id: "a4", icon: "👤", title: "Profil bilgilerimi güncelleyebilir miyim?", summary: "Ad, telefon, adres ve fotoğraf güncelleme.",             slug: "hesap/profil",                        category: "Hesap" },

  // Stratejik Partner
  { id: "b1", icon: "🏢", title: "Şirket bilgilerimi nasıl güncellerim?", summary: "Vergi no, adres ve telefon bilgisi güncelleme.",            slug: "stratejik-ortak/sirket-bilgileri",   category: "Stratejik Partner" },
  { id: "b2", icon: "✉️", title: "Kullanıcı nasıl davet ederim?",       summary: "Ekibinizi platforma ekleme ve rol atama.",                    slug: "stratejik-ortak/kullanici-daveti",   category: "Stratejik Partner" },
  { id: "b3", icon: "🤝", title: "Tedarikçi nasıl eklenir?",            summary: "Tedarikçi kaydı oluşturma ve ilişki yönetimi.",               slug: "stratejik-ortak/tedarikci-ekleme",  category: "Stratejik Partner" },
  { id: "b4", icon: "📝", title: "Teklif talebi (RFQ) nasıl oluşturulur?", summary: "Satın alma talebi açma ve tedarikçilere gönderme.",       slug: "stratejik-ortak/ilk-teklif",        category: "Stratejik Partner" },

  // Tedarikçi
  { id: "c1", icon: "🗂️", title: "Tedarikçi profili nasıl tamamlanır?",summary: "İletişim, banka ve belge bilgilerini doldurma.",               slug: "tedarikci/profil",                  category: "Tedarikçi" },
  { id: "c2", icon: "💬", title: "Teklif nasıl verilir?",               summary: "Açık teklif taleplerine yanıt verme.",                        slug: "tedarikci/teklif-verme",             category: "Tedarikçi" },
  { id: "c3", icon: "📎", title: "Belge yükleme nasıl yapılır?",        summary: "Zorunlu evrakları sisteme ekleme.",                           slug: "tedarikci/belgeler",                 category: "Tedarikçi" },

  // Fatura & Ödeme
  { id: "d1", icon: "🧾", title: "Fatura nereden görüntülenir?",        summary: "Abonelik faturaları ve ödeme geçmişine erişim.",              slug: "fatura/goruntuleme",                 category: "Fatura & Ödeme" },
  { id: "d2", icon: "💳", title: "Ödeme yöntemi nasıl değiştirilir?",   summary: "Kredi kartı veya banka havalesi güncelleme.",                 slug: "fatura/odeme-yontemi",               category: "Fatura & Ödeme" },
  { id: "d3", icon: "↩️", title: "İade nasıl talep edilir?",            summary: "İade koşulları ve başvuru süreci.",                           slug: "fatura/iade",                        category: "Fatura & Ödeme" },

  // Destek
  { id: "e1", icon: "🎫", title: "Destek talebi nasıl açılır?",         summary: "Platform personeline talep iletme adımları.",                 slug: "destek/talep-acma",                  category: "Destek" },
  { id: "e2", icon: "⏱️", title: "SLA süreleri nedir?",                 summary: "Önceliğe göre yanıt ve çözüm süreleri.",                     slug: "destek/sla",                         category: "Destek" },

  // İş Ortağı
  { id: "f1", icon: "🌐", title: "İş Ortağı programına nasıl katılırım?", summary: "Program koşulları ve kayıt adımları.",                     slug: "is-ortagi/program-kosullari",        category: "İş Ortağı" },
  { id: "f2", icon: "💰", title: "Komisyon nasıl hesaplanır?",           summary: "Referans komisyon oranları ve ödeme takvimi.",               slug: "is-ortagi/komisyon",                 category: "İş Ortağı" },
];

const CATEGORIES = [...new Set(ARTICLES.map((a) => a.category))];

const CAT_ICONS: Record<string, string> = {
  "Başlangıç":         "🚀",
  "Hesap":             "👤",
  "Stratejik Partner": "🏢",
  "Tedarikçi":         "🤝",
  "Fatura & Ödeme":    "💳",
  "Destek":            "🎫",
  "İş Ortağı":         "🌐",
};

// ── Yasal belgeler ────────────────────────────────────────────────────────────

const LEGAL_DOCS = [
  {
    href: "/gizlilik-politikasi",
    icon: "🔒",
    colorClass: "hc-legal-link__icon--blue",
    title: "Gizlilik Politikası",
    sub: "Kişisel verilerinizin nasıl korunduğu",
  },
  {
    href: "/kullanim-kosullari",
    icon: "📄",
    colorClass: "hc-legal-link__icon--green",
    title: "Kullanım Koşulları",
    sub: "Platform kullanım kuralları ve sözleşme",
  },
  {
    href: "/iade-ve-odeme-politikasi",
    icon: "💳",
    colorClass: "hc-legal-link__icon--orange",
    title: "İade ve Ödeme Politikası",
    sub: "Ödeme yöntemleri, iade ve iptal koşulları",
  },
  {
    href: "/cerez-politikasi",
    icon: "🍪",
    colorClass: "hc-legal-link__icon--purple",
    title: "Çerez Politikası",
    sub: "Çerez kullanımı ve yönetim seçenekleri",
  },
];

// ── Bileşen ───────────────────────────────────────────────────────────────────

type Tab = "articles" | "support" | "legal";

export default function HelpCenter() {
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState<Tab>("articles");
  const [query, setQuery] = useState("");
  const [cat, setCat]     = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      const matchQ   = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
      const matchCat = !cat || a.category === cat;
      return matchQ && matchCat;
    });
  }, [query, cat]);

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Yardım merkezi"
        className={`hc-fab${open ? " hc-fab--open" : ""}`}
      >
        {open
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        }
      </button>

      {/* Panel */}
      {open && (
        <div className="hc-panel" role="dialog" aria-label="Yardım Merkezi">

          {/* Header */}
          <div className="hc-header">
            <div className="hc-header__top">
              <div className="hc-header__brand">
                <span className="hc-header__logo">BA</span>
                <span className="hc-header__name">Buyer Asistans</span>
              </div>
              <button type="button" className="hc-header__close" onClick={() => setOpen(false)} aria-label="Kapat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <p className="hc-header__title">Nasıl yardımcı olabiliriz?</p>
            <p className="hc-header__sub">Kılavuzlar, destek ve yasal belgeler</p>

            {tab === "articles" && (
              <div className="hc-searchbar">
                <span className="hc-searchbar__icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
                <input
                  className="hc-searchbar__input"
                  placeholder="Kılavuzlarda ara..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {query && (
                  <button type="button" className="hc-searchbar__clear" onClick={() => setQuery("")}>×</button>
                )}
              </div>
            )}

            <div className="hc-tabs">
              <button
                type="button"
                className={`hc-tab${tab === "articles" ? " hc-tab--active" : ""}`}
                onClick={() => setTab("articles")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                Makaleler
              </button>
              <button
                type="button"
                className={`hc-tab${tab === "support" ? " hc-tab--active" : ""}`}
                onClick={() => setTab("support")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Destek Talebi
              </button>
              <button
                type="button"
                className={`hc-tab${tab === "legal" ? " hc-tab--active" : ""}`}
                onClick={() => setTab("legal")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Yasal
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="hc-body">

            {/* ── Makaleler ── */}
            {tab === "articles" && (
              <div className="hc-articles-panel">
                {/* Kategori filtreleri */}
                <div className="hc-cats">
                  <button
                    type="button"
                    className={`hc-cat-btn${!cat ? " hc-cat-btn--active" : ""}`}
                    onClick={() => setCat(null)}
                  >
                    Tümü
                  </button>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`hc-cat-btn${cat === c ? " hc-cat-btn--active" : ""}`}
                      onClick={() => setCat(cat === c ? null : c)}
                    >
                      {CAT_ICONS[c] && <span>{CAT_ICONS[c]}</span>}
                      {c}
                    </button>
                  ))}
                </div>

                {/* Sonuç sayısı */}
                {query && (
                  <div className="hc-result-count">
                    {filtered.length > 0
                      ? `${filtered.length} sonuç bulundu`
                      : "Sonuç bulunamadı"}
                  </div>
                )}

                {/* Makale listesi */}
                {filtered.length === 0 ? (
                  <div className="hc-not-found">
                    <div className="hc-not-found__icon">🔍</div>
                    <div>"{query}" için sonuç bulunamadı.</div>
                    <div className="hc-not-found__hint">Farklı bir kelime deneyin veya destek talebi açın.</div>
                  </div>
                ) : (
                  <div className="hc-article-list">
                    {filtered.map((article) => (
                      <a
                        key={article.id}
                        href={`${DOCS_BASE}/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hc-article-link"
                      >
                        <div className="hc-article-link__icon">{article.icon}</div>
                        <div className="hc-article-link__content">
                          <div className="hc-article-link__title">{article.title}</div>
                          <div className="hc-article-link__summary">{article.summary}</div>
                        </div>
                        <div className="hc-article-link__arrow">›</div>
                      </a>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <div className="hc-cta">
                  <p className="hc-cta__title">Aradığınızı bulamadınız mı?</p>
                  <p className="hc-cta__sub">Destek ekibimiz ortalama 4 saatte yanıtlıyor.</p>
                  <button type="button" className="hc-cta__btn" onClick={() => setTab("support")}>
                    Destek Talebi Oluştur
                  </button>
                </div>

                <a href={DOCS_BASE} target="_blank" rel="noopener noreferrer" className="hc-docs-link">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Tüm Kılavuzları Görüntüle (buyerasistans.info/docs)
                </a>
              </div>
            )}

            {/* ── Destek Talebi ── */}
            {tab === "support" && (
              <div className="hc-support-wrapper">
                <SupportTicketWidget embed source="help_center" />
              </div>
            )}

            {/* ── Yasal ── */}
            {tab === "legal" && (
              <div className="hc-legal-panel">
                <p className="hc-legal-section-title">Platform Politikaları</p>

                {LEGAL_DOCS.map((doc) => (
                  <a key={doc.href} href={doc.href} target="_blank" rel="noopener noreferrer" className="hc-legal-link">
                    <div className={`hc-legal-link__icon ${doc.colorClass}`}>
                      {doc.icon}
                    </div>
                    <div className="hc-legal-link__content">
                      <div className="hc-legal-link__title">{doc.title}</div>
                      <div className="hc-legal-link__sub">{doc.sub}</div>
                    </div>
                    <div className="hc-legal-link__arrow">›</div>
                  </a>
                ))}

                <div className="hc-legal-contact">
                  <p className="hc-legal-contact__title">✉️ KVKK & Hukuki İletişim</p>
                  <div className="hc-legal-contact__row">
                    <a href="mailto:kvkk@buyerasistans.com.tr">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      kvkk@buyerasistans.com.tr
                    </a>
                    <a href="mailto:hukuk@buyerasistans.com.tr">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      hukuk@buyerasistans.com.tr
                    </a>
                    <a href="mailto:finans@buyerasistans.com.tr">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      finans@buyerasistans.com.tr (Ödeme / İade)
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
