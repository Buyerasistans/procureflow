import { useMemo, useState } from "react";
import PublicBrandLogo from "../../components/PublicBrandLogo";
import { getScopeLabel, getUserScopeType, isSuperAdminUser, isTenantAdminUser } from "../../auth/permissions";
import type { AuthUser } from "../../context/auth-types";
import type { CatalogRequest } from "../../services/admin.service";
import "./ScopeWorkspaceHome.css";

type QuickLink = {
  label: string;
  href: string;
  description: string;
};

type Props = {
  user: AuthUser | null;
  currentUserRoleLabel: string;
  title: string;
  description: string;
  platformMetrics?: {
    partnerCompanies: number;
    partnerActiveCompanies: number;
    partnerPassiveCompanies: number;
    partnerPersonnel: number;
    partnerProjects: number;
    partnerQuotes: number;
    supplierCompanies: number;
    supplierActiveCompanies: number;
    supplierPassiveCompanies: number;
    supplierRespondedQuotes: number;
    supplierRevisedQuotes: number;
    channelCompanies: number;
    channelActiveCompanies: number;
    channelPassiveCompanies: number;
    channelPersonnel: number;
    channelProjects: number;
    channelQuotes: number;
  };
  topNotice?: string | null;
  headerInfo?: string | null;
  footerInfo?: string | null;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  footerBgColor?: string | null;
  footerTextColor?: string | null;
  heroTextColor?: string | null;
  heroMutedTextColor?: string | null;
  accentColor?: string | null;
  secondaryAccentColor?: string | null;
  accentOpacity?: number | null;
  secondaryAccentOpacity?: number | null;
  primaryAccentStop?: number | null;
  secondaryAccentStart?: number | null;
  glowIntensity?: number | null;
  quickLinks: QuickLink[];
  requests: CatalogRequest[];
  requestBusyId: number | null;
  onCreateRoleRequest: (payload: { name: string; description?: string }) => Promise<void>;
  onCreateDepartmentRequest: (payload: { name: string; description?: string }) => Promise<void>;
  onReviewRequest: (requestId: number, decision: "approved" | "rejected") => Promise<void>;
  hideBottomSections?: boolean;
  hideTopSummarySection?: boolean;
};

type MetricGroup = {
  label: string;
  colorClass: "partner" | "supplier" | "channel";
  note: string;
  items: Array<{ key: string; value: number }>;
};

