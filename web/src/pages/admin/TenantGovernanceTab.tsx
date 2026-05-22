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
    <section className="tenantGovernanceTab">
      <div className="tenantGovernanceTab__heroGrid">
        <div className="tenantGovernanceTab__card tenantGovernanceTab__card--stacked">
          <div>
            <div className="tenantGovernanceTab__eyebrow">Stratejik Partner Hizli Islem</div>
            <div className="tenantGovernanceTab__title">Super admin onayli partner acilisi</div>
          </div>
          {!canEditTenantGovernance ? (
            <div className="tenantGovernanceTab__warning">
              Platform destek personeli bu alani izleyebilir; Stratejik Partner olusturma, owner yeniden atama ve yasam dongusu degistirme yetkisi sadece super admin hesabindadir.
            </div>
          ) : null}
          <div className="tenantGovernanceTab__infoPanel">
            <div className="tenantGovernanceTab__infoPanelTitle">Bu akis onboarding kuyuguna girmez.</div>
            <div className="tenantGovernanceTab__infoPanelText">
              Super admin buradan stratejik partneri dogrudan aktif olarak acar. Ilk yoneticiye sadece sifre belirleme ve hesap aktivasyon e-postasi gider.
            </div>
          </div>
          {tenantMessage ? <div className="tenantGovernanceTab__message">{tenantMessage}</div> : null}
          <div className="tenantGovernanceTab__buttonRow">
            <button
              type="button"
              onClick={openNewTenantModal}
              disabled={tenantSaving || !canEditTenantGovernance}
              className="tenantGovernanceTab__button tenantGovernanceTab__button--primary"
            >
              Stratejik Partner olustur
            </button>
            <button
              type="button"
              onClick={() => handleStartOnboardingTemplate("starter")}
              disabled={!canEditTenantGovernance}
              className="tenantGovernanceTab__button tenantGovernanceTab__button--secondary"
            >
              Starter Taslagi
            </button>
            <button
              type="button"
              onClick={() => handleStartOnboardingTemplate("growth")}
              disabled={!canEditTenantGovernance}
              className="tenantGovernanceTab__button tenantGovernanceTab__button--secondary"
            >
              Growth Taslagi
            </button>
          </div>
        </div>

        {isTenantFormModalOpen ? (
          <div role="dialog" aria-modal="true" className="tenantGovernanceTab__modalOverlay">
            <div className="tenantGovernanceTab__modalCard">
              <form onSubmit={handleSubmitTenant} className="tenantGovernanceTab__form">
                <div className="tenantGovernanceTab__modalHeader">
                  <div>
                    <div className="tenantGovernanceTab__eyebrow">Stratejik Partner Kaydi</div>
                    <div className="tenantGovernanceTab__title">
                      {editingTenantId ? "Stratejik Partner guncelle" : "Yeni Stratejik Partner olustur"}
                    </div>
                    <div className="tenantGovernanceTab__modalDescription">
                      Bu kayit super admin onayli olarak acilir ve ilk yoneticiye sadece sifre belirleme e-postasi gider.
                    </div>
                  </div>
                  <button type="button" onClick={closeTenantModal} className="tenantGovernanceTab__button tenantGovernanceTab__button--close">
                    Kapat
                  </button>
                </div>
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.legal_name}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, legal_name: e.target.value }))}
                  placeholder="Resmi firma adi"
                  className="tenantGovernanceTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.brand_name}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, brand_name: e.target.value }))}
                  placeholder="Marka / gorunen ad"
                  className="tenantGovernanceTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.category}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Kategori / uzmanlik alani"
                  className="tenantGovernanceTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.city}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Sehir"
                  className="tenantGovernanceTab__input"
                />
                <div className="tenantGovernanceTab__sectionLabel">Ilk Stratejik Partner Admin</div>
                <input
                  disabled={!canEditTenantGovernance || editingTenantId !== null}
                  value={tenantForm.initial_admin_full_name}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_full_name: e.target.value }))}
                  placeholder="Ad soyad"
                  className="tenantGovernanceTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance || editingTenantId !== null}
                  value={tenantForm.initial_admin_email}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_email: e.target.value }))}
                  placeholder="E-posta"
                  className="tenantGovernanceTab__input"
                />
                <input
                  disabled={!canEditTenantGovernance || editingTenantId !== null}
                  value={tenantForm.initial_admin_personal_phone}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_personal_phone: e.target.value }))}
                  placeholder="Cep telefonu"
                  className="tenantGovernanceTab__input"
                />
                <div className="tenantGovernanceTab__splitGrid">
                  <input
                    disabled={!canEditTenantGovernance}
                    value={tenantForm.subscription_plan_code}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, subscription_plan_code: e.target.value }))}
                    placeholder="Plan kodu"
                    className="tenantGovernanceTab__input"
                  />
                  <input
                    disabled={!canEditTenantGovernance}
                    value={tenantForm.onboarding_status}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, onboarding_status: e.target.value }))}
                    placeholder="Onboarding durumu"
                    className="tenantGovernanceTab__input"
                  />
                </div>
                <input
                  disabled={!canEditTenantGovernance}
                  value={tenantForm.status}
                  onChange={(e) => setTenantForm((prev) => ({ ...prev, status: e.target.value }))}
                  placeholder="Status"
                  className="tenantGovernanceTab__input"
                />
                {tenantMessage ? <div className="tenantGovernanceTab__message">{tenantMessage}</div> : null}
                <div className="tenantGovernanceTab__actionRow tenantGovernanceTab__actionRow--end">
                  <button type="button" onClick={closeTenantModal} className="tenantGovernanceTab__button tenantGovernanceTab__button--close">
                    Vazgec
                  </button>
                  <button
                    type="submit"
                    disabled={tenantSaving || !canEditTenantGovernance}
                    className="tenantGovernanceTab__button tenantGovernanceTab__button--primary"
                  >
                    {tenantSaving ? "Kaydediliyor..." : editingTenantId ? "Stratejik Partner guncelle" : "Stratejik Partner olustur"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div className="tenantGovernanceTab__card">
          <div className="tenantGovernanceTab__eyebrow">Platform Yonlendirmesi</div>
          <div className="tenantGovernanceTab__title">Stratejik Partner olgunluk siniflari</div>
          <div className="tenantGovernanceTab__stack">
            {[
              { label: "draft", note: "Kurulum basladi, Stratejik Partner owner ve branding eksik olabilir." },
              { label: "onboarding", note: "Ilk admin, branding ve temel organizasyon yapisi kuruluyor." },
              { label: "aktif", note: "Operasyon kullanima acik, proje ve tedarikci akislari baslayabilir." },
              { label: "duraklatildi", note: "Abonelik veya operasyon karariyla gecici durdurulmus Stratejik Partner." },
            ].map((item) => (
              <div key={item.label} className="tenantGovernanceTab__statusCard">
                <div className="tenantGovernanceTab__statusCardTitle">{item.label}</div>
                <div className="tenantGovernanceTab__statusCardText">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tenantGovernanceTab__portfolioCard">
        <div className="tenantGovernanceTab__portfolioHeader">
          <div className="tenantGovernanceTab__eyebrow">Stratejik Partner Portfoyu</div>
          <div className="tenantGovernanceTab__title">Musteri olgunluk gorunumu</div>
          <div className="tenantGovernanceTab__portfolioDescription">Bu alan artik Stratejik Partner tablosundaki kayitlari dogrudan yonetir.</div>
          {tenantGovernanceFocus ? (
            <div className="tenantGovernanceTab__focusBannerWrap">
              {renderAdminFocusBanner({
                eyebrow: "Admin Focus",
                title: `Discovery Lab odagi: ${tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`}`,
                detail: "Stratejik Partner portfoyu listesi bu odaga gore daraltildi.",
                tone: "blue",
                sourceLabel: "Stratejik Partner deep-link",
                timestamp: undefined,
                actions: [{ label: "Odagi Temizle", onClick: () => setTenantGovernanceFocus(null) }],
                testId: "admin-focus-banner-tenant",
              })}
            </div>
          ) : null}
          <div className="tenantGovernanceTab__filtersRow">
            <div className="tenantGovernanceTab__pillGroup">
              {[
                { key: "all", label: "Tum Stratejik Partnerler" },
                { key: "pressure", label: "Limit Baskisi" },
                { key: "breach", label: "Limit Asimi" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTenantUsageFilter(item.key as "all" | "pressure" | "breach")}
                  className={cx(
                    "tenantGovernanceTab__pillButton",
                    tenantUsageFilter === item.key && "tenantGovernanceTab__pillButton--selected",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="tenantGovernanceTab__selectGroup">
              <label className="tenantGovernanceTab__selectLabel">
                Kategori
                <select
                  value={tenantCategoryFilter}
                  onChange={(event) => setTenantCategoryFilter(event.target.value)}
                  className="tenantGovernanceTab__select"
                >
                  <option value="all">Tum kategoriler</option>
                  <option value="uncategorized">Kategori eksik</option>
                  {tenantCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tenantGovernanceTab__selectLabel">
                Siralama
                <select
                  value={tenantSortMode}
                  onChange={(event) => setTenantSortMode(event.target.value as "risk" | "name")}
                  className="tenantGovernanceTab__select"
                >
                  <option value="risk">Risk onceligi</option>
                  <option value="name">Ada gore</option>
                </select>
              </label>
            </div>
          </div>
          <div className="tenantGovernanceTab__summaryGrid">
            <div className="tenantGovernanceTab__summaryCard tenantGovernanceTab__summaryCard--blue">
              <div className="tenantGovernanceTab__summaryEyebrow">Kategori Kapsami</div>
              <div className="tenantGovernanceTab__summaryValue">{tenantCategorySummary.length}</div>
              <div className="tenantGovernanceTab__summaryText">Tenant ve tedarikci tarafinda gorulen ortak kategori sayisi</div>
            </div>
            <div className="tenantGovernanceTab__summaryCard tenantGovernanceTab__summaryCard--green">
              <div className="tenantGovernanceTab__summaryEyebrow">Kategori Eslesen Tedarikci</div>
              <div className="tenantGovernanceTab__summaryValue">
                {tenantCategorySummary.reduce((sum, item) => sum + item.supplierCount, 0)}
              </div>
              <div className="tenantGovernanceTab__summaryText">Kategoriye sahip supplier portfoyu sinyali</div>
            </div>
            <div className="tenantGovernanceTab__summaryCard tenantGovernanceTab__summaryCard--amber">
              <div className="tenantGovernanceTab__summaryEyebrow">Kategori Eksigi</div>
              <div className="tenantGovernanceTab__summaryValue">{tenants.filter((tenant) => !String(tenant.category || "").trim()).length}</div>
              <div className="tenantGovernanceTab__summaryText">Esleme icin henuz kategori atanmamis tenant sayisi</div>
            </div>
          </div>
          {tenantCategorySummary.length > 0 ? (
            <div className="tenantGovernanceTab__categoryWrap">
              {tenantCategorySummary.slice(0, 8).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setTenantCategoryFilter(item.category)}
                  className={cx(
                    "tenantGovernanceTab__categoryChip",
                    tenantCategoryFilter === item.category && "tenantGovernanceTab__categoryChip--selected",
                  )}
                >
                  {item.category}  {item.tenantCount} tenant / {item.supplierCount} supplier
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="tenantGovernanceTab__tableWrap">
          <table className="tenantGovernanceTab__table">
            <thead>
              <tr className="tenantGovernanceTab__tableHeadRow">
                <th className="tenantGovernanceTab__tableHeader">Stratejik Partner</th>
                <th className="tenantGovernanceTab__tableHeader">Durum</th>
                <th className="tenantGovernanceTab__tableHeader">Plan</th>
                <th className="tenantGovernanceTab__tableHeader">Branding</th>
                <th className="tenantGovernanceTab__tableHeader">Stratejik Partner Owner</th>
                <th className="tenantGovernanceTab__tableHeader">Islem</th>
              </tr>
            </thead>
            <tbody>
              {visibleTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tenantGovernanceTab__emptyState">
                    Secili filtre icin gosterilecek Stratejik Partner kaydi yok.
                  </td>
                </tr>
              ) : (
                visibleTenants.map((tenant) => {
                  const usage = tenantUsageByTenant.get(tenant.id);
                  const normalizedTenantCategory = String(tenant.category || "").trim();
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
                  const matchingSupplierCount = normalizedTenantCategory
                    ? tenantGovernanceSuppliers.filter((supplier) => String(supplier.category || "").trim() === normalizedTenantCategory).length
                    : 0;
                  const hasLimitPressure = (usage?.metrics || []).some(
                    (metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used / metric.limit >= 0.8,
                  );
                  const hasLimitBreach = (usage?.metrics || []).some(
                    (metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used >= metric.limit,
                  );

                  return (
                    <tr
                      key={tenant.id}
                      className={cx(
                        "tenantGovernanceTab__tableRow",
                        hasLimitBreach && "tenantGovernanceTab__tableRow--breach",
                        !hasLimitBreach && hasLimitPressure && "tenantGovernanceTab__tableRow--pressure",
                      )}
                    >
                      <td className="tenantGovernanceTab__cell">
                        <div className="tenantGovernanceTab__tenantName">{tenant.brand_name || tenant.legal_name}</div>
                        <div className="tenantGovernanceTab__tenantMeta">
                          {tenant.slug}  {tenant.city || "Sehir eksik"}
                        </div>
                        <div className="tenantGovernanceTab__chipWrap">
                          <span
                            className={cx(
                              "tenantGovernanceTab__chip",
                              normalizedTenantCategory ? "tenantGovernanceTab__chip--teal" : "tenantGovernanceTab__chip--slate",
                            )}
                          >
                            {normalizedTenantCategory || "Kategori eksik"}
                          </span>
                          {normalizedTenantCategory ? (
                            <span
                              className={cx(
                                "tenantGovernanceTab__chip",
                                matchingSupplierCount > 0 ? "tenantGovernanceTab__chip--green" : "tenantGovernanceTab__chip--orange",
                              )}
                            >
                              {matchingSupplierCount > 0 ? `${matchingSupplierCount} tedarikci eslesiyor` : "Eslesen tedarikci yok"}
                            </span>
                          ) : null}
                        </div>
                        {usage ? (
                          <div className="tenantGovernanceTab__chipWrap">
                            {usage.metrics.map((metric) => {
                              const ratio = metric.limit !== null && metric.limit !== undefined && metric.limit > 0 ? metric.used / metric.limit : 0;
                              const toneClass =
                                ratio >= 1
                                  ? "tenantGovernanceTab__metricChip--breach"
                                  : ratio >= 0.8
                                    ? "tenantGovernanceTab__metricChip--pressure"
                                    : "tenantGovernanceTab__metricChip--calm";
                              return (
                                <span key={`${tenant.id}-${metric.key}`} className={cx("tenantGovernanceTab__chip tenantGovernanceTab__metricChip", toneClass)}>
                                  {metric.label}: {metric.used}
                                  {metric.limit !== null && metric.limit !== undefined ? `/${metric.limit}` : ""}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td className="tenantGovernanceTab__cell">
                        <span
                          className={cx(
                            "tenantGovernanceTab__statusBadge",
                            hasLimitBreach
                              ? "tenantGovernanceTab__statusBadge--breach"
                              : tenant.is_active
                                ? "tenantGovernanceTab__statusBadge--active"
                                : "tenantGovernanceTab__statusBadge--inactive",
                          )}
                        >
                          {formatPartnerLifecycleStatus(tenant.status)}
                        </span>
                        {hasLimitBreach ? (
                          <div className="tenantGovernanceTab__statusNote tenantGovernanceTab__statusNote--breach">Limit asimi var</div>
                        ) : hasLimitPressure ? (
                          <div className="tenantGovernanceTab__statusNote tenantGovernanceTab__statusNote--pressure">Limit yaklasiyor</div>
                        ) : null}
                      </td>
                      <td className="tenantGovernanceTab__cell tenantGovernanceTab__cell--muted">
                        {tenant.subscription_plan_code || "starter"}
                      </td>
                      <td className="tenantGovernanceTab__cell tenantGovernanceTab__cell--muted">
                        {tenant.logo_url ? "Logo var" : "Logo eksik"}
                      </td>
                      <td className="tenantGovernanceTab__cell">
                        <div className="tenantGovernanceTab__ownerStack">
                          <div className="tenantGovernanceTab__ownerName">{tenant.owner_full_name || "Owner atanmamis"}</div>
                          <div className="tenantGovernanceTab__ownerEmail">{tenant.owner_email || "Stratejik Partner admin secilmeli"}</div>
                          {governanceLocked ? (
                            <div className="tenantGovernanceTab__lockNote">
                              Odeme dogrulama, kategori onayi ve uyelik aktivasyonu tamamlanana kadar bu kayit salt okunur.
                            </div>
                          ) : null}
                          <select
                            aria-label={`Stratejik Partner owner secimi: ${tenant.brand_name || tenant.legal_name}`}
                            disabled={!canEditTenantGovernance || governanceLocked}
                            value={tenant.owner_user_id ? String(tenant.owner_user_id) : ""}
                            onChange={(event) => void handleReassignTenantOwner(tenant, event.target.value)}
                            className="tenantGovernanceTab__select tenantGovernanceTab__select--owner"
                          >
                            <option value="">Stratejik Partner owner sec</option>
                            {(tenantOwnerCandidates.get(tenant.id) || []).map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.full_name}  {candidate.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="tenantGovernanceTab__cell">
                        <div className="tenantGovernanceTab__actionRow tenantGovernanceTab__actionRow--wrap">
                          {canEditTenantGovernance ? (
                            <button
                              onClick={() => handleEditTenant(tenant)}
                              disabled={governanceLocked}
                              className={cx(
                                "tenantGovernanceTab__button tenantGovernanceTab__button--small",
                                governanceLocked ? "tenantGovernanceTab__button--disabledGrey" : "tenantGovernanceTab__button--edit",
                              )}
                            >
                              Duzenle
                            </button>
                          ) : null}
                          {canEditTenantGovernance ? (
                            <button
                              onClick={() => void handleTenantStatusAction(tenant, tenant.is_active ? "paused" : "active")}
                              disabled={tenantSaving || governanceLocked}
                              className={cx(
                                "tenantGovernanceTab__button tenantGovernanceTab__button--small",
                                governanceLocked
                                  ? "tenantGovernanceTab__button--disabledGrey"
                                  : tenant.is_active
                                    ? "tenantGovernanceTab__button--danger"
                                    : "tenantGovernanceTab__button--success",
                              )}
                            >
                              {tenant.is_active ? "Pasife Al" : "Aktif Et"}
                            </button>
                          ) : null}
                          {canEditTenantGovernance && !tenant.is_active ? (
                            <button
                              onClick={() => void handleDeleteTenant(tenant)}
                              disabled={tenantSaving || governanceLocked}
                              className={cx(
                                "tenantGovernanceTab__button tenantGovernanceTab__button--small",
                                governanceLocked ? "tenantGovernanceTab__button--disabledDark" : "tenantGovernanceTab__button--delete",
                              )}
                            >
                              Sil
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}