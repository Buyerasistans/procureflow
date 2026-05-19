import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";
import type { AdminSupplierListItem, Tenant, TenantUser } from "../../services/admin.service";

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
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 16 }}>
        <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Hizli Islem</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Super admin onayli partner acilisi</div>
          </div>
          {!canEditTenantGovernance ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}>Platform destek personeli bu alani izleyebilir; Stratejik Partner olusturma, owner yeniden atama ve yasam dongusu degistirme yetkisi sadece super admin hesabindadir.</div> : null}
          <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: "14px 16px", display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Bu akis onboarding kuyru��una girmez.</div>
            <div style={{ color: "#475569", fontSize: 13 }}>Super admin buradan stratejik partneri dogrudan aktif olarak acar. Ilk yoneticiye sadece sifre belirleme ve hesap aktivasyon e-postasi gider.</div>
          </div>
          {tenantMessage ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }}>{tenantMessage}</div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={openNewTenantModal} disabled={tenantSaving || !canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, cursor: "pointer", opacity: tenantSaving || !canEditTenantGovernance ? 0.6 : 1 }}>
              Stratejik Partner Ekle
            </button>
            <button type="button" onClick={() => handleStartOnboardingTemplate("starter")} disabled={!canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer", opacity: !canEditTenantGovernance ? 0.6 : 1 }}>
              Starter Taslagi
            </button>
            <button type="button" onClick={() => handleStartOnboardingTemplate("growth")} disabled={!canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer", opacity: !canEditTenantGovernance ? 0.6 : 1 }}>
              Growth Taslagi
            </button>
          </div>
        </div>

        {isTenantFormModalOpen ? (
          <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 20, zIndex: 80 }}>
            <div style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 24, background: "white", border: "1px solid #dbe3ee", boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)", padding: 22, display: "grid", gap: 12 }}>
              <form onSubmit={handleSubmitTenant} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Kaydi</div>
                    <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{editingTenantId ? "Stratejik Partner guncelle" : "Yeni Stratejik Partner olustur"}</div>
                    <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Bu kayit super admin onayli olarak acilir ve ilk yoneticiye sadece sifre belirleme e-postasi gider.</div>
                  </div>
                  <button type="button" onClick={closeTenantModal} style={{ border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                    Kapat
                  </button>
                </div>
                <input disabled={!canEditTenantGovernance} value={tenantForm.legal_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, legal_name: e.target.value }))} placeholder="Resmi firma adi" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                <input disabled={!canEditTenantGovernance} value={tenantForm.brand_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, brand_name: e.target.value }))} placeholder="Marka / gorunen ad" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                <input disabled={!canEditTenantGovernance} value={tenantForm.category} onChange={(e) => setTenantForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Kategori / uzmanlik alani" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                <input disabled={!canEditTenantGovernance} value={tenantForm.city} onChange={(e) => setTenantForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Sehir" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#8a5b2b", marginTop: 4 }}>Ilk Stratejik Partner Admin</div>
                <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_full_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_full_name: e.target.value }))} placeholder="Ad soyad" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_email} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_email: e.target.value }))} placeholder="E-posta" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_personal_phone} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_personal_phone: e.target.value }))} placeholder="Cep telefonu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input disabled={!canEditTenantGovernance} value={tenantForm.subscription_plan_code} onChange={(e) => setTenantForm((prev) => ({ ...prev, subscription_plan_code: e.target.value }))} placeholder="Plan kodu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                  <input disabled={!canEditTenantGovernance} value={tenantForm.onboarding_status} onChange={(e) => setTenantForm((prev) => ({ ...prev, onboarding_status: e.target.value }))} placeholder="Onboarding durumu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                </div>
                <input disabled={!canEditTenantGovernance} value={tenantForm.status} onChange={(e) => setTenantForm((prev) => ({ ...prev, status: e.target.value }))} placeholder="Status" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                {tenantMessage ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }}>{tenantMessage}</div> : null}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button type="button" onClick={closeTenantModal} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" }}>
                    Vazgec
                  </button>
                  <button type="submit" disabled={tenantSaving || !canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, cursor: "pointer", opacity: tenantSaving || !canEditTenantGovernance ? 0.6 : 1 }}>
                    {tenantSaving ? "Kaydediliyor..." : editingTenantId ? "Stratejik Partner guncelle" : "Stratejik Partner olustur"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Yonlendirmesi</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner olgunluk siniflari</div>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {[
              { label: "draft", note: "Kurulum basladi, Stratejik Partner owner ve branding eksik olabilir." },
              { label: "onboarding", note: "Ilk admin, branding ve temel organizasyon yapisi kuruluyor." },
              { label: "aktif", note: "Operasyon kullanima acik, proje ve tedarikci akislari baslayabilir." },
              { label: "duraklatildi", note: "Abonelik veya operasyon karariyla gecici durdurulmus Stratejik Partner." },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Portfoyu</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Musteri olgunluk gorunumu</div>
          <div style={{ marginTop: 8, color: "#64748b" }}>Bu alan artik Stratejik Partner tablosundaki kayitlari dogrudan yonetir.</div>
          {tenantGovernanceFocus ? (
            <div style={{ marginTop: 12 }}>
              {renderAdminFocusBanner({
                eyebrow: "Admin Focus",
                title: `Discovery Lab odagi: ${tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`}`,
                detail: "Stratejik Partner portfoyu listesi bu odaga gore daraltildi.",
                tone: "blue",
                sourceLabel: "Stratejik Partner deep-link",
                timestamp: Date.now(),
                actions: [{ label: "Odagi Temizle", onClick: () => setTenantGovernanceFocus(null) }],
                testId: "admin-focus-banner-tenant",
              })}
            </div>
          ) : null}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "all", label: "Tum Stratejik Partnerler" },
                { key: "pressure", label: "Limit Baskisi" },
                { key: "breach", label: "Limit Asimi" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTenantUsageFilter(item.key as "all" | "pressure" | "breach")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: tenantUsageFilter === item.key ? "1px solid #1d4ed8" : "1px solid #dbe3ee",
                    background: tenantUsageFilter === item.key ? "#dbeafe" : "white",
                    color: tenantUsageFilter === item.key ? "#1d4ed8" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13, fontWeight: 700 }}>
                Kategori
                <select
                  value={tenantCategoryFilter}
                  onChange={(event) => setTenantCategoryFilter(event.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                >
                  <option value="all">Tum kategoriler</option>
                  <option value="uncategorized">Kategori eksik</option>
                  {tenantCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13, fontWeight: 700 }}>
                Siralama
                <select
                  value={tenantSortMode}
                  onChange={(event) => setTenantSortMode(event.target.value as "risk" | "name")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                >
                  <option value="risk">Risk onceligi</option>
                  <option value="name">Ada gore</option>
                </select>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#eff6ff", padding: "12px 14px", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#1d4ed8" }}>Kategori Kapsami</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1d4ed8" }}>{tenantCategorySummary.length}</div>
              <div style={{ color: "#475569", fontSize: 12 }}>Tenant ve tedarikci tarafinda gorulen ortak kategori sayisi</div>
            </div>
            <div style={{ borderRadius: 16, border: "1px solid #d1fae5", background: "#ecfdf5", padding: "12px 14px", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#15803d" }}>Kategori Eslesen Tedarikci</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#15803d" }}>{tenantCategorySummary.reduce((sum, item) => sum + item.supplierCount, 0)}</div>
              <div style={{ color: "#475569", fontSize: 12 }}>Kategoriye sahip supplier portfoyu sinyali</div>
            </div>
            <div style={{ borderRadius: 16, border: "1px solid #fde68a", background: "#fffbeb", padding: "12px 14px", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#b45309" }}>Kategori Eksigi</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#b45309" }}>{tenants.filter((tenant) => !String(tenant.category || "").trim()).length}</div>
              <div style={{ color: "#475569", fontSize: 12 }}>Esleme icin henuz kategori atanmamis tenant sayisi</div>
            </div>
          </div>
          {tenantCategorySummary.length > 0 ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tenantCategorySummary.slice(0, 8).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setTenantCategoryFilter(item.category)}
                  style={{ padding: "7px 11px", borderRadius: 999, border: tenantCategoryFilter === item.category ? "1px solid #0f766e" : "1px solid #dbe3ee", background: tenantCategoryFilter === item.category ? "#ecfeff" : "white", color: tenantCategoryFilter === item.category ? "#0f766e" : "#475569", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                >
                  {item.category} ��� {item.tenantCount} tenant / {item.supplierCount} supplier
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "white", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: 14, textAlign: "left" }}>Stratejik Partner</th>
                <th style={{ padding: 14, textAlign: "left" }}>Durum</th>
                <th style={{ padding: 14, textAlign: "left" }}>Plan</th>
                <th style={{ padding: 14, textAlign: "left" }}>Branding</th>
                <th style={{ padding: 14, textAlign: "left" }}>Stratejik Partner Owner</th>
                <th style={{ padding: 14, textAlign: "left" }}>Islem</th>
              </tr>
            </thead>
            <tbody>
              {visibleTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18, color: "#64748b", textAlign: "center" }}>
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
                  const hasPendingCategoryReview = (tenant.category_requests || []).some((item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()));
                  const governanceLocked = governanceOnboardingStatus !== "active"
                    || governanceApprovalStatus !== "approved"
                    || !["verified", "succeeded", "not_required"].includes(governancePaymentStatus)
                    || hasPendingCategoryReview;
                  const matchingSupplierCount = normalizedTenantCategory
                    ? tenantGovernanceSuppliers.filter((supplier) => String(supplier.category || "").trim() === normalizedTenantCategory).length
                    : 0;
                  const hasLimitPressure = (usage?.metrics || []).some((metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used / metric.limit >= 0.8);
                  const hasLimitBreach = (usage?.metrics || []).some((metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used >= metric.limit);
                  return (
                    <tr key={tenant.id} style={{ borderBottom: "1px solid #eef2f7", background: hasLimitBreach ? "#fff7f7" : hasLimitPressure ? "#fffbeb" : "white" }}>
                      <td style={{ padding: 14 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                        <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenant.slug} ��� {tenant.city || "Sehir eksik"}</div>
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: normalizedTenantCategory ? "#ecfeff" : "#f8fafc", color: normalizedTenantCategory ? "#0f766e" : "#64748b", fontWeight: 700, fontSize: 11 }}>
                            {normalizedTenantCategory || "Kategori eksik"}
                          </span>
                          {normalizedTenantCategory ? (
                            <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: matchingSupplierCount > 0 ? "#ecfdf5" : "#fff7ed", color: matchingSupplierCount > 0 ? "#166534" : "#9a3412", fontWeight: 700, fontSize: 11 }}>
                              {matchingSupplierCount > 0 ? `${matchingSupplierCount} tedarikci eslesiyor` : "Eslesen tedarikci yok"}
                            </span>
                          ) : null}
                        </div>
                        {usage ? (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {usage.metrics.map((metric) => {
                              const ratio = metric.limit !== null && metric.limit !== undefined && metric.limit > 0 ? metric.used / metric.limit : 0;
                              const background = ratio >= 1 ? "#fee2e2" : ratio >= 0.8 ? "#fef3c7" : "#eef2ff";
                              const color = ratio >= 1 ? "#991b1b" : ratio >= 0.8 ? "#92400e" : "#3730a3";
                              return (
                                <span key={`${tenant.id}-${metric.key}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background, color, fontWeight: 700, fontSize: 11 }}>
                                  {metric.label}: {metric.used}{metric.limit !== null && metric.limit !== undefined ? `/${metric.limit}` : ""}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: 14 }}>
                        <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: hasLimitBreach ? "#fee2e2" : tenant.is_active ? "#dcfce7" : "#fee2e2", color: hasLimitBreach ? "#991b1b" : tenant.is_active ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                          {formatPartnerLifecycleStatus(tenant.status)}
                        </span>
                        {hasLimitBreach ? <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>Limit asimi var</div> : hasLimitPressure ? <div style={{ marginTop: 8, color: "#92400e", fontSize: 12, fontWeight: 700 }}>Limit yaklasiyor</div> : null}
                      </td>
                      <td style={{ padding: 14, color: "#334155" }}>{tenant.subscription_plan_code || "starter"}</td>
                      <td style={{ padding: 14, color: "#334155" }}>
                        {tenant.logo_url ? "Logo var" : "Logo eksik"}
                      </td>
                      <td style={{ padding: 14 }}>
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ color: "#0f172a", fontWeight: 700 }}>
                            {tenant.owner_full_name || "Owner atanmamis"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {tenant.owner_email || "Stratejik Partner admin secilmeli"}
                          </div>
                          {governanceLocked ? (
                            <div style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}>
                              Odeme dogrulama, kategori onayi ve uyelik aktivasyonu tamamlanana kadar bu kayit salt okunur.
                            </div>
                          ) : null}
                          <select
                            disabled={!canEditTenantGovernance || governanceLocked}
                            value={tenant.owner_user_id ? String(tenant.owner_user_id) : ""}
                            onChange={(event) => void handleReassignTenantOwner(tenant, event.target.value)}
                            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: !canEditTenantGovernance || governanceLocked ? "#f8fafc" : "white" }}
                          >
                            <option value="">Stratejik Partner owner sec</option>
                            {(tenantOwnerCandidates.get(tenant.id) || []).map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.full_name} ��� {candidate.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: 14 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {canEditTenantGovernance ? <button onClick={() => handleEditTenant(tenant)} disabled={governanceLocked} style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: governanceLocked ? "#e2e8f0" : "#e0e7ff", color: governanceLocked ? "#94a3b8" : "#3730a3", fontWeight: 700, cursor: governanceLocked ? "not-allowed" : "pointer" }}>
                            Duzenle
                          </button> : null}
                          {canEditTenantGovernance ? <button
                            onClick={() => void handleTenantStatusAction(tenant, tenant.is_active ? "paused" : "active")}
                            disabled={tenantSaving || governanceLocked}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 12,
                              border: "none",
                              background: governanceLocked ? "#e2e8f0" : tenant.is_active ? "#fef2f2" : "#ecfdf5",
                              color: governanceLocked ? "#94a3b8" : tenant.is_active ? "#b91c1c" : "#166534",
                              fontWeight: 700,
                              cursor: governanceLocked ? "not-allowed" : "pointer",
                            }}
                          >
                            {tenant.is_active ? "Pasife Al" : "Aktif Et"}
                          </button> : null}
                          {canEditTenantGovernance && !tenant.is_active ? <button
                            onClick={() => void handleDeleteTenant(tenant)}
                            disabled={tenantSaving || governanceLocked}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 12,
                              border: "none",
                              background: governanceLocked ? "#cbd5e1" : "#111827",
                              color: "white",
                              fontWeight: 700,
                              cursor: governanceLocked ? "not-allowed" : "pointer",
                            }}
                          >
                            Sil
                          </button> : null}
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