export function ScopeWorkspaceHome({
  user,
  currentUserRoleLabel,
  title,
  description,
  platformMetrics,
  topNotice,
  headerInfo,
  footerInfo,
  headerBgColor,
  headerTextColor,
  footerBgColor,
  footerTextColor,
  heroTextColor,
  heroMutedTextColor,
  accentColor,
  secondaryAccentColor,
  accentOpacity,
  secondaryAccentOpacity,
  primaryAccentStop,
  secondaryAccentStart,
  glowIntensity,
  quickLinks,
  requests,
  requestBusyId,
  onCreateRoleRequest,
  onCreateDepartmentRequest,
  onReviewRequest,
  hideBottomSections = false,
  hideTopSummarySection = false,
}: Props) {
  const scope = getUserScopeType(user);
  const mainTitle = title.split(" • ")[0];

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");

  const canReview = isSuperAdminUser(user) || scope === "platform";
  const canRequest = isTenantAdminUser(user) || scope === "channel" || scope === "partner";

  const requestSummary = useMemo(
    () => ({
      pending: requests.filter((item) => item.review_status === "pending_review").length,
      approved: requests.filter((item) => item.review_status === "approved").length,
      rejected: requests.filter((item) => item.review_status === "rejected").length,
    }),
    [requests],
  );

  const hasHeaderStrip = Boolean(topNotice || headerInfo || headerBgColor || headerTextColor);
  const hasFooterStrip = Boolean(footerInfo || footerBgColor || footerTextColor);
  const themeSourceProvided = Boolean(
    heroTextColor ||
      heroMutedTextColor ||
      accentColor ||
      secondaryAccentColor ||
      accentOpacity != null ||
      secondaryAccentOpacity != null ||
      primaryAccentStop != null ||
      secondaryAccentStart != null ||
      glowIntensity != null,
  );

  const platformMetricGroups: MetricGroup[] = platformMetrics
    ? [
        {
          label: "Stratejik Partner",
          colorClass: "partner",
          note: `${platformMetrics.partnerActiveCompanies} aktif · ${platformMetrics.partnerPassiveCompanies} pasif`,
          items: [
            { key: "Firma", value: platformMetrics.partnerCompanies },
            { key: "Personel", value: platformMetrics.partnerPersonnel },
            { key: "Proje", value: platformMetrics.partnerProjects },
            { key: "Teklif", value: platformMetrics.partnerQuotes },
          ],
        },
        {
          label: "Tedarikçi",
          colorClass: "supplier",
          note: `${platformMetrics.supplierActiveCompanies} aktif · ${platformMetrics.supplierPassiveCompanies} pasif`,
          items: [
            { key: "Firma", value: platformMetrics.supplierCompanies },
            { key: "Yanıtlanan Teklif", value: platformMetrics.supplierRespondedQuotes },
            { key: "Revize Teklif", value: platformMetrics.supplierRevisedQuotes },
          ],
        },
        {
          label: "İş Ortağı",
          colorClass: "channel",
          note: `${platformMetrics.channelActiveCompanies} aktif · ${platformMetrics.channelPassiveCompanies} pasif`,
          items: [
            { key: "Firma", value: platformMetrics.channelCompanies },
            { key: "Personel", value: platformMetrics.channelPersonnel },
            { key: "Proje", value: platformMetrics.channelProjects },
            { key: "Teklif", value: platformMetrics.channelQuotes },
          ],
        },
      ]
    : [];

  return (
    <section className="scope-workspace-home" data-scope={scope} data-theme-source={themeSourceProvided ? "custom" : "default"}>
      <section className="scope-workspace-home__shell">
        {hasHeaderStrip ? (
          <div className="scope-workspace-home__header-strip">
            <span>{topNotice || "Ust bilgi alani"}</span>
            <span>{headerInfo || "Header bilgi alani"}</span>
          </div>
        ) : null}

        <div className="scope-workspace-home__hero">
          <div className="scope-workspace-home__logo-frame">
            <PublicBrandLogo height={26} maxWidth={90} invert />
          </div>

          <div className="scope-workspace-home__hero-copy">
            <div className="scope-workspace-home__eyebrow">{getScopeLabel(scope)} Yönetim Alanı</div>
            <div className="scope-workspace-home__title">{mainTitle}</div>
            <div className="scope-workspace-home__role-label">{currentUserRoleLabel}</div>
            {description ? <div className="scope-workspace-home__description">{description}</div> : null}
          </div>

          <div className="scope-workspace-home__user-block">
            <div className="scope-workspace-home__user-caption">Hoş geldiniz</div>
            <div className="scope-workspace-home__user-name">{user?.full_name || user?.email || "-"}</div>
            <div className="scope-workspace-home__user-email">{user?.email || ""}</div>
          </div>
        </div>

        {!hideTopSummarySection ? (
          <div className="scope-workspace-home__summary">
            {scope === "platform" && platformMetricGroups.length > 0 ? (
              <div className="scope-workspace-home__summary-grid">
                <div className="scope-workspace-home__section-eyebrow">Platform Yönetim Alanı</div>
                <div className="scope-workspace-home__metric-grid">
                  {platformMetricGroups.map((group) => (
                    <div key={group.label} className={`scope-workspace-home__theme-card scope-workspace-home__theme-card--${group.colorClass}`}>
                      <div className="scope-workspace-home__theme-card-title">{group.label}</div>
                      <div className="scope-workspace-home__theme-card-note">{group.note}</div>
                      {group.items.map((entry) => (
                        <div key={`${group.label}-${entry.key}`} className="scope-workspace-home__theme-row">
                          <span className="scope-workspace-home__theme-row-label">{entry.key}</span>
                          <span className="scope-workspace-home__theme-row-value">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="scope-workspace-home__summary-pill-grid">
              <div className="scope-workspace-home__summary-pill-card scope-workspace-home__summary-pill-card--pending">
                <div className="scope-workspace-home__summary-pill-label">Bekleyen Talep</div>
                <div className="scope-workspace-home__summary-pill-value">{requestSummary.pending}</div>
              </div>
              <div className="scope-workspace-home__summary-pill-card scope-workspace-home__summary-pill-card--approved">
                <div className="scope-workspace-home__summary-pill-label">Onaylanan</div>
                <div className="scope-workspace-home__summary-pill-value">{requestSummary.approved}</div>
              </div>
              <div className="scope-workspace-home__summary-pill-card scope-workspace-home__summary-pill-card--rejected">
                <div className="scope-workspace-home__summary-pill-label">Reddedilen</div>
                <div className="scope-workspace-home__summary-pill-value">{requestSummary.rejected}</div>
              </div>
              <div className="scope-workspace-home__summary-pill-card scope-workspace-home__summary-pill-card--links">
                <div className="scope-workspace-home__summary-pill-label">Hızlı Link</div>
                <div className="scope-workspace-home__summary-pill-value">{quickLinks.length}</div>
              </div>
            </div>
          </div>
        ) : null}

        {hasFooterStrip ? (
          <div className="scope-workspace-home__footer-strip">
            <span>{footerInfo || "Footer bilgi alani"}</span>
          </div>
        ) : null}
      </section>

      {!hideBottomSections ? (
        <>
          <section className="scope-workspace-home__metric-grid">
            <div className="scope-workspace-home__panel">
              <div className="scope-workspace-home__section-eyebrow">Rol / Departman Onay Masası</div>
              <div className="scope-workspace-home__panel-title">Scope ayrışmalı katalog yönetimi</div>
              <div className="scope-workspace-home__section-copy">
                Tenant ekipleri yeni rol ve departman ihtiyacını talep olarak açar. Platform tarafı talepleri merkezi kuyrukta inceler, onaylanan kayıt gerçek katalog varlığına dönüşür.
              </div>

              {canRequest ? (
                <div className="scope-workspace-home__metric-grid">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!roleName.trim()) return;
                      void onCreateRoleRequest({ name: roleName.trim(), description: roleDescription.trim() || undefined }).then(() => {
                        setRoleName("");
                        setRoleDescription("");
                      });
                    }}
                    className="scope-workspace-home__panel"
                  >
                    <div className="scope-workspace-home__catalog-card-title">Yeni rol talebi</div>
                    <div className="scope-workspace-home__field-grid">
                      <input
                        value={roleName}
                        onChange={(event) => setRoleName(event.target.value)}
                        placeholder="Ornek: Partner Teknik Lider"
                        className="scope-workspace-home__input"
                      />
                      <textarea
                        value={roleDescription}
                        onChange={(event) => setRoleDescription(event.target.value)}
                        placeholder="Bu rol hangi ihtiyacı çözüyor?"
                        rows={3}
                        className="scope-workspace-home__textarea"
                      />
                      <button type="submit" className="scope-workspace-home__primary-button">
                        Rol talebini gönder
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!departmentName.trim()) return;
                      void onCreateDepartmentRequest({
                        name: departmentName.trim(),
                        description: departmentDescription.trim() || undefined,
                      }).then(() => {
                        setDepartmentName("");
                        setDepartmentDescription("");
                      });
                    }}
                    className="scope-workspace-home__panel"
                  >
                    <div className="scope-workspace-home__catalog-card-title">Yeni departman talebi</div>
                    <div className="scope-workspace-home__field-grid">
                      <input
                        value={departmentName}
                        onChange={(event) => setDepartmentName(event.target.value)}
                        placeholder="Ornek: Kanal Performans ve Hakediş"
                        className="scope-workspace-home__input"
                      />
                      <textarea
                        value={departmentDescription}
                        onChange={(event) => setDepartmentDescription(event.target.value)}
                        placeholder="Bu departman hangi iş hattını ayırıyor?"
                        rows={3}
                        className="scope-workspace-home__textarea"
                      />
                      <button type="submit" className="scope-workspace-home__secondary-button">
                        Departman talebini gönder
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="scope-workspace-home__status-note">
                  Bu profil için katalog talebi açma alanı kapalı. Yine de scope bazlı istek kuyruğunu izleyebilir ve sonuçlarını takip edebilirsiniz.
                </div>
              )}

              <div className="scope-workspace-home__request-grid">
                {requests.length === 0 ? (
                  <div className="scope-workspace-home__request-empty">Gosterilecek katalog talebi yok.</div>
                ) : (
                  requests.map((item) => (
                    <div key={item.id} className="scope-workspace-home__request-card">
                      <div className="scope-workspace-home__request-card-top">
                        <div>
                          <div className="scope-workspace-home__request-card-title">{item.proposed_name}</div>
                          <div className="scope-workspace-home__request-card-subtitle">
                            {item.entity_type === "role" ? "Rol talebi" : "Departman talebi"} •{" "}
                            {item.requested_by_name || item.requested_by_email || `Kullanici #${item.requested_by_user_id}`}
                          </div>
                        </div>
                        <span
                          className={`scope-workspace-home__status-pill ${
                            item.review_status === "approved"
                              ? "scope-workspace-home__status-pill--approved"
                              : item.review_status === "rejected"
                                ? "scope-workspace-home__status-pill--rejected"
                                : "scope-workspace-home__status-pill--pending"
                          }`}
                        >
                          {item.review_status === "approved" ? "Onaylandi" : item.review_status === "rejected" ? "Reddedildi" : "Inceleniyor"}
                        </span>
                      </div>

                      {item.proposed_description ? <div className="scope-workspace-home__request-card-text">{item.proposed_description}</div> : null}

                      <div className="scope-workspace-home__request-meta-row">
                        <span>Olusturma: {new Date(item.created_at).toLocaleString("tr-TR")}</span>
                        {item.reviewed_at ? <span>Karar: {new Date(item.reviewed_at).toLocaleString("tr-TR")}</span> : null}
                        {item.reviewed_by_name ? <span>Reviewer: {item.reviewed_by_name}</span> : null}
                      </div>

                      {item.decision_note ? <div className="scope-workspace-home__request-decision-note">{item.decision_note}</div> : null}

                      {canReview && item.review_status === "pending_review" ? (
                        <div className="scope-workspace-home__request-actions">
                          <button
                            type="button"
                            disabled={requestBusyId === item.id}
                            onClick={() => void onReviewRequest(item.id, "approved")}
                            className="scope-workspace-home__primary-button"
                          >
                            Onayla
                          </button>
                          <button
                            type="button"
                            disabled={requestBusyId === item.id}
                            onClick={() => void onReviewRequest(item.id, "rejected")}
                            className="scope-workspace-home__secondary-button"
                          >
                            Reddet
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="scope-workspace-home__scope-panel">
              <div className="scope-workspace-home__scope-title">Bu scope için operasyon ilkeleri</div>
              <div className="scope-workspace-home__scope-list">
                {[
                  `${getScopeLabel(scope)} girişi kendi renk ve tonuyla ayrılıyor; bu sayede yanlış kabuğa düşme riski azalır.`,
                  "Super admin tüm scope'ları görebilir fakat review ve izleme katmanı scope sinyalini korur.",
                  "Aktif / pasif yaşam döngüsü yeni katalog taleplerinde de korunur; onaylanmayan kayıt canlı listeye düşmez.",
                  "Scope ana sayfası ağır tek ekran yerine hızlı kartlar ve açılır işlem bloklarıyla taşınacak şekilde kurgulandı.",
                ].map((item) => (
                  <div key={item} className="scope-workspace-home__scope-item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="scope-workspace-home__panel">
            <div className="scope-workspace-home__scope-title">Hızlı Linkler</div>
            <div className="scope-workspace-home__quick-links-grid">
              {quickLinks.map((item) => (
                <a key={item.href} href={item.href} className="scope-workspace-home__quick-link">
                  <div className="scope-workspace-home__quick-link-title">{item.label}</div>
                  <div className="scope-workspace-home__quick-link-description">{item.description}</div>
                  <div className="scope-workspace-home__quick-link-action">Ac →</div>
                </a>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
