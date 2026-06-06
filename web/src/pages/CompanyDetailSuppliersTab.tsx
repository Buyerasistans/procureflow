import { useState, useEffect } from "react";
import { getAdminSuppliers, getAdminTenantSuppliers, type AdminSupplierListItem } from "../services/admin.service";
import "./CompanyDetailSuppliersTab.css";

interface CompanyDetailSuppliersTabProps {
  companyId?: number | null;
  tenantId?: number | null;
  tenantName?: string;
  companyCreatedById?: number | null;
}

export function CompanyDetailSuppliersTab({ tenantId, tenantName, companyCreatedById }: CompanyDetailSuppliersTabProps) {
  const [suppliers, setSuppliers] = useState<AdminSupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = tenantId
          ? await getAdminTenantSuppliers(tenantId)
          : await getAdminSuppliers({ source_type: "platform_network" });
        const scoped = !tenantId && companyCreatedById
          ? data.filter((supplier) => supplier.created_by_id === companyCreatedById)
          : data;
        setSuppliers(scoped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tedarikçiler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [tenantId, companyCreatedById]);

  if (loading) return <div className="cdst-loading">Yükleniyor...</div>;

  if (error) {
    return <div className="cdst-error">{error}</div>;
  }

  if (suppliers.length === 0) {
    return (
      <div className="cdst-empty">
        <div className="cdst-empty-title">Tedarikçi yok</div>
        <div className="cdst-empty-desc">
          {tenantId
            ? "Bu firmaya henüz davet edilen tedarikçi bulunmuyor."
            : "Bu firma tenant bağımsız olduğu için Buyera Asistans özel tedarikçi havuzu gösterilir."}
        </div>
      </div>
    );
  }

  const invitedSuppliers = suppliers.filter((supplier) => {
    const sourceType = String(supplier.source_type || "").toLowerCase();
    return sourceType !== "platform_network";
  });

  const platformSuppliers = suppliers.filter((supplier) => {
    const sourceType = String(supplier.source_type || "").toLowerCase();
    return sourceType === "platform_network";
  });

  const renderSupplierCard = (supplier: AdminSupplierListItem, isPlatformSupplier: boolean) => (
    <div
      key={supplier.id}
      className={isPlatformSupplier ? "cdst-card cdst-card--platform" : "cdst-card"}
    >
      <div className="cdst-avatar">🏢</div>

      <div className="cdst-info">
        <div>
          <div className="cdst-name-row">
            <div className="cdst-name">{supplier.company_name}</div>
            <span className={isPlatformSupplier ? "cdst-badge cdst-badge--platform" : "cdst-badge cdst-badge--invited"}>
              {isPlatformSupplier ? "⭐ Platform Tedarikçisi" : "Firma Daveti"}
            </span>
            {supplier.special_listing_active && (
              <span className="cdst-badge cdst-badge--special">
                Buyera Asistans Ozel Liste
              </span>
            )}
          </div>
          <div className="cdst-email">{supplier.email}</div>
        </div>
        <div className="cdst-meta">
          <div>
            <span className="cdst-meta-label">Davet Eden:</span>{" "}
            <span className="cdst-meta-value">
              {supplier.inviter_company_name || supplier.tenant_name || tenantName || "Buyera Asistans"}
            </span>
          </div>
          {supplier.city && (
            <div>
              <span className="cdst-meta-label">Şehir:</span>{" "}
              <span className="cdst-meta-value">{supplier.city}</span>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span className="cdst-meta-label">Telefon:</span>{" "}
              <span className="cdst-meta-value">{supplier.phone}</span>
            </div>
          )}
          <div>
            <span className="cdst-meta-label">Durum:</span>{" "}
            <span className={supplier.is_active ? "cdst-status cdst-status--active" : "cdst-status cdst-status--inactive"}>
              {supplier.is_active ? "Aktif" : "Pasif"}
            </span>
          </div>
        </div>
      </div>

      <div className="cdst-actions">
        <button type="button" className="cdst-detail-btn">Detay</button>
      </div>
    </div>
  );

  return (
    <div className="cdst-root">
      {invitedSuppliers.length > 0 && (
        <>
          <div className="cdst-section-title--invited">Firma Daveti ile Gelen Tedarikçiler</div>
          {invitedSuppliers.map((supplier) => renderSupplierCard(supplier, false))}
        </>
      )}

      {platformSuppliers.length > 0 && (
        <>
          <div className="cdst-section-title--platform">Platform Tedarikçi Havuzu</div>
          {platformSuppliers.map((supplier) => renderSupplierCard(supplier, true))}
        </>
      )}
    </div>
  );
}
