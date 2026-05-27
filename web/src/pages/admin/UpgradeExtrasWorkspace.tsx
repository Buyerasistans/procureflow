import { Link } from "react-router-dom";
import "./UpgradeExtrasWorkspace.css";

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
    <section className="upgrade-extras-workspace">
      <div className="upgrade-extras-workspace__hero">
        <div className="upgrade-extras-workspace__hero-header">
          <div className="upgrade-extras-workspace__hero-copy">
            <div className="upgrade-extras-workspace__eyebrow">Ayrik Calisma Ekrani</div>
            <div className="upgrade-extras-workspace__title">Yukseltme / Ekstra Ozellikler</div>
            <div className="upgrade-extras-workspace__description">
              Paket geçişi, mevcut hizmet limitleri ve tekil ek özellik alımlarını bu ekrandan yönetin.
            </div>
          </div>
          <Link to="/admin?tab=panel_home" className="upgrade-extras-workspace__back-link">
            Panele Geri Don
          </Link>
        </div>
      </div>

      <div className="upgrade-extras-workspace__content-grid">
        <div className="upgrade-extras-workspace__panel">
          <div className="upgrade-extras-workspace__panel-eyebrow">Mevcut Hizmetler</div>
          <div className="upgrade-extras-workspace__panel-title">{currentPlanLabel || "Aktif plan okunamadi"}</div>
          <div className="upgrade-extras-workspace__panel-description">
            Sectiginiz paketin aktif limitleri asagida hizmet bazinda ozetlenir. Ek paket satin almak istemezseniz soldaki ekstra haklardan adet bazli alim yapabilirsiniz.
          </div>

          <div className="upgrade-extras-workspace__service-list">
            {(purchasedServiceCards.length > 0
              ? purchasedServiceCards
              : [{ key: "default-rights", title: "Standart yönetim hakları" }]).map((card) => (
                <div key={card.key} className="upgrade-extras-workspace__service-card">
                  <div className="upgrade-extras-workspace__service-title">{card.title}</div>
                  {card.note ? <div className="upgrade-extras-workspace__service-note">{card.note}</div> : null}
                  <div className="upgrade-extras-workspace__pill-row">
                    {card.activeCount != null ? <span className="upgrade-extras-workspace__pill upgrade-extras-workspace__pill--green">Aktif: {card.activeCount}</span> : null}
                    {card.passiveCount != null ? <span className="upgrade-extras-workspace__pill upgrade-extras-workspace__pill--amber">Pasif: {card.passiveCount}</span> : null}
                    {card.usedCount != null ? <span className="upgrade-extras-workspace__pill upgrade-extras-workspace__pill--blue">Kullanilan: {card.usedCount} {card.unit || ""}</span> : null}
                    {card.limitCount != null ? <span className="upgrade-extras-workspace__pill upgrade-extras-workspace__pill--green">Limit: {card.limitCount} {card.unit || ""}</span> : null}
                    {card.remainingCount != null ? <span className="upgrade-extras-workspace__pill upgrade-extras-workspace__pill--red">Kalan: {card.remainingCount} {card.unit || ""}</span> : null}
                  </div>
                </div>
              ))}
          </div>

          <div className="upgrade-extras-workspace__addon-section">
            <div className="upgrade-extras-workspace__section-eyebrow">Ekstra Ozellikler</div>
            <div className="upgrade-extras-workspace__section-copy">
              Paket gecisi yerine ihtiyac duydugunuz kapasiteyi veya ozelligi tek tek satin alabilirsiniz. Birim fiyatlari ust paket gecisinden daha yuksek tutulur.
            </div>

            <div id="subscription-addon" className="upgrade-extras-workspace__addon-root">
              {(addonCards.length > 0
                ? addonCards
                : [
                    {
                      key: "extra-special-listing",
                      name: "Ozel Listeleme",
                      description: "Teklifleriniz daha geniş tedarikçi ağına açılır.",
                      priceLabel: "Fiyatlandirma super admin tarafinda tanimlanir",
                      incrementLabel: "Ozellik bazli aktivasyon",
                      detailLines: [
                        "Özel listeleme aktif olduğunda tekliflerinizi daha fazla tedarikçi görebilir ve ek teklif alabilirsiniz.",
                        "Firma vitrinde ozel listeleme alaninda gozukebilir.",
                      ],
                    },
                  ]).map((addon) => (
                <div
                  key={addon.key}
                  ref={(node) => setAddonCardRef(addon.key, node)}
                  className={`upgrade-extras-workspace__addon-card${selectedAddonKey === addon.key ? " upgrade-extras-workspace__addon-card--selected" : ""}`}
                >
                  <div className="upgrade-extras-workspace__addon-header">
                    <div className="upgrade-extras-workspace__addon-title">{addon.name}</div>
                    <span className="upgrade-extras-workspace__addon-badge">{addon.priceLabel}</span>
                  </div>
                  <div className="upgrade-extras-workspace__addon-description">{addon.description}</div>
                  <div className="upgrade-extras-workspace__package-actions">
                    <Link
                      to={`/demo?audience=strategic&intent=addon_purchase&addon=${encodeURIComponent(addon.name)}&addonKey=${encodeURIComponent(addon.key)}`}
                      className="upgrade-extras-workspace__addon-cta"
                    >
                      Satin Alma Talebi Olustur
                    </Link>
                  </div>
                  {addon.incrementLabel ? <div className="upgrade-extras-workspace__addon-increment">{addon.incrementLabel}</div> : null}
                  <div className="upgrade-extras-workspace__detail-list">
                    {addon.detailLines.map((line) => (
                      <div key={`${addon.key}-${line}`} className="upgrade-extras-workspace__detail-item">
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
          className={`upgrade-extras-workspace__upgrade-panel${isSubscriptionUpgradeFocused ? " upgrade-extras-workspace__panel--focused" : ""}`}
        >
          <div className="upgrade-extras-workspace__package-eyebrow">Paket Kademeleri</div>
          <div className="upgrade-extras-workspace__package-title">Yukseltebileceginiz Paketler</div>
          <div className="upgrade-extras-workspace__package-description">
            Mevcut paketiniz en ustte ozetlenir. Altinda sirayla bir ust paketler ve bu paketlere gecis aksiyonu yer alir.
          </div>

          <div className="upgrade-extras-workspace__package-list">
            {currentPackageCard ? (
              <div className="upgrade-extras-workspace__current-package">
                <div className="upgrade-extras-workspace__current-package-header">
                  <div className="upgrade-extras-workspace__current-package-name">{currentPackageCard.name}</div>
                  <span className="upgrade-extras-workspace__current-package-badge">Aktif Paket</span>
                </div>
                <div className="upgrade-extras-workspace__package-description">{currentPackageCard.description}</div>
                <div className="upgrade-extras-workspace__current-package-price">
                  {currentPackageCard.price_monthly
                    ? `${currentPackageCard.price_monthly.toLocaleString("tr-TR")} ${currentPackageCard.currency || "TRY"} / ay`
                    : "Kuruma ozel fiyatlandirma"}
                </div>
                <div className="upgrade-extras-workspace__highlight-list">
                  {currentPackageCard.highlights.map((line) => (
                    <div key={`${currentPackageCard.code}-${line}`} className="upgrade-extras-workspace__highlight-item">
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
                className={`upgrade-extras-workspace__package-card${selectedPackagePlan === plan.code ? " upgrade-extras-workspace__package-card--selected" : ""}`}
              >
                <div className="upgrade-extras-workspace__package-header">
                  <div>
                    <div className="upgrade-extras-workspace__package-name">{plan.name}</div>
                    <div className="upgrade-extras-workspace__package-meta">{plan.description}</div>
                  </div>
                  <div className="upgrade-extras-workspace__package-price">
                    {plan.price_monthly ? `${plan.price_monthly.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay` : "Kuruma ozel"}
                  </div>
                </div>

                <div className="upgrade-extras-workspace__highlight-list">
                  {plan.highlights.map((line) => (
                    <div key={`${plan.code}-${line}`} className="upgrade-extras-workspace__highlight-item">
                      {line}
                    </div>
                  ))}
                </div>

                <div className="upgrade-extras-workspace__package-actions-row">
                  <div className="upgrade-extras-workspace__package-meta">Bir ust hacim katmanina gecis icin hazir.</div>
                  <div className="upgrade-extras-workspace__package-actions">
                    <Link to="/fiyatlandirma" className="upgrade-extras-workspace__package-cta">
                      {plan.name} Paketine Yukselt
                    </Link>
                    <Link
                      to={`/demo?audience=strategic&intent=package_upgrade&plan=${encodeURIComponent(plan.name)}&planCode=${encodeURIComponent(plan.code)}`}
                      className="upgrade-extras-workspace__package-secondary-cta"
                    >
                      Yukseltme Talebi Olustur
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="upgrade-extras-workspace__footer">
            <Link to="/fiyatlandirma" className="upgrade-extras-workspace__footer-cta">
              Tum Paketleri ve Fiyatlari Ac
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
