import { useMemo } from "react";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { AdminFocusBannerTone } from "./adminPageMeta";
import type { AdminSupplierListItem, Company, SubscriptionCatalogSnapshot, Tenant, TenantUser } from "../../services/admin.service";
import { updateTenant } from "../../services/admin.service";
import { buildPartnerRows } from "./strategicPartner.helpers";
import StrategicPartnerGovernance from "./StrategicPartnerGovernance";
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
  tenantUsageByTenant: Map<number, { metrics: Array<{ key: string; label: string; used: number; limit?: number | null }> }>;
  tenantGovernanceSuppliers: AdminSupplierListItem[];
  formatPartnerLifecycleStatus: (status: string | null | undefined) => string;
  tenantOwnerCandidates: Map<number, TenantUser[]>;
  handleReassignTenantOwner: (tenant: Tenant, ownerUserId: string) => Promise<void>;
  handleEditTenant: (tenant: Tenant) => void;
  handleTenantStatusAction: (tenant: Tenant, nextStatus: "active" | "paused") => Promise<void>;
  handleDeleteTenant: (tenant: Tenant) => Promise<void>;
  companies: Company[];
  subscriptionCatalog: SubscriptionCatalogSnapshot | null;
  navigateAdminTab: (tab: string, tenantId?: number) => void;
};

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
  tenants,
  visibleTenants,
  tenantUsageByTenant,
  tenantUsageFilter,
  setTenantUsageFilter,
  tenantSortMode,
  setTenantSortMode,
  handleEditTenant,
  tenantGovernanceSuppliers,
  companies,
  subscriptionCatalog,
  navigateAdminTab,
  tenantGovernanceFocus,
  renderAdminFocusBanner,
  setTenantGovernanceFocus,
}: TenantGovernanceTabProps) {
  const effectiveTenants = visibleTenants ?? tenants;

  const partnerRows = useMemo(
    () => buildPartnerRows({ tenants: effectiveTenants, companies, suppliers: tenantGovernanceSuppliers }),
    [effectiveTenants, companies, tenantGovernanceSuppliers],
  );

  const planOptions = useMemo(
    () => (subscriptionCatalog?.catalog.plans ?? []).map((p) => ({ code: p.code, name: p.name, monthlyPrice: 0 })),
    [subscriptionCatalog],
  );

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
              Stratejik Partner olusturma, owner yeniden atama ve yasam dongusu degistirme yetkisi sadece super admin hesabindadir.
            </div>
          ) : null}
          {!isTenantFormModalOpen && (
            <div className="tgTab__inlinePreview">
              <input disabled={!canEditTenantGovernance} placeholder="Resmi firma adi" className="tgTab__input" readOnly={!canEditTenantGovernance} defaultValue="" />
              <input disabled={!canEditTenantGovernance} placeholder="E-posta" className="tgTab__input" readOnly={!canEditTenantGovernance} defaultValue="" />
              <input disabled={!canEditTenantGovernance} placeholder="Plan kodu" className="tgTab__input" readOnly={!canEditTenantGovernance} defaultValue="" />
            </div>
          )}
          <div className="tgTab__infoPanel">
            <div className="tgTab__infoPanelTitle">Bu akış onboarding kuyuguna girmez.</div>
            <div className="tgTab__infoPanelText">
              Süper admin buradan stratejik partneri doğrudan aktif olarak açar. İlk yöneticiye sadece şifre belirleme ve hesap aktivasyon e-postası gider.
            </div>
          </div>
          {tenantMessage ? <div className="tgTab__message">{tenantMessage}</div> : null}
          <div className="tgTab__buttonRow">
            <button type="button" onClick={openNewTenantModal} disabled={tenantSaving || !canEditTenantGovernance} className="tgTab__btn tgTab__btn--primary">
              Stratejik Partner Olustur
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
              { label: "draft",        note: "Kurulum başladı, owner ve branding eksik olabilir.",               color: "slate" },
              { label: "onboarding",   note: "İlk admin, branding ve temel organizasyon yapısı kuruluyor.",       color: "blue"  },
              { label: "aktif",        note: "Operasyon kullanıma açık, proje ve tedarikçi akışları başlayabilir.", color: "green" },
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
                    {editingTenantId ? "Stratejik Partner Guncelle" : "Yeni Stratejik Partner Olustur"}
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

      {/* ── Tenant Focus Banner ────────────────────────────── */}
      {tenantGovernanceFocus && renderAdminFocusBanner && renderAdminFocusBanner({
        eyebrow: "Admin Focus",
        title: `Discovery lab odagi: ${tenantGovernanceFocus.tenantName || `#${tenantGovernanceFocus.tenantId}`}`,
        detail: "Stratejik Partner listesi bu odak ile acildi. Sadece ilgili kayitlar gosteriliyor.",
        tone: "teal",
        sourceLabel: "Stratejik Partner Deep-Link",
        actions: setTenantGovernanceFocus ? [{ label: "Odagi Temizle", onClick: () => setTenantGovernanceFocus(null) }] : undefined,
        testId: "admin-focus-banner-tenant",
      })}

      {/* ── Kullanim Ozeti ve Filtreler ─────────────────────── */}
      <div className="tgTab__usageSection">
        <div className="tgTab__filterRow">
          <button
            type="button"
            className="tgTab__btn tgTab__btn--ghost"
            onClick={() => setTenantUsageFilter?.("all")}
          >
            Tum stratejik partnerler
          </button>
          <button
            type="button"
            className="tgTab__btn tgTab__btn--ghost"
            onClick={() => setTenantUsageFilter?.("breach")}
          >
            Limit asimi
          </button>
          <select
            aria-label="Siralama modu"
            value={tenantSortMode ?? "risk"}
            onChange={(e) => setTenantSortMode?.(e.target.value as "risk" | "name")}
            className="tgTab__select"
          >
            <option value="risk">Risk onceligi</option>
            <option value="name">Ad siralaması</option>
          </select>
        </div>

        {effectiveTenants.map((tenant) => {
          const usage = tenantUsageByTenant?.get(tenant.id);
          return (
            <div key={tenant.id} className="tgTab__usageRow">
              {usage?.metrics.map((metric) => {
                const atLimit = metric.limit != null && metric.limit > 0 && metric.used >= metric.limit;
                return (
                  <span key={metric.key} className="tgTab__usageMetric">
                    {atLimit
                      ? "Limit asimi var"
                      : `${metric.label}: ${metric.used}/${metric.limit ?? "—"}`}
                  </span>
                );
              })}
              {canEditTenantGovernance && handleEditTenant && (
                <button
                  type="button"
                  className="tgTab__btn tgTab__btn--ghost tgTab__btn--sm"
                  onClick={() => handleEditTenant(tenant)}
                >
                  Duzenle
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Stratejik Partner Yönetimi ──────────────────────── */}
      <StrategicPartnerGovernance
        rows={partnerRows}
        planOptions={planOptions}
        onCreatePartner={(draft) => {
          setTenantForm((prev) => ({
            ...prev,
            legal_name: draft.name,
            brand_name: draft.name,
            city: draft.city,
            category: draft.sector,
            initial_admin_email: draft.contact,
            subscription_plan_code: draft.planCode,
            status: draft.status,
          }));
          openNewTenantModal();
        }}
        onChangePlan={async (ids, planCode) => {
          await Promise.all(ids.map((id) => updateTenant(id, { subscription_plan_code: planCode })));
        }}
        onCrossLink={(key, tenantId) => navigateAdminTab(key, tenantId)}
      />
    </section>
  );
}
