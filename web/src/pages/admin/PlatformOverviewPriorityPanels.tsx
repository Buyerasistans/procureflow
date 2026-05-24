import "./PlatformOverviewPriorityPanels.css";

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
    <div className="platform-overview-priority-panels">
      <div className="platform-overview-priority-panels__card">
        <div className="platform-overview-priority-panels__eyebrow">Platform Odaklari</div>
        <div className="platform-overview-priority-panels__title">Stratejik Partner gecis panosu</div>
        <div className="platform-overview-priority-panels__list">
          {[
            "Admin'i personelden ayiran system_role gecisi baslatildi.",
            "Stratejik Partner omurgasi ve bootstrap scripti eklendi.",
            "Navigation ve varsayilan yonlendirme system_role bazli calisiyor.",
            "Sıradaki iş: Stratejik Partner yönetici yeniden atama ve daha derin yaşam döngüsü aksiyonları.",
          ].map((item) => (
            <div key={item} className="platform-overview-priority-panels__item">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="platform-overview-priority-panels__card">
        <div className="platform-overview-priority-panels__eyebrow">Operasyon Kuyrugu</div>
        <div className="platform-overview-priority-panels__title">Platform destek oncelikleri</div>
        <div className="platform-overview-priority-panels__list">
          {platformOpsSummary.highestPriorityTenants.length === 0 ? (
            <div className="platform-overview-priority-panels__empty">
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
                <div key={`ops-${tenant.id}`} className="platform-overview-priority-panels__item">
                  <div className="platform-overview-priority-panels__item-header">
                    <div className="platform-overview-priority-panels__item-title">{tenant.brand_name || tenant.legal_name}</div>
                    <span className="platform-overview-priority-panels__item-meta">{tenant.slug}</span>
                  </div>
                  <div className="platform-overview-priority-panels__tags">
                    {tags.map((tag) => (
                      <span key={`${tenant.id}-${tag}`} className="platform-overview-priority-panels__tag">
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
    </div>
  );
}
