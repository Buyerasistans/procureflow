import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import { withPublicApiPrefix } from "../lib/public-api";
import { getToken } from "../lib/session";
import "./PublicMarketplacePage.css";

type ShowcasePayload = {
  open_tenders: Array<{
    id: number;
    title: string;
    status: string;
    project_name: string;
    project_code: string;
    project_city: string;
    company_name: string;
    company_logo_url?: string | null;
    supplier_count: number;
    bidder_count: number;
    offer_allowed: boolean;
  }>;
  supplier_pool: Array<{ id: number; company_name: string; category: string; city: string; logo_url?: string | null; invite_count: number; qualified: boolean }>;
  strategic_partners: Array<{
    id: number;
    name: string;
    city: string;
    project_count: number;
    tender_count: number;
    logo_url?: string | null;
  }>;
  top_channels: Array<{ id: number; name: string; referral_count: number; commission_total: number; success_score: number; logo_url?: string | null }>;
};

function detectMode(pathname: string) {
  if (pathname.includes("tedarikciler") || pathname.includes("suppliers")) return "suppliers";
  if (pathname.includes("stratejik-ortaklik") || pathname.includes("strategic-partner")) return "strategic";
  if (pathname.includes("is-ortagi-programi") || pathname.includes("partner-program")) return "channels";
  return "offers";
}

