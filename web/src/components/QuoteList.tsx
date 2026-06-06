// QuoteList Component
import { useEffect, useState, useCallback } from "react";
import { getRfqs, deleteRfq } from "../services/quote.service";
import type { Rfq as Quote } from "../services/quote.service";
import { Link, useNavigate } from "react-router-dom";
import {
  QuoteStatusLabel,
  normalizeQuoteStatus,
} from "../types/quote.types";
import { http } from "../lib/http";
import SendQuoteModal from "./SendQuoteModal";
import { useAuth } from "../hooks/useAuth";
import {
  canAccessAdminSurface,
  canManageQuoteWorkspace,
  canReviewApprovals,
  getRoleIcon,
  getUserDisplayRoleLabel,
  isPlatformStaffUser,
  normalizedBusinessRole,
} from "../auth/permissions";
import WorkspaceHeroCard from "./WorkspaceHeroCard";
import {
  buildWorkspacePanelTheme,
  mergeWorkspacePanelConfig,
  resolveWorkspacePanelProfile,
} from "../admin/workspace-panels";
import {
  getWorkspacePanelConfig,
  type WorkspacePanelConfig,
} from "../services/admin.service";
import "./QuoteList.css";

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
  const [projectSuppliers, setProjectSuppliers] = useState<
    Array<{
      id: number;
      supplier_id: number;
      supplier_name: string;
      supplier_email: string;
      source_type?: "private" | "platform_network";
      category?: string;
      is_active: boolean;
    }>
  >([]);
  const [pendingApprovalQuoteIds, setPendingApprovalQuoteIds] = useState<Set<number>>(new Set());
  const [workspacePanelConfig, setWorkspacePanelConfig] = useState<WorkspacePanelConfig | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const isReworkFilter = statusFilter === "rework";
      if (isReworkFilter) {
        const bulk = await getRfqs(1, 500, undefined);
        const reworkItems = (bulk.items || []).filter((item) =>
          String(item.transition_reason || "").toLowerCase().startsWith("hata ve eksikler var"),
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
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Teklif yüklenemedi");
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
  const activeWorkspacePanelProfile = resolveWorkspacePanelProfile(
    user,
    mergeWorkspacePanelConfig(workspacePanelConfig),
  );
  const workspaceTheme = buildWorkspacePanelTheme(activeWorkspacePanelProfile);

  const handleDelete = async (quoteId: number) => {
    if (!window.confirm("Bu teklifi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteRfq(quoteId);
      await fetchQuotes();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Teklif silinemedi");
    }
  };

  const openSendModal = async (quote: Quote) => {
    try {
      const response = await http.get(`/suppliers/projects/${quote.project_id}/suppliers`);
      setProjectSuppliers(Array.isArray(response.data) ? response.data : []);
      setSendTarget(quote);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Projeye ekli tedarikçiler yüklenemedi");
    }
  };

  if (loading) {
    return <div className="quote-list__loading">Yükleniyor...</div>;
  }

  return (
    <div className="quote-list">
      {sendTarget ? (
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
      ) : null}

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

      <div className="quote-list__section">
        <h3 className="quote-list__heading">Teklifler ({total})</h3>

        {readOnly ? (
          <div className="quote-list__notice">
            Platform personeli teklif portföyünü inceleyebilir; yeni teklif, düzenleme, silme ve gönderim aksiyonları salt okunur modda kapatıldı.
          </div>
        ) : null}

        <div className="quote-list__filters">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="quote-list__select"
            aria-label="Teklif durum filtresi"
            title="Teklif durum filtresi"
          >
            <option value="">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="submitted">Gönderildi</option>
            <option value="rework">İade Edildi (Gözden Geçirme)</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>

          {isPlatformPortfolioView ? (
            <select
              value={listingFilter}
              onChange={(event) => setListingFilter(event.target.value)}
              className="quote-list__select"
              aria-label="Listeleme tipi filtresi"
              title="Listeleme tipi filtresi"
            >
              <option value="all">Tüm Listeleme Tipleri</option>
              <option value="private_suppliers_only">Sadece kendi tedarikçileri</option>
              <option value="platform_network_only">Platform ağına açık</option>
              <option value="private_and_platform_network">Karma havuz</option>
              <option value="premium_featured_listing">Premium / özel listeleme</option>
              <option value="draft_unpublished">Yayınlanmamış</option>
            </select>
          ) : null}

          {canManageQuotes ? (
            <Link to="/quotes/create" className="quote-list__button-link">
              <button type="button" className="quote-list__button quote-list__button--primary">
                + Yeni Teklif
              </button>
            </Link>
          ) : null}
        </div>

        {error ? <div className="quote-list__error">{error}</div> : null}

        {isPlatformPortfolioView ? (
          <div className="quote-list__summary-grid">
            {[
              {
                label: "Kendi Tedarikçileri",
                value: listingSummary.private_only,
                variant: "blue",
              },
              {
                label: "Platform Ağı",
                value: listingSummary.platform,
                variant: "teal",
              },
              {
                label: "Karma Havuz",
                value: listingSummary.mixed,
                variant: "purple",
              },
              {
                label: "Premium Listeleme",
                value: listingSummary.premium,
                variant: "amber",
              },
            ].map((card) => (
              <div key={card.label} className={`quote-list__summary-card quote-list__summary-card--${card.variant}`}>
                <div className={`quote-list__summary-label quote-list__summary-label--${card.variant}`}>
                  {card.label}
                </div>
                <div className={`quote-list__summary-value quote-list__summary-value--${card.variant}`}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {visibleQuotes.length === 0 ? (
          <p className="quote-list__empty">Teklif bulunamadı</p>
        ) : isPlatformPortfolioView ? (
          <div className="quote-list__group-list">
            {Object.entries(groupedQuotes).map(([tenantName, tenantQuotes]) => (
              <section key={tenantName} className="quote-list__group">
                <div className="quote-list__group-header">
                  <div>
                    <div className="quote-list__group-title">{tenantName}</div>
                    <div className="quote-list__group-subtitle">{tenantQuotes.length} teklif kaydı</div>
                  </div>
                </div>

                <div className="quote-list__cards">
                  {tenantQuotes.map((quote) => {
                    const premiumCodes = quote.active_premium_feature_codes || [];
                    return (
                      <article key={quote.id} className="quote-list__card">
                        <div className="quote-list__card-header">
                          <div>
                            <div className="quote-list__card-title">{quote.title}</div>
                            <div className="quote-list__card-meta">
                              RFQ #{quote.rfq_id ?? quote.id} • {quote.company_name}
                            </div>
                          </div>
                          <div className="quote-list__card-amount">
                            {(quote.total_amount || quote.amount || 0).toLocaleString("tr-TR", {
                              style: "currency",
                              currency: "TRY",
                            })}
                          </div>
                        </div>

                        <div className="quote-list__badges">
                          <span className="quote-list__badge quote-list__badge--blue">
                            {quote.listing_scope_label || "Listeleme tipi yok"}
                          </span>
                          <span className="quote-list__badge quote-list__badge--gray">
                            {quote.package_plan_name || quote.package_plan_code || "Plan yok"}
                          </span>
                          {premiumCodes.length > 0 ? (
                            <span className="quote-list__badge quote-list__badge--amber">
                              Premium: {premiumCodes.join(", ")}
                            </span>
                          ) : null}
                        </div>

                        <div className="quote-list__stats-grid">
                          <div className="quote-list__stats-card">
                            <div className="quote-list__stats-label">Davet Kapsamı</div>
                            <div className="quote-list__stats-value">{quote.invited_supplier_count || 0}</div>
                            <div className="quote-list__stats-note">Toplam davet edilen supplier</div>
                          </div>
                          <div className="quote-list__stats-card">
                            <div className="quote-list__stats-label">Kendi Supplier'i</div>
                            <div className="quote-list__stats-value">{quote.private_supplier_count || 0}</div>
                            <div className="quote-list__stats-note">Private supplier havuzu</div>
                          </div>
                          <div className="quote-list__stats-card">
                            <div className="quote-list__stats-label">Platform Supplier</div>
                            <div className="quote-list__stats-value">{quote.platform_network_supplier_count || 0}</div>
                            <div className="quote-list__stats-note">Platform ağından eşleşen supplier</div>
                          </div>
                          <div className="quote-list__stats-card">
                            <div className="quote-list__stats-label">Gelen Yanıt</div>
                            <div className="quote-list__stats-value">{quote.responded_supplier_count || 0}</div>
                            <div className="quote-list__stats-note">Teklif veren supplier sayısı</div>
                          </div>
                        </div>

                        <div className="quote-list__card-footer">
                          <Link to={`/quotes/${quote.id}`} className="quote-list__link">
                            Goruntule
                          </Link>
                          <Link to={`/quotes/${quote.id}/comparison`} className="quote-list__link quote-list__link--secondary">
                            Karsilastirma
                          </Link>
                          <span className="quote-list__date">{new Date(quote.created_at).toLocaleDateString("tr-TR")}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="quote-list__table-wrap">
            <table className="quote-list__table">
              <thead className="quote-list__table-head">
                <tr>
                  <th className="quote-list__table-th">Başlık</th>
                  <th className="quote-list__table-th quote-list__table-th--right">Tutar</th>
                  <th className="quote-list__table-th">Durum</th>
                  <th className="quote-list__table-th">Ver</th>
                  <th className="quote-list__table-th quote-list__table-th--center">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuotes.map((quote) => {
                  const quoteStatus = normalizeQuoteStatus(quote.status);
                  const rawStatus = String(quote.status || "").toLowerCase();
                  const approvalsCompleted = String(quote.transition_reason || "")
                    .toLowerCase()
                    .includes("gönderim onayları tamamlandı");
                  const sentToSuppliers = Boolean(quote.sent_at);
                  const canSendToSuppliers = quoteStatus === "submitted";
                  const canEditQuote =
                    canManageQuotes &&
                    (quoteStatus === "draft" || quoteStatus === "submitted") &&
                    !approvalsCompleted &&
                    !sentToSuppliers;
                  const canDeleteQuote = canManageQuotes;
                  const reviewBack =
                    quoteStatus === "draft" &&
                    String(quote.transition_reason || "").toLowerCase().startsWith("hata ve eksikler var");
                  const badgeLabel = reviewBack
                    ? "İade Edildi (Gözden Geçirme)"
                    : rawStatus === "approved"
                      ? "Teklif Sözleşme Aşamasına Geçti - Kapatıldı"
                      : rawStatus === "responded"
                        ? "Tedarikçi Yanıtladı"
                        : sentToSuppliers
                          ? "Tedarikçiye Gönderildi - Yanıt Bekleniyor"
                          : quoteStatus === "submitted" && approvalsCompleted
                            ? "Onaylandı (Gönderime Hazır)"
                            : QuoteStatusLabel[quoteStatus];
                  return (
                    <tr key={quote.id} className="quote-list__table-row">
                      <td className="quote-list__table-td">
                        <div className="quote-list__table-title">{quote.title}</div>
                        <div className="quote-list__card-meta">RFQ #{quote.rfq_id ?? quote.id}</div>
                      </td>
                      <td className="quote-list__table-td quote-list__table-td--right">
                        {(quote.total_amount || quote.amount || 0).toLocaleString("tr-TR", {
                          style: "currency",
                          currency: "TRY",
                        })}
                      </td>
                      <td className="quote-list__table-td">
                        <span
                          className={
                            reviewBack
                              ? "quote-list__status-badge quote-list__status-badge--danger"
                              : `quote-list__status-badge quote-list__status-badge--${quoteStatus}`
                          }
                        >
                          {badgeLabel}
                        </span>
                        {reviewBack ? (
                          <div className="quote-list__status-note quote-list__status-note--danger">
                            {quote.transition_reason}
                          </div>
                        ) : null}
                        {pendingApprovalQuoteIds.has(quote.id) ? (
                          <div className="quote-list__status-note quote-list__status-note--warning">
                            Tedarikçiye gönderme onayınız bekleniyor
                          </div>
                        ) : null}
                      </td>
                      <td className="quote-list__table-td">{new Date(quote.created_at).toLocaleDateString("tr-TR")}</td>
                      <td className="quote-list__table-td quote-list__table-td--center">
                        <div className="quote-list__actions">
                          <Link to={`/quotes/${quote.id}`} className="quote-list__link">
                            Goruntule
                          </Link>
                          {canManageQuotes ? (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                                disabled={!canEditQuote}
                                title={canEditQuote ? "Teklifi düzenle" : "Onaylanan teklif düzenlenemez"}
                                className="quote-list__action-button quote-list__action-button--edit"
                              >
                                Düzenle
                              </button>
                              {canDeleteQuote ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(quote.id)}
                                  className="quote-list__action-button quote-list__action-button--delete"
                                >
                                  Sil
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openSendModal(quote)}
                                disabled={!canSendToSuppliers}
                                title={canSendToSuppliers ? "Teklifi tedarikçilere gönder" : "Bu durumda teklif tekrar gönderilemez"}
                                className="quote-list__action-button quote-list__action-button--send"
                              >
                                Gönder
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 10 ? (
          <div className="quote-list__pagination">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              className="quote-list__pagination-button"
            >
              Önceki
            </button>
            <span className="quote-list__pagination-label">
              Sayfa {page} / {Math.ceil(total / 10)}
            </span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(Math.ceil(total / 10), currentPage + 1))}
              disabled={page >= Math.ceil(total / 10)}
              className="quote-list__pagination-button"
            >
              Sonraki
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
