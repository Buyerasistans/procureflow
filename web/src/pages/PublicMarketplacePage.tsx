import { useEffect, useMemo, useState } from "react";
import NavBar from "../components/NavBar";
import { withPublicApiPrefix } from "../lib/public-api";
import { getToken } from "../lib/session";

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
    mode === "offers" ? "Acik Ihaleler" :
    mode === "suppliers" ? "Tedarikci Havuzu" :
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

  function handleOfferClick(row: any) {
    const token = getToken();
    if (!token) {
      setOfferMessage("Teklif vermek için önce giriş yapmalısınız. Giriş sonrası yetkiniz kontrol edilip otomatik devam edilir.");
      return;
    }
    if (!row.offer_allowed) {
      setOfferMessage("Bu ihale icin havuz hakkiniz aktif degil. Uyeliginizi yukselterek veya havuz odemesi ile teklif hakki acabilirsiniz.");
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

  function renderAvatar(name: string, logoUrl?: string | null, size = 54) {
    const normalizedLogoUrl = logoUrl
      ? (logoUrl.startsWith("http") ? logoUrl : withPublicApiPrefix(logoUrl))
      : null;
    if (normalizedLogoUrl) {
      return (
        <img
          src={normalizedLogoUrl}
          alt={`${name} logo`}
          style={{ width: size, height: size, objectFit: "contain", borderRadius: 10, border: "1px solid #dbe2ef", background: "#fff", flexShrink: 0 }}
        />
      );
    }
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          border: "1px solid #dbe2ef",
          background: "linear-gradient(135deg,#0f172a,#1d4ed8)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: Math.max(14, Math.floor(size / 2.6)),
          flexShrink: 0,
        }}
      >
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
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', sans-serif" }}>
      <NavBar activePath={window.location.pathname} />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 56px" }}>
        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0, fontSize: 30, color: "#0f172a" }}>{title}</h1>
          <p style={{ marginTop: 8, color: "#64748b" }}>Canli veritabanindan ozet liste.</p>
          {mode === "strategic" ? (
            <div style={{ marginTop: 12, display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setStrategicView("list")}
                style={{
                  border: "none",
                  background: strategicView === "list" ? "#1d4ed8" : "#fff",
                  color: strategicView === "list" ? "#fff" : "#334155",
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={() => setStrategicView("grid")}
                style={{
                  border: "none",
                  background: strategicView === "grid" ? "#1d4ed8" : "#fff",
                  color: strategicView === "grid" ? "#fff" : "#334155",
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Kart
              </button>
            </div>
          ) : null}
          {mode === "suppliers" ? (
            <div style={{ marginTop: 12, display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => setSupplierView("list")} style={{ border: "none", background: supplierView === "list" ? "#1d4ed8" : "#fff", color: supplierView === "list" ? "#fff" : "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Liste</button>
              <button type="button" onClick={() => setSupplierView("grid")} style={{ border: "none", background: supplierView === "grid" ? "#1d4ed8" : "#fff", color: supplierView === "grid" ? "#fff" : "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Kart</button>
            </div>
          ) : null}
          {mode === "channels" ? (
            <div style={{ marginTop: 12, display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => setChannelView("list")} style={{ border: "none", background: channelView === "list" ? "#1d4ed8" : "#fff", color: channelView === "list" ? "#fff" : "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Liste</button>
              <button type="button" onClick={() => setChannelView("grid")} style={{ border: "none", background: channelView === "grid" ? "#1d4ed8" : "#fff", color: channelView === "grid" ? "#fff" : "#334155", padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}>Kart</button>
            </div>
          ) : null}
        </section>
        <section
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns:
              currentView === "list"
                ? "1fr"
                : "repeat(auto-fit,minmax(260px,1fr))",
            gap: 12,
          }}
        >
          {offerMessage ? (
            <article style={{ gridColumn: "1 / -1", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, color: "#9a3412" }}>
              <div>{offerMessage}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href="/supplier/login" style={{ background: "#1d4ed8", color: "#fff", borderRadius: 8, padding: "6px 10px", textDecoration: "none", fontWeight: 700 }}>Giriş Yap</a>
                <a href="/fiyatlandirma#tedarikci" style={{ background: "#0f766e", color: "#fff", borderRadius: 8, padding: "6px 10px", textDecoration: "none", fontWeight: 700 }}>Uyeligi Yukselti</a>
                <button type="button" onClick={() => setOfferMessage(null)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Kapat</button>
              </div>
            </article>
          ) : null}
          {rows.map((row: any) => (
            <article key={row.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              {mode === "offers" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {renderAvatar(row.company_name, row.company_logo_url, 72)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#0f172a", textAlign: "left" }}>{row.title}</div>
                      <div style={{ color: "#475569", marginTop: 6, textAlign: "left" }}>{row.company_name} / {row.project_name}</div>
                      <div style={{ color: "#64748b", marginTop: 4, textAlign: "left" }}>
                        Sehir: {row.project_city || "-"} | Proje No: {row.project_code || "-"}
                      </div>
                      <div style={{ marginTop: 8, color: "#0b5d4a", fontWeight: 700, textAlign: "left" }}>
                        Tedarikci sayisi: {row.supplier_count || 0} | Teklif sayisi: {row.bidder_count || 0}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => void loadFiles(row.id)}
                      style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Dosyalari Goruntule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOfferClick(row)}
                      style={{
                        border: "1px solid #16a34a",
                        background: row.offer_allowed ? "#16a34a" : "#e2e8f0",
                        color: row.offer_allowed ? "#fff" : "#475569",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Teklif Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadBidders(row.id)}
                      style={{ border: "1px solid #334155", background: "#fff", borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer", color: "#0f172a" }}
                    >
                      Teklif Veren Firmalar
                    </button>
                  </div>
                  {filesByQuote[row.id] ? (
                    <ul style={{ marginTop: 8, paddingLeft: 18, color: "#475569", fontSize: 13 }}>
                      {filesByQuote[row.id].length === 0 ? <li>Dosya bulunamadi.</li> : filesByQuote[row.id].map((item) => <li key={item.id}>{item.name}</li>)}
                    </ul>
                  ) : null}
                </>
              )}
              {mode === "suppliers" && (
                <>
                  <div style={{ display: "flex", alignItems: currentView === "list" ? "center" : "flex-start", gap: 12, flexDirection: currentView === "list" ? "row" : "column" }}>
                    {renderAvatar(row.company_name, row.logo_url, currentView === "list" ? 72 : 54)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{row.company_name}</div>
                      <div style={{ color: "#475569", marginTop: 6 }}>
                        {row.city} | {row.category} | Davet: {row.invite_count}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {mode === "strategic" && (
                <>
                  <div style={{ display: "flex", alignItems: currentView === "list" ? "center" : "flex-start", gap: 12, flexDirection: currentView === "list" ? "row" : "column" }}>
                    {renderAvatar(row.name, row.logo_url, currentView === "list" ? 72 : 54)}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          lineHeight: 1.25,
                          maxWidth: currentView === "list" ? 420 : "100%",
                        }}
                      >
                        {row.name}
                      </div>
                      <div style={{ color: "#475569", marginTop: 6 }}>
                        Sehir: {row.city} | Proje: {row.project_count} | Ihale: {row.tender_count ?? 0}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {mode === "channels" && (
                <>
                  <div style={{ display: "flex", alignItems: currentView === "list" ? "center" : "flex-start", gap: 12, flexDirection: currentView === "list" ? "row" : "column" }}>
                    {renderAvatar(row.name, row.logo_url, currentView === "list" ? 72 : 54)}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#0f172a",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          lineHeight: 1.25,
                          maxWidth: currentView === "list" ? 420 : "100%",
                        }}
                      >
                        {row.name}
                      </div>
                      <div style={{ color: "#475569", marginTop: 6 }}>Referans: {row.referral_count}</div>
                      <div style={{ marginTop: 4, color: "#0b5d4a", fontWeight: 700 }}>Basari Puani: {row.success_score}</div>
                    </div>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>
        {activeBiddersQuoteId !== null ? (
          <div
            onClick={() => setActiveBiddersQuoteId(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 1000,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{ width: "min(560px, 100%)", maxHeight: "70vh", overflowY: "auto", background: "#fff", borderRadius: 12, border: "1px solid #cbd5e1", padding: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, color: "#1e3a8a", fontSize: 20 }}>Teklif Veren Firmalar</div>
                <button type="button" onClick={() => setActiveBiddersQuoteId(null)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Kapat</button>
              </div>
              <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 18, color: "#334155", fontSize: 14, lineHeight: 1.8 }}>
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