export default function PublicMarketplacePage() {
  const mode = useMemo(() => detectMode(window.location.pathname), []);
  const [data, setData] = useState<ShowcasePayload | null>(null);
  const [filesByQuote, setFilesByQuote] = useState<Record<number, Array<{ id: number; name: string; type: string; size: number }>>>({});
  const [biddersByQuote, setBiddersByQuote] = useState<Record<number, Array<{ company_name: string; city: string }>>>({});
  const [activeBiddersQuoteId, setActiveBiddersQuoteId] = useState<number | null>(null);
  const [strategicView, setStrategicView] = useState<"list" | "grid">("list");
  const [supplierView, setSupplierView] = useState<"list" | "grid">("list");
  const [channelView, setChannelView] = useState<"list" | "grid">("list");

  const [offerMessage, setOfferMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(withPublicApiPrefix("/api/v1/public/showcase/summary"));
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        const payload = (await res.json()) as ShowcasePayload;
        if (!cancelled) setData(payload);
      } catch {
        // ignore and keep empty state
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const title =
    mode === "offers" ? "Açık İhaleler" :
    mode === "suppliers" ? "Tedarikçi Havuzu" :
    mode === "strategic" ? "Stratejik Partnerlerimiz" :
    "Başarılı İş Ortaklarımız";

  const rows =
    mode === "offers" ? data?.open_tenders ?? [] :
    mode === "suppliers" ? data?.supplier_pool ?? [] :
    mode === "strategic" ? data?.strategic_partners ?? [] :
    data?.top_channels ?? [];

  async function loadFiles(quoteId: number) {
    if (filesByQuote[quoteId]) return;
    try {
      const res = await fetch(withPublicApiPrefix(`/api/v1/public/showcase/tenders/${quoteId}/files`));
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;
      const payload = (await res.json()) as { files: Array<{ id: number; name: string; type: string; size: number }> };
      setFilesByQuote((current) => ({ ...current, [quoteId]: payload.files || [] }));
    } catch {
      // ignore
    }
  }

  async function loadBidders(quoteId: number) {
    if (biddersByQuote[quoteId]) {
      setActiveBiddersQuoteId(quoteId);
      return;
    }
    try {
      const res = await fetch(withPublicApiPrefix(`/api/v1/public/showcase/tenders/${quoteId}/bidders`));
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;
      const payload = (await res.json()) as { bidders: Array<{ company_name: string; city: string }> };
      setBiddersByQuote((current) => ({ ...current, [quoteId]: payload.bidders || [] }));
      setActiveBiddersQuoteId(quoteId);
    } catch {
      // ignore
    }
  }

  function handleOfferClick(row: { offer_allowed?: boolean; id: number }) {
    const token = getToken();
    if (!token) {
      setOfferMessage("Teklif vermek için önce giriş yapmalısınız. Giriş sonrası yetkiniz kontrol edilip otomatik devam edilir.");
      return;
    }
    if (!row.offer_allowed) {
      setOfferMessage("Bu ihale i?in havuz hakk?n?z aktif de?il. ?yeli?inizi y?kselterek veya havuz ?demesi ile teklif hakk? a?abilirsiniz.");
      return;
    }
    window.location.href = `/quotes/create?source=public_tender&quote_id=${row.id}`;
  }

  function initials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "BA";
  }

  function renderAvatar(name: string, logoUrl: string | null | undefined, variant: "lg" | "sm") {
    const sizeClass = `pmp-avatar--${variant}`;
    const normalizedLogoUrl = logoUrl
      ? (logoUrl.startsWith("http") ? logoUrl : withPublicApiPrefix(logoUrl))
      : null;
    if (normalizedLogoUrl) {
      return (
        <img
          src={normalizedLogoUrl}
          alt={`${name} logo`}
          className={`pmp-avatar pmp-avatar-img ${sizeClass}`}
        />
      );
    }
    return (
      <div className={`pmp-avatar pmp-avatar-initials ${sizeClass}`}>
        {initials(name)}
      </div>
    );
  }

  function getCurrentView() {
    if (mode === "strategic") return strategicView;
    if (mode === "suppliers") return supplierView;
    if (mode === "channels") return channelView;
    return "grid";
  }

  const currentView = getCurrentView();

  return (
    <div className="pmp-root">
      <NavBar activePath={window.location.pathname} />
      <main className="pmp-main">
        <section className="pmp-section-header">
          <h1 className="pmp-title">{title}</h1>
          <p className="pmp-subtitle">Canli veritabanindan ozet liste.</p>
          {mode === "strategic" ? (
            <div className="pmp-view-toggle">
              <button type="button" onClick={() => setStrategicView("list")} className={strategicView === "list" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Liste</button>
              <button type="button" onClick={() => setStrategicView("grid")} className={strategicView === "grid" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Kart</button>
            </div>
          ) : null}
          {mode === "suppliers" ? (
            <div className="pmp-view-toggle">
              <button type="button" onClick={() => setSupplierView("list")} className={supplierView === "list" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Liste</button>
              <button type="button" onClick={() => setSupplierView("grid")} className={supplierView === "grid" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Kart</button>
            </div>
          ) : null}
          {mode === "channels" ? (
            <div className="pmp-view-toggle">
              <button type="button" onClick={() => setChannelView("list")} className={channelView === "list" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Liste</button>
              <button type="button" onClick={() => setChannelView("grid")} className={channelView === "grid" ? "pmp-view-btn pmp-view-btn--active" : "pmp-view-btn"}>Kart</button>
            </div>
          ) : null}
        </section>
        <section className={currentView === "list" ? "pmp-section-grid pmp-section-grid--list" : "pmp-section-grid pmp-section-grid--cards"}>
          {offerMessage ? (
            <article className="pmp-offer-msg">
              <div>{offerMessage}</div>
              <div className="pmp-offer-msg-actions">
                <a href="/supplier/login" className="pmp-offer-login-link">Giriş Yap</a>
                <a href="/fiyatlandirma#tedarikci" className="pmp-offer-upgrade-link">Üyeliği Yükselt</a>
                <button type="button" onClick={() => setOfferMessage(null)} className="pmp-offer-close-btn">Kapat</button>
              </div>
            </article>
          ) : null}
          {(rows as Array<Record<string, unknown>>).map((row) => (
            <article key={row.id as number} className="pmp-article">
              {mode === "offers" && (
                <>
                  <div className="pmp-row-header">
                    {renderAvatar(String(row.company_name ?? ""), row.company_logo_url as string | null, "lg")}
                    <div className="pmp-info">
                      <div className="pmp-offer-title">{row.title as string}</div>
                      <div className="pmp-offer-meta">{row.company_name as string} / {row.project_name as string}</div>
                      <div className="pmp-offer-city">
                        Şehir: {(row.project_city as string) || "-"} | Proje No: {(row.project_code as string) || "-"}
                      </div>
                      <div className="pmp-offer-stats">
                        Tedarikçi sayısı: {(row.supplier_count as number) || 0} | Teklif sayısı: {(row.bidder_count as number) || 0}
                      </div>
                    </div>
                  </div>
                  <div className="pmp-offer-actions">
                    <button type="button" onClick={() => void loadFiles(row.id as number)} className="pmp-files-btn">
                      Dosyaları Görüntüle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOfferClick(row as { offer_allowed?: boolean; id: number })}
                      className={row.offer_allowed ? "pmp-offer-btn pmp-offer-btn--allowed" : "pmp-offer-btn pmp-offer-btn--blocked"}
                    >
                      Teklif Ver
                    </button>
                    <button type="button" onClick={() => void loadBidders(row.id as number)} className="pmp-bidders-btn">
                      Teklif Veren Firmalar
                    </button>
                  </div>
                  {filesByQuote[row.id as number] ? (
                    <ul className="pmp-file-list">
                      {filesByQuote[row.id as number].length === 0
                        ? <li>Dosya bulunamad?.</li>
                        : filesByQuote[row.id as number].map((item) => <li key={item.id}>{item.name}</li>)}
                    </ul>
                  ) : null}
                </>
              )}
              {mode === "suppliers" && (
                <div className={currentView === "list" ? "pmp-entity-header pmp-entity-header--list" : "pmp-entity-header pmp-entity-header--grid"}>
                  {renderAvatar(String(row.company_name ?? ""), row.logo_url as string | null, currentView === "list" ? "lg" : "sm")}
                  <div className="pmp-info">
                    <div className="pmp-entity-name pmp-entity-name--list">{row.company_name as string}</div>
                    <div className="pmp-entity-meta">
                      {row.city as string} | {row.category as string} | Davet: {row.invite_count as number}
                    </div>
                  </div>
                </div>
              )}
              {mode === "strategic" && (
                <div className={currentView === "list" ? "pmp-entity-header pmp-entity-header--list" : "pmp-entity-header pmp-entity-header--grid"}>
                  {renderAvatar(String(row.name ?? ""), row.logo_url as string | null, currentView === "list" ? "lg" : "sm")}
                  <div className="pmp-info">
                    <div className={currentView === "list" ? "pmp-entity-name pmp-entity-name--list" : "pmp-entity-name pmp-entity-name--grid"}>
                      {row.name as string}
                    </div>
                    <div className="pmp-entity-meta">
                      Şehir: {row.city as string} | Proje: {row.project_count as number} | İhale: {(row.tender_count as number) ?? 0}
                    </div>
                  </div>
                </div>
              )}
              {mode === "channels" && (
                <div className={currentView === "list" ? "pmp-entity-header pmp-entity-header--list" : "pmp-entity-header pmp-entity-header--grid"}>
                  {renderAvatar(String(row.name ?? ""), row.logo_url as string | null, currentView === "list" ? "lg" : "sm")}
                  <div className="pmp-info">
                    <div className={currentView === "list" ? "pmp-entity-name pmp-entity-name--list" : "pmp-entity-name pmp-entity-name--grid"}>
                      {row.name as string}
                    </div>
                    <div className="pmp-entity-meta">Referans: {row.referral_count as number}</div>
                    <div className="pmp-entity-score">Basari Puani: {row.success_score as number}</div>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
        {activeBiddersQuoteId !== null ? (
          <div className="pmp-modal-overlay" onClick={() => setActiveBiddersQuoteId(null)}>
            <div className="pmp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="pmp-modal-header">
                <div className="pmp-modal-title">Teklif Veren Firmalar</div>
                <button type="button" onClick={() => setActiveBiddersQuoteId(null)} className="pmp-modal-close-btn">Kapat</button>
              </div>
              <ul className="pmp-modal-list">
                {(biddersByQuote[activeBiddersQuoteId] || []).length === 0 ? (
                  <li>Henuz teklif veren firma yok.</li>
                ) : (
                  (biddersByQuote[activeBiddersQuoteId] || []).map((item, idx) => <li key={`${item.company_name}-${idx}`}>{item.company_name} - {item.city}</li>)
                )}
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
