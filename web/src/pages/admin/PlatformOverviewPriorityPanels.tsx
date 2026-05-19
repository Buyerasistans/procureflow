type PriorityTenant = {
  id: number;
  slug?: string | null;
  legal_name?: string | null;
  brand_name?: string | null;
  onboarding_status?: string | null;
  owner_user_id?: number | string | null;
  owner_email?: string | null;
  logo_url?: string | null;
  is_active?: boolean | null;
  status?: string | null;
  support_status?: string | null;
};

type PlatformOverviewPriorityPanelsProps = {
  platformOpsSummary: {
    highestPriorityTenants: PriorityTenant[];
  };
  platformOpsStatuses: Record<string | number, string>;
  formatPartnerOnboardingStatus: (value?: string | null) => string;
  formatPartnerLifecycleStatus: (value?: string | null) => string;
};

export function PlatformOverviewPriorityPanels({
  platformOpsSummary,
  platformOpsStatuses,
  formatPartnerOnboardingStatus,
  formatPartnerLifecycleStatus,
}: PlatformOverviewPriorityPanelsProps) {
  return (
    <>
      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Odaklari</div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner gecis panosu</div>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {[
            "Admin'i personelden ayiran system_role gecisi baslatildi.",
            "Stratejik Partner omurgasi ve bootstrap scripti eklendi.",
            "Navigation ve varsayilan yonlendirme system_role bazli calisiyor.",
            "Siradaki is: Stratejik Partner yonetici yeniden atama ve daha derin yasam dongusu aksiyonlari.",
          ].map((item) => (
            <div key={item} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#334155" }}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Operasyon Kuyrugu</div>
        <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Platform destek oncelikleri</div>
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {platformOpsSummary.highestPriorityTenants.length === 0 ? (
            <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
              Acik operasyon kuyrugu olusturan Stratejik Partner kaydi bulunmuyor.
            </div>
          ) : (
            platformOpsSummary.highestPriorityTenants.map((tenant) => {
              const tags = [
                String(tenant.onboarding_status || "").toLowerCase() !== "active" ? `Kurulum: ${formatPartnerOnboardingStatus(tenant.onboarding_status)}` : null,
                !tenant.owner_user_id || !tenant.owner_email ? "Owner eksigi" : null,
                !tenant.logo_url || !tenant.brand_name ? "Branding eksigi" : null,
                !tenant.is_active || String(tenant.status || "").toLowerCase() === "paused" ? `Durum: ${formatPartnerLifecycleStatus(tenant.status)}` : null,
                (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "in_progress" ? "Destek: Islemde" : null,
                (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "waiting_owner" ? "Destek: Owner bekleniyor" : null,
                (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "resolved" ? "Destek: Cozuldu" : null,
              ].filter(Boolean);

              return (
                <div key={`ops-${tenant.id}`} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{tenant.slug}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {tags.map((tag) => (
                      <span key={`${tenant.id}-${tag}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e2e8f0", color: "#334155", fontSize: 11, fontWeight: 700 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
