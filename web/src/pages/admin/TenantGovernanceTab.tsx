import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { AdminFocusBannerTone } from "./adminPageMeta";
import type { AdminSupplierListItem, Tenant, TenantUser } from "../../services/admin.service";
import "./TenantGovernanceTab.css";

type TenantFormDraft = {
  legal_name: string;
  brand_name: string;
  category: string;
  city: string;
  initial_admin_full_name: string;
  initial_admin_email: string;
  initial_admin_personal_phone: string;
  subscription_plan_code: string;
  onboarding_status: string;
  status: string;
};

type TenantGovernanceFocus = {
  tenantId?: number | null | undefined;
  tenantName?: string | null | undefined;
};

type TenantUsageMetric = {
  key: string;
  label: string;
  used: number;
  limit?: number | null;
};

type TenantUsageItem = {
  metrics: TenantUsageMetric[];
};

type TenantGovernanceTabProps = {
  canEditTenantGovernance: boolean;
  tenantMessage: string | null;
  openNewTenantModal: () => void;
  tenantSaving: boolean;
  handleStartOnboardingTemplate: (planCode: string) => void;
  isTenantFormModalOpen: boolean;
  handleSubmitTenant: (e: FormEvent) => Promise<void>;
  closeTenantModal: () => void;
  editingTenantId: number | null;
  tenantForm: TenantFormDraft;
  setTenantForm: Dispatch<SetStateAction<TenantFormDraft>>;
  tenantGovernanceFocus: TenantGovernanceFocus | null;
  renderAdminFocusBanner: (options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel?: string;
    timestamp?: number | null;
    actions?: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId?: string;
  }) => ReactNode;
  setTenantGovernanceFocus: Dispatch<SetStateAction<TenantGovernanceFocus | null>>;
  setTenantUsageFilter: Dispatch<SetStateAction<"all" | "pressure" | "breach">>;
  tenantUsageFilter: "all" | "pressure" | "breach";
  tenantCategoryFilter: string;
  setTenantCategoryFilter: Dispatch<SetStateAction<string>>;
  tenantCategoryOptions: string[];
  tenantSortMode: "risk" | "name";
  setTenantSortMode: Dispatch<SetStateAction<"risk" | "name">>;
  tenantCategorySummary: Array<{ category: string; tenantCount: number; supplierCount: number }>;
  tenants: Tenant[];
  visibleTenants: Tenant[];
  tenantUsageByTenant: Map<number, TenantUsageItem>;
  tenantGovernanceSuppliers: AdminSupplierListItem[];
  formatPartnerLifecycleStatus: (status: string | null | undefined) => string;
  tenantOwnerCandidates: Map<number, TenantUser[]>;
  handleReassignTenantOwner: (tenant: Tenant, ownerUserId: string) => Promise<void>;
  handleEditTenant: (tenant: Tenant) => void;
  handleTenantStatusAction: (tenant: Tenant, nextStatus: "active" | "paused") => Promise<void>;
  handleDeleteTenant: (tenant: Tenant) => Promise<void>;
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export function TenantGovernanceTab({
  canEditTenantGovernance,
  tenantMessage,
  openNewTenantModal,
  tenantSaving,
  handleStartOnboardingTemplate,
  isTenantFormModalOpen,
  handleSubmitTenant,
  closeTenantModal,
  editingTenantId,
  tenantForm,
  setTenantForm,
  tenantGovernanceFocus,
  renderAdminFocusBanner,
  setTenantGovernanceFocus,
  setTenantUsageFilter,
  tenantUsageFilter,
  tenantCategoryFilter,
  setTenantCategoryFilter,
  tenantCategoryOptions,
  tenantSortMode,
  setTenantSortMode,
  tenantCategorySummary,
  tenants,
  visibleTenants,
  tenantUsageByTenant,
  tenantGovernanceSuppliers,
  formatPartnerLifecycleStatus,
  tenantOwnerCandidates,
  handleReassignTenantOwner,
  handleEditTenant,
  handleTenantStatusAction,
  handleDeleteTenant,
}: TenantGovernanceTabProps) {
  return (
    <section className="tgTab">

      {/* ── Hero grid ──────────────────────────────────────── */}
      <div className="tgTab__heroGrid">

        {/* Create panel */}
        <div className="tgTab__card tgTab__card--stacked">
          <div>
            <div className="tgTab__eyebrow">Stratejik Partner Hızlı İşlem</div>
            <div className="tgTab__heroTitle">Süper admin onaylı partner açılışı</div>
          </div>
          {!canEditTenantGovernance ? (
            <div className="tgTab__warning">
              Platform destek personeli bu alanı izleyebilir; oluşturma, owner yeniden atama ve yaşam döngüsü değiştirme yetkisi sadece süper admin'dedir.
            </div>
          ) : null}
          <div className="tgTab__infoPanel">
            <div className="tgTab__infoPanelTitle">Bu akış onboarding kuyuguna girmez.</div>
            <div className="tgTab__infoPanelText">
              Süper admin buradan stratejik partneri doğrudan aktif olarak açar. İlk yöneticiye sadece şifre belirleme ve hesap aktivasyon e-postası gider.
            </div>
          </div>
          {tenantMessage ? <div className="tgTab__message">{tenantMessage}</div> : null}
          <div className="tgTab__buttonRow">
            <button type="button" onClick={openNewTenantModal} disabled={tenantSaving || !canEditTenantGovernance} className="tgTab__btn tgTab__btn--primary">
              Stratejik Partner Oluştur
            </button>
            <button type="button" onClick={() => handleStartOnboardingTemplate("starter")} disabled={!canEditTenantGovernance} className="tgTab__btn tgTab__btn--ghost">
              Starter Taslağı
            </button>
            <button type="button" onClick={() => handleStartOnboardingTemplate("growth")} disabled={!canEditTenantGovernance} className="tgTab__btn tgTab__btn--ghost">
              Growth Taslağı
            </button>
          </div>
        </div>

        {/* Lifecycle legend */}
        <div className="tgTab__card">
          <div className="tgTab__eyebrow">Platform Yönlendirmesi</div>
          <div className="tgTab__heroTitle">Stratejik Partner olgunluk sınıfları</div>
          <div className="tgTab__legendGrid">
            {[
              { label: "draft",       note: "Kurulum başladı, owner ve branding eksik olabilir.",               color: "slate" },
              { label: "onboarding",  note: "İlk admin, branding ve temel organizasyon yapısı kuruluyor.",       color: "blue"  },
              { label: "aktif",       note: "Operasyon kullanıma açık, proje ve tedarikçi akışları başlayabilir.", color: "green" },
              { label: "duraklatıldı", note: "Abonelik veya operasyon kararıyla geçici durdurulmuş.",            color: "amber" },
            ].map((item) => (
              <div key={item.label} className={`tgTab__legendItem tgTab__legendItem--${item.color}`}>
                <span className="tgTab__legendLabel">{item.label}</span>
                <span className="tgTab__legendNote">{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Edit / Create Modal ─────────────────────────────── */}
      {isTenantFormModalOpen ? (
        <div role="dialog" aria-modal="true" className="tgTab__modalOverlay">
          <div className="tgTab__modalCard">
            <form onSubmit={handleSubmitTenant} className="tgTab__form">
              <div className="tgTab__modalHeader">
                <div>
                  <div className="tgTab__eyebrow">Stratejik Partner Kaydı</div>
                  <div className="tgTab__heroTitle">
                    {editingTenantId ? "Stratejik Partner güncelle" : "Yeni Stratejik Partner oluştur"}
                  </div>
                  <div className="tgTab__modalDesc">
                    Bu kayıt süper admin onaylı olarak açılır; ilk yöneticiye sadece şifre belirleme e-postası gider.
                  </div>
                </div>
                <button type="button" onClick={closeTenantModal} className="tgTab__btn tgTab__btn--ghost tgTab__btn--sm">
                  Kapat
                </button>
              </div>

              <div className="tgTab__sectionLabel">Firma Bilgileri</div>
              <div className="tgTab__formGrid">
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.legal_name}
                  onChange={(e) => setTenantForm((p) => ({ ...p, legal_name: e.target.value }))}
                  placeholder="Resmi firma adı"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.brand_name}
                  onChange={(e) => setTenantForm((p) => ({ ...p, brand_name: e.target.value }))}
                  placeholder="Marka / görünen ad"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.category}
                  onChange={(e) => setTenantForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Kategori / uzmanlık alanı"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.city}
                  onChange={(e) => setTenantForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Şehir"
                  className="tgTab__input"
                />
              </div>

              <div className="tgTab__sectionLabel">İlk Stratejik Partner Admin</div>
              <div className="tgTab__formStack">
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.initial_admin_full_name}
                  onChange={(e) => setTenantForm((p) => ({ ...p, initial_admin_full_name: e.target.value }))}
                  placeholder="Ad soyad"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.initial_admin_email}
                  onChange={(e) => setTenantForm((p) => ({ ...p, initial_admin_email: e.target.value }))}
                  placeholder="E-posta"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.initial_admin_personal_phone}
                  onChange={(e) => setTenantForm((p) => ({ ...p, initial_admin_personal_phone: e.target.value }))}
                  placeholder="Cep telefonu"
                  className="tgTab__input"
                />
              </div>

              <div className="tgTab__sectionLabel">Platform & Durum</div>
              <div className="tgTab__formGrid tgTab__formGrid--3">
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.subscription_plan_code}
                  onChange={(e) => setTenantForm((p) => ({ ...p, subscription_plan_code: e.target.value }))}
                  placeholder="Plan kodu"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.onboarding_status}
                  onChange={(e) => setTenantForm((p) => ({ ...p, onboarding_status: e.target.value }))}
                  placeholder="Onboarding durumu"
                  className="tgTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.status}
                  onChange={(e) => setTenantForm((p) => ({ ...p, status: e.target.value }))}
                  placeholder="Status"
                  className="tgTab__input"
                />
              </div>

              {tenantMessage ? <div className="tgTab__message">{tenantMessage}</div> : null}
              <div className="tgTab__modalFooter">
                <button type="button" onClick={closeTenantModal} className="tgTab__btn tgTab__btn--ghost">Vazgeç</button>
                <button type="submit" disabled={tenantSaving || !canEditTenantGovernance} className="tgTab__btn tgTab__btn--primary">
                  {tenantSaving ? "Kaydediliyor..." : editingTenantId ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Portfolio section ───────────────────────────────── */}
      <div className="tgTab__portfolio">
        <div className="tgTab__portfolioHeader">
          <div className="tgTab__portfolioTitleRow">
            <div>
              <div className="tgTab__eyebrow">Stratejik Partner Portföyü</div>
              <div className="tgTab__heroTitle">Müşteri olgunluk görünümü</div>
              <div className="tgTab__portfolioDesc">Bu alan Stratejik Partner tablosundaki kayıtları doğrudan yönetir.</div>
            </div>
            <div className="tgTab__summaryStrip">
              <div className="tgTab__summaryPill tgTab__summaryPill--blue">
                <span className="tgTab__summaryNum">{tenantCategorySummary.length}</span>
                <span className="tgTab__summaryLbl">Kategori</span>
              </div>
              <div className="tgTab__summaryPill tgTab__summaryPill--green">
                <span className="tgTab__summaryNum">{tenantCategorySummary.reduce((s, i) => s + i.supplierCount, 0)}</span>
                <span className="tgTab__summaryLbl">Tedarikçi</span>
              </div>
              <div className="tgTab__summaryPill tgTab__summaryPill--amber">
                <span className="tgTab__summaryNum">{tenants.filter((t) => !String(t.category || "").trim()).length}</span>
                <span className="tgTab__summaryLbl">Kategori Eksik</span>
              </div>
            </div>
          </div>

          {tenantGovernanceFocus ? (
            <div className="tgTab__focusBanner">
              {renderAdminFocusBanner({
                eyebrow: "Admin Focus",
                title: `Discovery Lab odağı: ${tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`}`,
                detail: "Stratejik Partner portföyü listesi bu odağa göre daraltıldı.",
                tone: "blue",
                sourceLabel: "Stratejik Partner deep-link",
                timestamp: undefined,
                actions: [{ label: "Odağı Temizle", onClick: () => setTenantGovernanceFocus(null) }],
                testId: "admin-focus-banner-tenant",
              })}
            </div>
          ) : null}

          <div className="tgTab__filtersRow">
            <div className="tgTab__pillGroup">
              {[
                { key: "all",      label: "Tümü" },
                { key: "pressure", label: "Limit Baskısı" },
                { key: "breach",   label: "Limit Aşımı" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTenantUsageFilter(item.key as "all" | "pressure" | "breach")}
                  className={cx("tgTab__pill", tenantUsageFilter === item.key && "tgTab__pill--active")}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="tgTab__selectGroup">
              <label className="tgTab__selectLabel">
                Kategori
                <select value={tenantCategoryFilter} onChange={(e) => setTenantCategoryFilter(e.target.value)} className="tgTab__select">
                  <option value="all">Tüm kategoriler</option>
                  <option value="uncategorized">Kategori eksik</option>
                  {tenantCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="tgTab__selectLabel">
                Sıralama
                <select value={tenantSortMode} onChange={(e) => setTenantSortMode(e.target.value as "risk" | "name")} className="tgTab__select">
                  <option value="risk">Risk önceliği</option>
                  <option value="name">Ada göre</option>
                </select>
              </label>
            </div>
          </div>

          {tenantCategorySummary.length > 0 ? (
            <div className="tgTab__categoryChips">
              {tenantCategorySummary.slice(0, 12).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setTenantCategoryFilter(item.category)}
                  className={cx("tgTab__categoryChip", tenantCategoryFilter === item.category && "tgTab__categoryChip--active")}
                >
                  {item.category}
                  <span className="tgTab__categoryChipMeta">{item.tenantCount}T / {item.supplierCount}S</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Partner cards ─────────────────────────────────── */}
        <div className="tgTab__cardGrid">
          {visibleTenants.length === 0 ? (
            <div className="tgTab__emptyState">Seçili filtre için gösterilecek Stratejik Partner kaydı yok.</div>
          ) : (
            visibleTenants.map((tenant) => {
              const usage = tenantUsageByTenant.get(tenant.id);
              const normalizedCategory = String(tenant.category || "").trim();
              const governancePaymentStatus = String(tenant.onboarding_payment_status || "not_required").toLowerCase();
              const governanceApprovalStatus = String(tenant.onboarding_approval_status || "not_required").toLowerCase();
              const governanceOnboardingStatus = String(tenant.onboarding_status || "draft").toLowerCase();
              const hasPendingCategoryReview = (tenant.category_requests || []).some(
                (item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()),
              );
              const governanceLocked =
                governanceOnboardingStatus !== "active" ||
                governanceApprovalStatus !== "approved" ||
                !["verified", "succeeded", "not_required"].includes(governancePaymentStatus) ||
                hasPendingCategoryReview;
              const matchingSupplierCount = normalizedCategory
                ? tenantGovernanceSuppliers.filter((s) => String(s.category || "").trim() === normalizedCategory).length
                : 0;
              const hasLimitPressure = (usage?.metrics || []).some(
                (m) => m.limit != null && m.limit > 0 && m.used / m.limit >= 0.8,
              );
              const hasLimitBreach = (usage?.metrics || []).some(
                (m) => m.limit != null && m.limit > 0 && m.used >= m.limit,
              );

              return (
                <div
                  key={tenant.id}
                  className={cx(
                    "tgTab__partnerCard",
                    hasLimitBreach && "tgTab__partnerCard--breach",
                    !hasLimitBreach && hasLimitPressure && "tgTab__partnerCard--pressure",
                    !tenant.is_active && "tgTab__partnerCard--passive",
                  )}
                >
                  {/* ── Card head: name + status toggle ────── */}
                  <div className="tgTab__partnerHead">
                    <div className="tgTab__partnerNameBlock">
                      <div className="tgTab__partnerName">{tenant.brand_name || tenant.legal_name}</div>
                      <div className="tgTab__partnerSlug">{tenant.slug}</div>
                    </div>

                    {/* Status control group — top right */}
                    <div className="tgTab__statusGroup">
                      {canEditTenantGovernance && tenant.is_active ? (
                        /* Clickable green badge → makes passive */
                        <button
                          type="button"
                          onClick={() => void handleTenantStatusAction(tenant, "paused")}
                          disabled={tenantSaving}
                          className="tgTab__statusToggle tgTab__statusToggle--active"
                          title="Tıklayarak pasife al"
                        >
                          {formatPartnerLifecycleStatus(tenant.status)}
                        </button>
                      ) : (
                        /* Non-interactive status badge */
                        <span
                          className={cx(
                            "tgTab__statusBadge",
                            hasLimitBreach ? "tgTab__statusBadge--breach" : "tgTab__statusBadge--passive",
                          )}
                        >
                          {formatPartnerLifecycleStatus(tenant.status)}
                        </span>
                      )}

                      {/* Sil — only when passive */}
                      {canEditTenantGovernance && !tenant.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteTenant(tenant)}
                          disabled={tenantSaving}
                          className="tgTab__statusDeleteBtn"
                        >
                          Sil
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="tgTab__chipRow">
                    <span className={cx("tgTab__chip", normalizedCategory ? "tgTab__chip--teal" : "tgTab__chip--slate")}>
                      {normalizedCategory || "Kategori eksik"}
                    </span>
                    {tenant.city ? <span className="tgTab__chip tgTab__chip--slate">{tenant.city}</span> : null}
                    <span className="tgTab__chip tgTab__chip--indigo">{tenant.subscription_plan_code || "starter"}</span>
                    <span className={cx("tgTab__chip", tenant.logo_url ? "tgTab__chip--green" : "tgTab__chip--slate")}>
                      {tenant.logo_url ? "Logo var" : "Logo eksik"}
                    </span>
                    {normalizedCategory && matchingSupplierCount > 0 ? (
                      <span className="tgTab__chip tgTab__chip--green">{matchingSupplierCount} tedarikçi eşleşiyor</span>
                    ) : null}
                  </div>

                  {/* Limit alert */}
                  {hasLimitBreach ? (
                    <div className="tgTab__alertBar tgTab__alertBar--breach">Limit aşımı var</div>
                  ) : hasLimitPressure ? (
                    <div className="tgTab__alertBar tgTab__alertBar--pressure">Limit baskısı var</div>
                  ) : null}

                  {/* Usage metrics */}
                  {usage && usage.metrics.length > 0 ? (
                    <div className="tgTab__metricsRow">
                      {usage.metrics.map((metric) => {
                        const ratio = metric.limit != null && metric.limit > 0 ? metric.used / metric.limit : 0;
                        const tone = ratio >= 1 ? "breach" : ratio >= 0.8 ? "pressure" : "calm";
                        return (
                          <span key={`${tenant.id}-${metric.key}`} className={`tgTab__metricChip tgTab__metricChip--${tone}`}>
                            {metric.label}: {metric.used}{metric.limit != null ? `/${metric.limit}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Owner section */}
                  <div className="tgTab__ownerSection">
                    <div className="tgTab__ownerInfo">
                      <span className="tgTab__ownerName">{tenant.owner_full_name || "Owner atanmamış"}</span>
                      <span className="tgTab__ownerEmail">{tenant.owner_email || "—"}</span>
                    </div>
                    {governanceLocked ? (
                      <div className="tgTab__lockNote">Ödeme doğrulama veya kategori onayı tamamlanmadı — owner ataması kilitli.</div>
                    ) : null}
                    <select
                      aria-label={`Owner seç: ${tenant.brand_name || tenant.legal_name}`}
                      disabled={!canEditTenantGovernance || governanceLocked}
                      value={tenant.owner_user_id ? String(tenant.owner_user_id) : ""}
                      onChange={(e) => void handleReassignTenantOwner(tenant, e.target.value)}
                      className="tgTab__ownerSelect"
                    >
                      <option value="">Stratejik Partner owner seç</option>
                      {(tenantOwnerCandidates.get(tenant.id) || []).map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name}  {candidate.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ── Card actions ─────────────────────── */}
                  {canEditTenantGovernance ? (
                    <div className="tgTab__cardActions">
                      <button
                        type="button"
                        onClick={() => handleEditTenant(tenant)}
                        className="tgTab__actionBtn tgTab__actionBtn--edit"
                      >
                        Düzenle
                      </button>
                      {!tenant.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleTenantStatusAction(tenant, "active")}
                          disabled={tenantSaving}
                          className="tgTab__actionBtn tgTab__actionBtn--approve"
                        >
                          Onayla
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
