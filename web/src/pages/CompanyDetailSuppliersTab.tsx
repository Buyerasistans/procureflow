import { useState, useEffect } from "react";
import { getAdminSuppliers, getAdminTenantSuppliers, type AdminSupplierListItem } from "../services/admin.service";

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

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  if (error) {
    return (
      <div style={{ padding: 20, background: "#fee2e2", color: "#991b1b", borderRadius: 8 }}>
        {error}
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Tedarikçi yok</div>
        <div style={{ fontSize: 14 }}>
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
      style={{
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: isPlatformSupplier ? "#fffbeb" : "#fff",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "start",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 24,
        }}
      >
        🏢
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a" }}>
              {supplier.company_name}
            </div>
            <span
              style={{
                display: "inline-flex",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: isPlatformSupplier ? "#fef3c7" : "#dcfce7",
                color: isPlatformSupplier ? "#92400e" : "#166534",
              }}
            >
              {isPlatformSupplier ? "⭐ Platform Tedarikçisi" : "Firma Daveti"}
            </span>
            {supplier.special_listing_active ? (
              <span
                style={{
                  display: "inline-flex",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#ede9fe",
                  color: "#5b21b6",
                }}
              >
                Buyera Asistans Ozel Liste
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {supplier.email}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, max-content))", gap: 12, fontSize: 13 }}>
          <div>
            <span style={{ color: "#94a3b8", fontWeight: 500 }}>Davet Eden:</span>
            {" "}
            <span style={{ color: "#475569" }}>{supplier.inviter_company_name || supplier.tenant_name || tenantName || "Buyera Asistans"}</span>
          </div>
          {supplier.city && (
            <div>
              <span style={{ color: "#94a3b8", fontWeight: 500 }}>Şehir:</span>
              {" "}
              <span style={{ color: "#475569" }}>{supplier.city}</span>
            </div>
          )}
          {supplier.phone && (
            <div>
              <span style={{ color: "#94a3b8", fontWeight: 500 }}>Telefon:</span>
              {" "}
              <span style={{ color: "#475569" }}>{supplier.phone}</span>
            </div>
          )}
          <div>
            <span style={{ color: "#94a3b8", fontWeight: 500 }}>Durum:</span>
            {" "}
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                background: supplier.is_active ? "#d1fae5" : "#fee2e2",
                color: supplier.is_active ? "#065f46" : "#991b1b",
              }}
            >
              {supplier.is_active ? "Aktif" : "Pasif"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <button
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Detay
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {invitedSuppliers.length > 0 ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", letterSpacing: 0.3 }}>Firma Daveti ile Gelen Tedarikçiler</div>
          {invitedSuppliers.map((supplier) => renderSupplierCard(supplier, false))}
        </>
      ) : null}

      {platformSuppliers.length > 0 ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", letterSpacing: 0.3 }}>Platform Tedarikçi Havuzu</div>
          {platformSuppliers.map((supplier) => renderSupplierCard(supplier, true))}
        </>
      ) : null}
    </div>
  );
}
