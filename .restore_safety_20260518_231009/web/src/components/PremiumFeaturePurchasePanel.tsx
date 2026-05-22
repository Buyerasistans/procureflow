import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type TenantOption = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

type AddonCatalogItem = {
  code: string;
  name: string;
  description?: string | null;
  price_monthly?: number | null;
  currency?: string | null;
  increment?: number | null;
  unit?: string | null;
};

type PremiumFeaturePurchasePanelProps = {
  tenants: TenantOption[];
  defaultTenantId?: number | null;
  buyerName: string;
  buyerEmail: string;
  allowAdminVerification?: boolean;
  addonCatalog: AddonCatalogItem[];
};

function formatPrice(addon: AddonCatalogItem) {
  if (!addon.price_monthly) {
    return "Fiyatlandirma tanimsiz";
  }
  return `${Number(addon.price_monthly).toLocaleString("tr-TR")} ${addon.currency || "TRY"} / ay`;
}

export default function PremiumFeaturePurchasePanel({
  tenants,
  defaultTenantId,
  buyerName,
  buyerEmail,
  allowAdminVerification = false,
  addonCatalog,
}: PremiumFeaturePurchasePanelProps) {
  const initialTenantId = defaultTenantId ?? tenants[0]?.id ?? null;
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(initialTenantId);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || tenants[0] || null,
    [selectedTenantId, tenants],
  );

  const requestBase = `/demo?audience=strategic&intent=addon_purchase&buyer=${encodeURIComponent(buyerName)}&email=${encodeURIComponent(buyerEmail)}`;
  const tenantQuery = selectedTenant
    ? `&tenantId=${encodeURIComponent(String(selectedTenant.id))}&company=${encodeURIComponent(selectedTenant.name)}`
    : "";

  return (
    <section style={{ borderRadius: 20, border: "1px solid #dbe3ee", background: "#ffffff", padding: 18, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0369a1" }}>Premium feature merkezi</div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Add-on ve ek hak talebi</div>
          <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
            Tenant bazinda ek kapasite, ozel listeleme ve premium operasyon haklarini ticari talep akisi olarak baslatin.
          </div>
        </div>
        {allowAdminVerification ? (
          <span style={{ borderRadius: 999, background: "#ecfeff", border: "1px solid #a5f3fc", color: "#0e7490", padding: "7px 10px", fontSize: 12, fontWeight: 800 }}>
            Admin dogrulama aktif
          </span>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 12, fontWeight: 800 }}>
          Tenant
          <select
            value={selectedTenantId ?? ""}
            onChange={(event) => setSelectedTenantId(event.target.value ? Number(event.target.value) : null)}
            style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff", color: "#0f172a" }}
          >
            {tenants.length === 0 ? <option value="">Tenant secimi yok</option> : null}
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gap: 6, color: "#334155", fontSize: 12, fontWeight: 800 }}>
          Talep sahibi
          <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 12px", color: "#0f172a", fontWeight: 700 }}>
            {buyerName} <span style={{ color: "#64748b", fontWeight: 600 }}>({buyerEmail})</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
        {addonCatalog.length === 0 ? (
          <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#f8fafc", padding: 16, color: "#64748b", fontSize: 13 }}>
            Premium add-on katalogu henuz tanimli degil.
          </div>
        ) : null}
        {addonCatalog.map((addon) => (
          <article key={addon.code} style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14, display: "grid", gap: 10 }}>
            <div>
              <div style={{ color: "#0f172a", fontSize: 15, fontWeight: 900 }}>{addon.name}</div>
              {addon.description ? <div style={{ marginTop: 5, color: "#64748b", fontSize: 13, lineHeight: 1.55 }}>{addon.description}</div> : null}
            </div>
            <div style={{ color: "#0369a1", fontSize: 13, fontWeight: 900 }}>{formatPrice(addon)}</div>
            {addon.increment && addon.unit ? (
              <div style={{ color: "#475569", fontSize: 12 }}>Her alim: +{addon.increment} {addon.unit}</div>
            ) : null}
            <Link
              to={`${requestBase}${tenantQuery}&addonKey=${encodeURIComponent(addon.code)}&addon=${encodeURIComponent(addon.name)}`}
              style={{ justifySelf: "start", borderRadius: 12, border: "1px solid #0ea5e9", background: "#0284c7", color: "#fff", textDecoration: "none", padding: "9px 12px", fontSize: 12, fontWeight: 900 }}
            >
              Talep baslat
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
