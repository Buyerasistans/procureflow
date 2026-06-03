import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { http } from "../lib/http";
import { resolveApprovalRoleLabel } from "../auth/permissions";
import type { QuotePendingApprovalLike } from "../types/approval";
import "./SendQuoteModal.css";

type SupplierSourceType = "all" | "private" | "platform_network";

type ProjectSupplier = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_email: string;
  source_type?: "private" | "platform_network";
  tenant_id?: number | null;
  invited_by_tenant_id?: number | null;
  source_tenant_id?: number | null;
  category?: string;
  category_tags?: string[];
  partner_category_tags?: string[];
  effective_category_tags?: string[];
  is_active: boolean;
};

type QuoteEntitlementLike = {
  tenant_id?: number | null;
  package_plan_code?: string | null;
  package_plan_name?: string | null;
  active_premium_feature_codes?: string[];
  entitlement_summary?: string | null;
  platform_network_listing_enabled?: boolean;
};

type Props = {
  quote: QuoteEntitlementLike;
  quoteId: number;
  projectId: number;
  suppliers: ProjectSupplier[];
  onClose: () => void;
  onSent: () => void;
};

export default function SendQuoteModal({ quote, quoteId, projectId, suppliers, onClose, onSent }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSourceType, setSelectedSourceType] = useState<SupplierSourceType>("all");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [alreadySentSupplierIds, setAlreadySentSupplierIds] = useState<number[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<QuotePendingApprovalLike[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingSentSuppliers, setLoadingSentSuppliers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSupplierCategories = (supplier: ProjectSupplier): string[] => {
    if (supplier.effective_category_tags && supplier.effective_category_tags.length > 0) {
      return supplier.effective_category_tags;
    }
    if (supplier.category) {
      return [supplier.category];
    }
    return [];
  };

  const platformNetworkEligible = Boolean(quote.platform_network_listing_enabled);
  const currentTenantId = quote.tenant_id ?? null;
  const premiumCodes = quote.active_premium_feature_codes || [];

  const isPrivateSupplierVisibleForCurrentTenant = useCallback((supplier: ProjectSupplier): boolean => {
    if ((supplier.source_type || "private") === "platform_network") return true;
    if (currentTenantId == null) return true;
    const invitedByTenantId = supplier.invited_by_tenant_id ?? supplier.source_tenant_id ?? supplier.tenant_id ?? null;
    if (invitedByTenantId == null) return true;
    return invitedByTenantId === currentTenantId;
  }, [currentTenantId]);

  useEffect(() => {
    let cancelled = false;

    const loadSentSuppliers = async () => {
      try {
        setLoadingSentSuppliers(true);
        const [sentRes, approvalsRes] = await Promise.all([
          http.get<Array<{ supplier_id: number }>>(`/quotes/${quoteId}/suppliers`),
          http.get<QuotePendingApprovalLike[]>(`/approvals/${quoteId}/pending`),
        ]);
        if (cancelled) return;
        const supplierIds = Array.isArray(sentRes.data)
          ? sentRes.data.map((row) => Number(row.supplier_id)).filter((value) => Number.isFinite(value))
          : [];
        setAlreadySentSupplierIds(supplierIds);
        setPendingApprovals(Array.isArray(approvalsRes.data) ? approvalsRes.data.filter((approval) => approval.status === "beklemede") : []);
        setSelectedSupplierIds((prev) => prev.filter((id) => !supplierIds.includes(id)));
      } catch {
        if (!cancelled) {
          setAlreadySentSupplierIds([]);
          setPendingApprovals([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSentSuppliers(false);
        }
      }
    };

    void loadSentSuppliers();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      getSupplierCategories(s).forEach((category) => set.add(category));
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "tr"))];
  }, [suppliers]);

  const visibleSuppliers = useMemo(() => {
    const active = suppliers
      .filter((s) => s.is_active)
      .filter((s) => isPrivateSupplierVisibleForCurrentTenant(s));
    const sourceFiltered =
      selectedSourceType === "all"
        ? active
        : active.filter((s) => (s.source_type || "private") === selectedSourceType);
    if (selectedCategory === "all") return sourceFiltered;
    return sourceFiltered.filter((s) => getSupplierCategories(s).includes(selectedCategory));
  }, [suppliers, selectedCategory, selectedSourceType, isPrivateSupplierVisibleForCurrentTenant]);

  const sourceSummary = useMemo(
    () => ({
      all: suppliers.filter((s) => s.is_active && isPrivateSupplierVisibleForCurrentTenant(s)).length,
      private: suppliers.filter((s) => s.is_active && isPrivateSupplierVisibleForCurrentTenant(s) && (s.source_type || "private") === "private").length,
      platform_network: suppliers.filter((s) => s.is_active && isPrivateSupplierVisibleForCurrentTenant(s) && (s.source_type || "private") === "platform_network").length,
    }),
    [suppliers, isPrivateSupplierVisibleForCurrentTenant],
  );

  const toggleSupplier = (supplierId: number) => {
    const supplier = suppliers.find((item) => item.supplier_id === supplierId);
    const privateVisibilityAllowed = supplier ? isPrivateSupplierVisibleForCurrentTenant(supplier) : false;
    const isPlatformNetworkSupplier = (supplier?.source_type || "private") === "platform_network";
    if (alreadySentSupplierIds.includes(supplierId) || !privateVisibilityAllowed || (isPlatformNetworkSupplier && !platformNetworkEligible)) {
      return;
    }
    setSelectedSupplierIds((prev) =>
      prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]
    );
  };

  const selectAllVisible = () => {
    setSelectedSupplierIds((prev) => {
      const set = new Set(prev);
      visibleSuppliers
        .filter((s) => !alreadySentSupplierIds.includes(s.supplier_id))
        .filter((s) => isPrivateSupplierVisibleForCurrentTenant(s))
        .filter((s) => (s.source_type || "private") !== "platform_network" || platformNetworkEligible)
        .forEach((s) => set.add(s.supplier_id));
      return Array.from(set);
    });
  };

  const clearSelection = () => setSelectedSupplierIds([]);

  const handleSend = async () => {
    if (selectedSupplierIds.length === 0) {
      setError("En az bir tedarikçi seçiniz.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      await http.post(`/quotes/${quoteId}/send-to-suppliers`, selectedSupplierIds);
      onSent();
      onClose();
    } catch (err) {
      const detail =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(detail || (err instanceof Error ? err.message : "Teklif gönderilemedi"));
    } finally {
      setSending(false);
    }
  };

  const isSubmitDisabled = sending || loadingSentSuppliers || pendingApprovals.length > 0;

  return (
    <div className="sqm-overlay" onClick={onClose}>
      <div className="sqm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sqm-header">
          <h3 className="sqm-title">Teklifi Tedarikçilere Gönder</h3>
          <button className="sqm-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="sqm-subtitle">
          Proje ID: {projectId} - Sadece bu projeye eklenen tedarikçiler listelenir.
        </div>

        <div className="sqm-visibility-note">
          Görünürlük kuralı: Platform ağı tedarikçileri her zaman görünür. Private tedarikçiler yalnızca mevcut tenant tarafından davet edildiyse listelenir.
        </div>

        <div className="sqm-badges">
          <span className="sqm-badge">
            Plan: {quote.package_plan_name || quote.package_plan_code || "starter"}
          </span>
          <span className={`sqm-badge ${platformNetworkEligible ? "sqm-badge--network-ok" : "sqm-badge--network-warn"}`}>
            {platformNetworkEligible ? "Platform Ağı Açık" : "Platform Ağı Kapalı"}
          </span>
          {premiumCodes.length > 0 ? (
            <span className="sqm-badge sqm-badge--premium">
              Premium: {premiumCodes.join(", ")}
            </span>
          ) : null}
        </div>

        {loadingSentSuppliers && (
          <div className="sqm-loading-hint">
            Daha önce gönderilen tedarikçiler kontrol ediliyor...
          </div>
        )}

        <div className="sqm-source-grid">
          {[
            { key: "all", label: "Tum Kaynaklar", value: sourceSummary.all, color: "#0f172a" },
            { key: "private", label: "Private Supplier", value: sourceSummary.private, color: "#7c3aed" },
            { key: "platform_network", label: "Platform Ağı", value: sourceSummary.platform_network, color: "#0f766e" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedSourceType(item.key as SupplierSourceType)}
              className={`sqm-src-btn${selectedSourceType === item.key ? " sqm-src-btn--active" : ""}`}
              style={{ "--sqm-src-color": item.color } as CSSProperties}
            >
              <div className="sqm-src-btn__label">{item.label}</div>
              <div className="sqm-src-btn__value">{item.value}</div>
            </button>
          ))}
        </div>

        <div className="sqm-cat-list">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`sqm-cat-btn${selectedCategory === cat ? " sqm-cat-btn--active" : ""}`}
            >
              {cat === "all" ? "Tüm Kategoriler" : cat}
            </button>
          ))}
        </div>

        <div className="sqm-actions-bar">
          <button type="button" onClick={selectAllVisible} className="sqm-action-btn">
            Görünenleri Seç
          </button>
          <button type="button" onClick={clearSelection} className="sqm-action-btn">
            Seçimi Temizle
          </button>
        </div>

        {error && <div className="sqm-error">{error}</div>}

        {pendingApprovals.length > 0 && (
          <div className="sqm-approval-warn">
            <div className="sqm-approval-warn__title">
              Tedarikçiye gönderim henüz açılamaz
            </div>
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="sqm-approval-warn__item">
                Seviye {approval.level}: {resolveApprovalRoleLabel(approval)} onayı bekleniyor
              </div>
            ))}
          </div>
        )}

        <div className="sqm-pkg-rule">
          <div className="sqm-pkg-rule__title">
            Paket kurali
          </div>
          <div className="sqm-pkg-rule__body">
            Private supplier seçimleri her pakette gönderilebilir. Platform Ağı seçimleri ise Growth, Enterprise veya aktif premium entitlement gerektirir. Uygun olmayan seçimlerde backend gönderimi bloke eder.
          </div>
          {quote.entitlement_summary ? (
            <div className={`sqm-pkg-rule__entitlement ${platformNetworkEligible ? "sqm-pkg-rule__entitlement--ok" : "sqm-pkg-rule__entitlement--warn"}`}>
              {quote.entitlement_summary}
            </div>
          ) : null}
        </div>

        <div className="sqm-supplier-list">
          {visibleSuppliers.length === 0 ? (
            <div className="sqm-supplier-empty">Bu filtrede tedarikçi yok.</div>
          ) : (
            visibleSuppliers.map((s) => {
              const isPlatformNetworkSupplier = (s.source_type || "private") === "platform_network";
              const isBlockedByPlan = isPlatformNetworkSupplier && !platformNetworkEligible;
              const isDisabled = alreadySentSupplierIds.includes(s.supplier_id) || pendingApprovals.length > 0 || isBlockedByPlan;
              return (
                <label
                  key={s.id}
                  className={`sqm-supplier-row${isDisabled ? " sqm-supplier-row--disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSupplierIds.includes(s.supplier_id)}
                    disabled={isDisabled}
                    onChange={() => toggleSupplier(s.supplier_id)}
                  />
                  <div className="sqm-supplier-info">
                    <strong className="sqm-supplier-name">{s.supplier_name}</strong>
                    <span className="sqm-supplier-email">{s.supplier_email}</span>
                    <div className="sqm-cat-tags">
                      {getSupplierCategories(s).length > 0 ? getSupplierCategories(s).map((item) => (
                        <span key={`${s.supplier_id}-${item}`} className="sqm-cat-tag">
                          {item}
                        </span>
                      )) : <span className="sqm-no-cats">Kategori yok</span>}
                    </div>
                    <span className={`sqm-source-label ${s.source_type === "platform_network" ? "sqm-source-label--network" : "sqm-source-label--private"}`}>
                      {s.source_type === "platform_network" ? "Platform Ağı" : "Private Supplier"}
                    </span>
                    {alreadySentSupplierIds.includes(s.supplier_id) && (
                      <span className="sqm-already-sent">
                        Bu tedarikçiye daha önce gönderildi
                      </span>
                    )}
                    {isBlockedByPlan && (
                      <span className="sqm-blocked">
                        Mevcut paket bu platform ağı supplier secimine izin vermiyor
                      </span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="sqm-footer">
          <button type="button" onClick={onClose} className="sqm-cancel-btn">
            İptal
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitDisabled || selectedSupplierIds.length === 0}
            className={`sqm-submit-btn${isSubmitDisabled ? " sqm-submit-btn--disabled" : ""}`}
          >
            {sending ? "Gönderiliyor..." : `Gönder (${selectedSupplierIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
