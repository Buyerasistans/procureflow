// QuoteList Component
import { useEffect, useState, useCallback } from "react";
import { getRfqs, deleteRfq } from "../services/quote.service";
import type { Rfq as Quote } from "../services/quote.service";
import { Link, useNavigate } from "react-router-dom";
import {
  QuoteStatusLabel,
  QuoteStatusColor,
  normalizeQuoteStatus,
} from "../types/quote.types";
import { http } from "../lib/http";
import SendQuoteModal from "./SendQuoteModal";
import { useAuth } from "../hooks/useAuth";
import { canAccessAdminSurface, canManageQuoteWorkspace, canReviewApprovals, getRoleIcon, getUserDisplayRoleLabel, isPlatformStaffUser, normalizedBusinessRole } from "../auth/permissions";
import WorkspaceHeroCard from "./WorkspaceHeroCard";
import { buildWorkspacePanelTheme, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile } from "../admin/workspace-panels";
import { getWorkspacePanelConfig, type WorkspacePanelConfig } from "../services/admin.service";

interface QuoteListProps {
  showHero?: boolean;
}

export default function QuoteList({ showHero = true }: QuoteListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const readOnly = isPlatformStaffUser(user);
  const isPlatformPortfolioView = canAccessAdminSurface(user);
  const canManageQuotes = canManageQuoteWorkspace(user);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [listingFilter, setListingFilter] = useState<string>("all");
  const [sendTarget, setSendTarget] = useState<Quote | null>(null);
  const [projectSuppliers, setProjectSuppliers] = useState<Array<{ id: number; supplier_id: number; supplier_name: string; supplier_email: string; source_type?: "private" | "platform_network"; category?: string; is_active: boolean }>>([]);
  const [pendingApprovalQuoteIds, setPendingApprovalQuoteIds] = useState<Set<number>>(new Set());
  const [workspacePanelConfig, setWorkspacePanelConfig] = useState<WorkspacePanelConfig | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const isReworkFilter = statusFilter === "rework";
      if (isReworkFilter) {
        const bulk = await getRfqs(1, 500, undefined);
        const reworkItems = (bulk.items || []).filter(
          (item) => String(item.transition_reason || "").toLowerCase().startsWith("hata ve eksikler var")
        );
        const offset = (page - 1) * 10;
        setQuotes(reworkItems.slice(offset, offset + 10));
        setTotal(reworkItems.length);
      } else {
        const data = await getRfqs(page, 10, statusFilter || undefined);
        setQuotes(data.items);
        setTotal(data.total);
      }
      if (canReviewApprovals(user)) {
        const pending = await http.get<Array<{ quote_id: number }>>("/approvals/user/pending");
        const quoteIdSet = new Set((pending.data || []).map((row) => Number(row.quote_id)));
        setPendingApprovalQuoteIds(quoteIdSet);
      } else {
        setPendingApprovalQuoteIds(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teklif yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, user]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    let mounted = true;
    void getWorkspacePanelConfig()
      .then((config) => {
        if (mounted) setWorkspacePanelConfig(config);
      })
      .catch(() => {
        if (mounted) setWorkspacePanelConfig(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visibleQuotes = quotes.filter((quote) => {
    if (listingFilter === "all") {
      return true;
    }
    return String(quote.listing_scope || "") === listingFilter;
  });

  const groupedQuotes = visibleQuotes.reduce<Record<string, Quote[]>>((accumulator, quote) => {
    const key = String(quote.published_by_tenant_name || quote.company_name || "Firma belirtilmedi");
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(quote);
    return accumulator;
  }, {});

  const listingSummary = {
    private_only: quotes.filter((quote) => quote.listing_scope === "private_suppliers_only").length,
    platform: quotes.filter((quote) => quote.listing_scope === "platform_network_only").length,
    mixed: quotes.filter((quote) => quote.listing_scope === "private_and_platform_network").length,
    premium: quotes.filter((quote) => quote.listing_scope === "premium_featured_listing").length,
  };
  const roleLabel = user ? getUserDisplayRoleLabel(user) : "";
  const roleIcon = getRoleIcon(normalizedBusinessRole(user));
  const userName = user?.full_name || "Buyera Asistans";
  const userEmail = user?.email || "";
  const activeWorkspacePanelProfile = resolveWorkspacePanelProfile(user, mergeWorkspacePanelConfig(workspacePanelConfig));
  const workspaceTheme = buildWorkspacePanelTheme(activeWorkspacePanelProfile);

  const handleDelete = async (quoteId: number) => {
    if (!window.confirm("Bu teklifi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteRfq(quoteId);
      await fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teklif silinemedi");
    }
  };

  const openSendModal = async (quote: Quote) => {
    try {
      const res = await http.get(`/suppliers/projects/${quote.project_id}/suppliers`);
      setProjectSuppliers(Array.isArray(res.data) ? res.data : []);
      setSendTarget(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projeye ekli tedarikçiler yüklenemedi");
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 20 }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: "16px" }}>
      {sendTarget && (
        <SendQuoteModal
          quote={sendTarget}
          quoteId={sendTarget.id}
          projectId={Number(sendTarget.project_id || 0)}
          suppliers={projectSuppliers}
          onClose={() => setSendTarget(null)}
          onSent={async () => {
            setSendTarget(null);
            await fetchQuotes();
          }}
        />
      )}
      {showHero ? (
        <WorkspaceHeroCard
          title={activeWorkspacePanelProfile?.hero_title || "Teklif Yönetim Paneli"}
          subtitle={activeWorkspacePanelProfile?.hero_description || `${roleIcon} Platform Super Admin • ${roleLabel}`}
          userName={userName}
          userEmail={userEmail}
          accentGradient={workspaceTheme.accentGradient}
          topNotice={workspaceTheme.topNotice}
          headerInfo={workspaceTheme.headerInfo}
          footerInfo={workspaceTheme.footerInfo}
          headerBgColor={workspaceTheme.headerBgColor}
          headerTextColor={workspaceTheme.headerTextColor}
          footerBgColor={workspaceTheme.footerBgColor}
          footerTextColor={workspaceTheme.footerTextColor}
          heroTextColor={workspaceTheme.heroTextColor}
          heroMutedTextColor={workspaceTheme.heroMutedTextColor}
        />
      ) : null}

      <div style={{ marginBottom: "20px" }}>
        <h3>Teklifler ({total})</h3>

        {readOnly && (
          <div style={{ marginBottom: "12px", padding: "10px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", color: "#1e3a8a" }}>
            Platform personeli teklif portfoyunu inceleyebilir; yeni teklif, duzenleme, silme ve gonderim aksiyonlari salt okunur modda kapatildi.
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          >
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="submitted">Gönderildi</option>
            <option value="rework">İade Edildi (Gözden Geçirme)</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>

          {isPlatformPortfolioView && (
            <select
              value={listingFilter}
              onChange={(e) => setListingFilter(e.target.value)}
              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
            >
              <option value="all">Tum Listeleme Tipleri</option>
              <option value="private_suppliers_only">Sadece kendi tedarikcileri</option>
              <option value="platform_network_only">Platform agina acik</option>
              <option value="private_and_platform_network">Karma havuz</option>
              <option value="premium_featured_listing">Premium / ozel listeleme</option>
              <option value="draft_unpublished">Yayinlanmamis</option>
            </select>
          )}

          {canManageQuotes && (
            <Link to="/quotes/create" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "8px 16px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                + Yeni Teklif
              </button>
            </Link>
          )}
        </div>

        {error && (
          <div style={{ color: "red", padding: "8px", background: "#fee2e2", borderRadius: "4px" }}>
            {error}
          </div>
        )}

        {isPlatformPortfolioView && (
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {[
              { label: "Kendi Tedarikcileri", value: listingSummary.private_only, color: "#1d4ed8", bg: "#eff6ff" },
              { label: "Platform Agi", value: listingSummary.platform, color: "#0f766e", bg: "#ecfdf5" },
              { label: "Karma Havuz", value: listingSummary.mixed, color: "#7c3aed", bg: "#f5f3ff" },
              { label: "Premium Listeleme", value: listingSummary.premium, color: "#b45309", bg: "#fff7ed" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 14, background: card.bg, border: "1px solid #dbe3ee", padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1, color: card.color }}>{card.label}</div>
                <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Quote List */}
        {visibleQuotes.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999" }}>Teklif bulunamadı</p>
        ) : isPlatformPortfolioView ? (
          <div style={{ display: "grid", gap: 14 }}>
            {Object.entries(groupedQuotes).map(([tenantName, tenantQuotes]) => (
              <section key={tenantName} style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "#f8fafc", padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{tenantName}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenantQuotes.length} teklif kaydi</div>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {tenantQuotes.map((quote) => {
                    const premiumCodes = quote.active_premium_feature_codes || [];
                    return (
                      <article key={quote.id} style={{ borderRadius: 16, background: "white", border: "1px solid #e2e8f0", padding: 14, display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>{quote.title}</div>
                            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>RFQ #{quote.rfq_id ?? quote.id} • {quote.company_name}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                            {(quote.total_amount || quote.amount || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ padding: "5px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>{quote.listing_scope_label || "Listeleme tipi yok"}</span>
                          <span style={{ padding: "5px 10px", borderRadius: 999, background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 800 }}>{quote.package_plan_name || quote.package_plan_code || "Plan yok"}</span>
                          {premiumCodes.length > 0 ? <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontSize: 12, fontWeight: 800 }}>Premium: {premiumCodes.join(", ")}</span> : null}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                          <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "#64748b", fontWeight: 800 }}>Davet Kapsami</div>
                            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{quote.invited_supplier_count || 0}</div>
                            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Toplam davet edilen supplier</div>
                          </div>
                          <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "#64748b", fontWeight: 800 }}>Kendi Supplier'i</div>
                            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{quote.private_supplier_count || 0}</div>
                            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Private supplier havuzu</div>
                          </div>
                          <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "#64748b", fontWeight: 800 }}>Platform Supplier</div>
                            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{quote.platform_network_supplier_count || 0}</div>
                            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Platform agindan eslesen supplier</div>
                          </div>
                          <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "#64748b", fontWeight: 800 }}>Gelen Yanit</div>
                            <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{quote.responded_supplier_count || 0}</div>
                            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Teklif veren supplier sayisi</div>
                          </div>
                        </div>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <Link to={`/quotes/${quote.id}`} style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: "bold" }}>Goruntule</Link>
                          <Link to={`/quotes/${quote.id}/comparison`} style={{ color: "#7c3aed", textDecoration: "none", fontWeight: "bold" }}>Karsilastirma</Link>
                          <span style={{ color: "#64748b", fontSize: 12 }}>{new Date(quote.created_at).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Başlık</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Tutar</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Durum</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Ver</th>
                  <th style={{ padding: "12px", textAlign: "center" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuotes.map((quote) => {
                  const quoteStatus = normalizeQuoteStatus(quote.status);
                  const rawStatus = String(quote.status || "").toLowerCase();
                  const approvalsCompleted = String(quote.transition_reason || "").toLowerCase().includes("gönderim onayları tamamlandı");
                  const sentToSuppliers = Boolean(quote.sent_at);
                  const canSendToSuppliers = quoteStatus === "submitted";
                  const canEditQuote = canManageQuotes
                    && (quoteStatus === "draft" || quoteStatus === "submitted")
                    && !approvalsCompleted
                    && !sentToSuppliers;
                  const canDeleteQuote = canManageQuotes;
                  const reviewBack = quoteStatus === "draft" && String(quote.transition_reason || "").toLowerCase().startsWith("hata ve eksikler var");
                  const badgeLabel = reviewBack
                    ? "İade Edildi (Gözden Geçirme)"
                    : rawStatus === "approved"
                      ? "Teklif Sözleşme Aşamasına Geçti - Kapatıldı"
                      : rawStatus === "responded"
                        ? "Tedarikçi Yanıtladı"
                        : sentToSuppliers
                          ? "Tedarikçiye Gönderildi - Yanıt Bekleniyor"
                          : (quoteStatus === "submitted" && approvalsCompleted)
                            ? "Onaylandı (Gönderime Hazır)"
                            : QuoteStatusLabel[quoteStatus];
                  const badgeColor = reviewBack ? "#fee2e2" : QuoteStatusColor[quoteStatus];
                  return (
                  <tr key={quote.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600 }}>{quote.title}</div>
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                        RFQ #{quote.rfq_id ?? quote.id}
                      </div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>
                      {(quote.total_amount || quote.amount || 0).toLocaleString("tr-TR", {
                        style: "currency",
                        currency: "TRY",
                      })}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: badgeColor,
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: reviewBack ? "#991b1b" : "inherit",
                        }}
                      >
                        {badgeLabel}
                      </span>
                      {reviewBack && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#991b1b" }}>
                          {quote.transition_reason}
                        </div>
                      )}
                      {pendingApprovalQuoteIds.has(quote.id) && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#92400e", fontWeight: 600 }}>
                          Tedarikçiye gönderme onayınız bekleniyor
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px" }}>
                      {new Date(quote.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                        <Link
                          to={`/quotes/${quote.id}`}
                          style={{ color: "#3b82f6", textDecoration: "none", fontWeight: "bold" }}
                        >
                          Görüntüle
                        </Link>
                        {canManageQuotes && (
                          <>
                            <button
                              onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                              disabled={!canEditQuote}
                              title={canEditQuote ? "Teklifi düzenle" : "Onaylanan teklif düzenlenemez"}
                              style={{ border: "none", background: "transparent", color: canEditQuote ? "#0f766e" : "#9ca3af", cursor: canEditQuote ? "pointer" : "not-allowed", fontWeight: 700 }}
                            >
                              Düzenle
                            </button>
                            {canDeleteQuote && (
                              <button
                                onClick={() => handleDelete(quote.id)}
                                style={{ border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}
                              >
                                Sil
                              </button>
                            )}
                            <button
                              onClick={() => openSendModal(quote)}
                              disabled={!canSendToSuppliers}
                              title={canSendToSuppliers ? "Teklifi tedarikçilere gönder" : "Bu durumda teklif tekrar gönderilemez"}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: canSendToSuppliers ? "#1d4ed8" : "#9ca3af",
                                cursor: canSendToSuppliers ? "pointer" : "not-allowed",
                                fontWeight: 700,
                              }}
                            >
                              Gönder
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 10 && (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "center", gap: "8px" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: page === 1 ? "not-allowed" : "pointer",
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              Önceki
            </button>
            <span style={{ padding: "8px 12px" }}>
              Sayfa {page} / {Math.ceil(total / 10)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(total / 10), p + 1))}
              disabled={page >= Math.ceil(total / 10)}
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: page >= Math.ceil(total / 10) ? "not-allowed" : "pointer",
                opacity: page >= Math.ceil(total / 10) ? 0.5 : 1,
              }}
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
