import { Link } from "react-router-dom";

type ServiceUsageCard = {
  key: string;
  title: string;
  note?: string | null;
  activeCount?: number | null;
  passiveCount?: number | null;
  usedCount?: number | null;
  limitCount?: number | null;
  remainingCount?: number | null;
  unit?: string | null;
};

type AddonCard = {
  key: string;
  name: string;
  description: string;
  priceLabel: string;
  incrementLabel: string | null;
  detailLines: string[];
};

type PackageCard = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  isCurrent?: boolean;
  highlights: string[];
};

type UpgradeExtrasWorkspaceProps = {
  searchParams: URLSearchParams;
  currentPlanLabel: string | null;
  purchasedServiceCards: ServiceUsageCard[];
  addonCards: AddonCard[];
  setAddonCardRef: (key: string, node: HTMLDivElement | null) => void;
  setSubscriptionUpgradeSectionRef: (node: HTMLDivElement | null) => void;
  currentPackageCard: PackageCard | null;
  upgradePackageCards: PackageCard[];
  packageTierCards: PackageCard[];
  setPackagePlanRef: (code: string, node: HTMLDivElement | null) => void;
};

export function UpgradeExtrasWorkspace({
  searchParams,
  currentPlanLabel,
  purchasedServiceCards,
  addonCards,
  setAddonCardRef,
  setSubscriptionUpgradeSectionRef,
  currentPackageCard,
  upgradePackageCards,
  packageTierCards,
  setPackagePlanRef,
}: UpgradeExtrasWorkspaceProps) {
  const selectedAddonKey = searchParams.get("addonKey");
  const selectedPackagePlan = searchParams.get("packagePlan");
  const isSubscriptionUpgradeFocused = searchParams.get("focus") === "subscription-upgrade";

  const visiblePackageCards =
    upgradePackageCards.length > 0
      ? upgradePackageCards
      : packageTierCards.filter((plan) => !plan.isCurrent);

  return (
    <>
      <section
        style={{
          marginTop: 24,
          borderRadius: 20,
          border: "1px solid #dbeafe",
          background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: "#1d4ed8",
              }}
            >
              Ayrik Calisma Ekrani
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
              Yukseltme / Ekstra Ozellikler
            </div>
            <div style={{ color: "#475569", fontSize: 13 }}>
              Paket gecisi, mevcut hizmet limitleri ve tekil ek ozellik alimlarini bu ekrandan yonetin.
            </div>
          </div>
          <Link
            to="/admin?tab=panel_home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #93c5fd",
              background: "#fff",
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Panele Geri Don
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
          marginTop: 14,
          alignItems: "start",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            border: "1px solid #e5e7eb",
            background: "linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%)",
            padding: 22,
            boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.8,
              textTransform: "uppercase",
              color: "#8a5b2b",
            }}
          >
            Mevcut Hizmetler
          </div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            {currentPlanLabel || "Aktif plan okunamadi"}
          </div>
          <div style={{ marginTop: 8, color: "#64748b", maxWidth: 720 }}>
            Sectiginiz paketin aktif limitleri asagida hizmet bazinda ozetlenir. Ek paket satin almak istemezseniz soldaki ekstra haklardan adet bazli alim yapabilirsiniz.
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {(purchasedServiceCards.length > 0
              ? purchasedServiceCards
              : [{ key: "default-rights", title: "Standart yonetim haklari" }]).map((card) => (
                <div
                  key={card.key}
                  style={{
                    borderRadius: 18,
                    border: "1px solid #dbe3ee",
                    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{card.title}</div>
                  {card.note ? <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{card.note}</div> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {card.activeCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfdf5", color: "#166534", fontSize: 12, fontWeight: 800 }}>Aktif: {card.activeCount}</span> : null}
                    {card.passiveCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 800 }}>Pasif: {card.passiveCount}</span> : null}
                    {card.usedCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>Kullanilan: {card.usedCount} {card.unit || ""}</span> : null}
                    {card.limitCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfdf5", color: "#166534", fontSize: 12, fontWeight: 800 }}>Limit: {card.limitCount} {card.unit || ""}</span> : null}
                    {card.remainingCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800 }}>Kalan: {card.remainingCount} {card.unit || ""}</span> : null}
                  </div>
                </div>
              ))}
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#8a5b2b" }}>Ekstra Ozellikler</div>
            <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
              Paket gecisi yerine ihtiyac duydugunuz kapasiteyi veya ozelligi tek tek satin alabilirsiniz. Birim fiyatlari ust paket gecisinden daha yuksek tutulur.
            </div>
            <div id="subscription-addon" style={{ display: "grid", gap: 12 }}>
              {(addonCards.length > 0
                ? addonCards
                : [
                    {
                      key: "extra-special-listing",
                      name: "Ozel Listeleme",
                      description: "Teklifleriniz daha genis tedarikci agina acilir.",
                      priceLabel: "Fiyatlandirma super admin tarafinda tanimlanir",
                      incrementLabel: "Ozellik bazli aktivasyon",
                      detailLines: [
                        "Ozel listeleme aktif oldugunda tekliflerinizi daha fazla tedarikci gorebilir ve ek teklif alabilirsiniz.",
                        "Firma vitrinde ozel listeleme alaninda gozukebilir.",
                      ],
                    },
                  ]).map((addon) => (
                <div
                  key={addon.key}
                  ref={(node) => setAddonCardRef(addon.key, node)}
                  style={{
                    borderRadius: 18,
                    border: selectedAddonKey === addon.key ? "1px solid #f59e0b" : "1px solid #dbe3ee",
                    boxShadow: selectedAddonKey === addon.key ? "0 0 0 4px rgba(245, 158, 11, 0.16)" : undefined,
                    background: "linear-gradient(180deg, #fffaf0 0%, #ffffff 100%)",
                    padding: 16,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{addon.name}</div>
                    <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontSize: 12, fontWeight: 800 }}>
                      {addon.priceLabel}
                    </span>
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{addon.description}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      to={`/demo?audience=strategic&intent=addon_purchase&addon=${encodeURIComponent(addon.name)}&addonKey=${encodeURIComponent(addon.key)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1px solid #fed7aa",
                        background: "#fff",
                        color: "#9a3412",
                        textDecoration: "none",
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      Satin Alma Talebi Olustur
                    </Link>
                  </div>
                  {addon.incrementLabel ? <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>{addon.incrementLabel}</div> : null}
                  <div style={{ display: "grid", gap: 6 }}>
                    {addon.detailLines.map((line) => (
                      <div
                        key={`${addon.key}-${line}`}
                        style={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          padding: "8px 10px",
                          color: "#334155",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          id="subscription-upgrade"
          ref={setSubscriptionUpgradeSectionRef}
          style={{
            borderRadius: 24,
            border: isSubscriptionUpgradeFocused ? "1px solid #60a5fa" : "1px solid #e5e7eb",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            padding: 22,
            boxShadow: isSubscriptionUpgradeFocused
              ? "0 0 0 4px rgba(96, 165, 250, 0.18), 0 16px 36px rgba(15, 23, 42, 0.06)"
              : "0 16px 36px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Paket Kademeleri</div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Yukseltebileceginiz Paketler</div>
          <div style={{ marginTop: 8, color: "#64748b" }}>
            Mevcut paketiniz en ustte ozetlenir. Altinda sirayla bir ust paketler ve bu paketlere gecis aksiyonu yer alir.
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {currentPackageCard ? (
              <div style={{ borderRadius: 18, padding: 16, background: "#eff6ff", border: "1px solid #93c5fd", display: "grid", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 22 }}>{currentPackageCard.name}</div>
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800 }}>Aktif Paket</span>
                </div>
                <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{currentPackageCard.description}</div>
                <div style={{ color: "#0f766e", fontWeight: 800, fontSize: 13 }}>
                  {currentPackageCard.price_monthly
                    ? `${currentPackageCard.price_monthly.toLocaleString("tr-TR")} ${currentPackageCard.currency || "TRY"} / ay`
                    : "Kuruma ozel fiyatlandirma"}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {currentPackageCard.highlights.map((line) => (
                    <div
                      key={`${currentPackageCard.code}-${line}`}
                      style={{
                        borderRadius: 12,
                        padding: "8px 10px",
                        background: "#ffffff",
                        border: "1px solid #bfdbfe",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#334155",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {visiblePackageCards.map((plan) => (
              <div
                key={plan.code}
                ref={(node) => setPackagePlanRef(plan.code, node)}
                style={{
                  borderRadius: 16,
                  padding: 14,
                  background: "#f8fafc",
                  border: selectedPackagePlan === plan.code ? "1px solid #60a5fa" : "1px solid #e2e8f0",
                  boxShadow: selectedPackagePlan === plan.code ? "0 0 0 4px rgba(96, 165, 250, 0.16)" : undefined,
                  color: "#334155",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{plan.name}</div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{plan.description}</div>
                  </div>
                  <div style={{ color: "#0f766e", fontWeight: 800, fontSize: 12 }}>
                    {plan.price_monthly ? `${plan.price_monthly.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay` : "Kuruma ozel"}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {plan.highlights.map((line) => (
                    <div
                      key={`${plan.code}-${line}`}
                      style={{
                        borderRadius: 12,
                        padding: "8px 10px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#334155",
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Bir ust hacim katmanina gecis icin hazir.</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      to="/fiyatlandirma"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                        color: "#fff",
                        textDecoration: "none",
                        fontWeight: 800,
                      }}
                    >
                      {plan.name} Paketine Yukselt
                    </Link>
                    <Link
                      to={`/demo?audience=strategic&intent=package_upgrade&plan=${encodeURIComponent(plan.name)}&planCode=${encodeURIComponent(plan.code)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        textDecoration: "none",
                        fontWeight: 800,
                      }}
                    >
                      Yukseltme Talebi Olustur
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Link
              to="/fiyatlandirma"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "11px 16px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 800,
                boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)",
              }}
            >
              Tum Paketleri ve Fiyatlari Ac
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
