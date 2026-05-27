import { useState } from "react";
import type { ChannelReferralLink } from "../../services/profile.service";
import { SectionCard, SectionHeader } from "./ChannelPrimitives";
import "./ReferralLinkCenter.css";

interface ReferralLinkCenterProps {
  links: ChannelReferralLink[];
  loading: boolean;
  creating?: boolean;
  campaignOptions?: Array<{ id: number; name: string }>;
  onCreateLink?: (targetType: "mixed" | "partner" | "supplier", campaignId?: number) => void;
}

type TargetType = "mixed" | "partner" | "supplier";

export function ReferralLinkCenter({
  links,
  loading,
  creating = false,
  campaignOptions = [],
  onCreateLink,
}: ReferralLinkCenterProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<TargetType>("mixed");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  async function copyLink(url: string | null, code: string) {
    if (!url || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1200);
    } catch {
      setCopiedCode(null);
    }
  }

  function getTargetLabel(value: string) {
    const key = String(value || "mixed").toLowerCase();
    if (key === "partner") return "Stratejik Partner";
    if (key === "supplier") return "Tedarikçi";
    return "Karma";
  }

  function getCampaignLabel(campaignId: number | null) {
    if (!campaignId) return "Genel";
    const match = campaignOptions.find((item) => item.id === campaignId);
    return match?.name || `Kampanya #${campaignId}`;
  }

  const hasCampaignSelection = Boolean(onCreateLink && campaignOptions.length > 0);

  return (
    <SectionCard borderColor="#dbeafe">
      <SectionHeader
        title="Link Merkezi"
        right={
          <div className="referral-link-center__toolbar">
            <span className="referral-link-center__toolbar-stats">
              {loading ? "Yukleniyor..." : `${links.length} aktif link`}
            </span>

            {onCreateLink ? (
              <>
                <select
                  value={targetType}
                  onChange={(event) => setTargetType(event.target.value as TargetType)}
                  className="referral-link-center__select"
                  aria-label="Referral link hedef tipi"
                  title="Referral link hedef tipi"
                >
                  <option value="mixed">Karma</option>
                  <option value="partner">Stratejik Partner</option>
                  <option value="supplier">Tedarikçi</option>
                </select>

                <button
                  type="button"
                  disabled={creating}
                  onClick={() => onCreateLink(targetType)}
                  className="referral-link-center__button referral-link-center__button--general"
                >
                  {creating ? "Olusturuluyor..." : "Genel Link"}
                </button>

                <select
                  value={selectedCampaignId}
                  onChange={(event) => setSelectedCampaignId(event.target.value)}
                  className="referral-link-center__select referral-link-center__select--campaign"
                  aria-label="Kampanya seç"
                  title="Kampanya seç"
                >
                  <option value="">Kampanya sec</option>
                  {campaignOptions.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={creating || !selectedCampaignId}
                  onClick={() => onCreateLink(targetType, Number(selectedCampaignId))}
                  className="referral-link-center__button referral-link-center__button--campaign"
                >
                  {creating ? "Olusturuluyor..." : "Kampanya Linki"}
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {links.length === 0 ? (
        <p className="referral-link-center__empty">
          Henuz referral linki olusturulmamis.
        </p>
      ) : (
        <div className="referral-link-center__list">
          {links.slice(0, 6).map((link) => (
            <article key={link.link_id} className="referral-link-center__item">
              <div className="referral-link-center__item-header">
                <div className="referral-link-center__item-info">
                  <strong className="referral-link-center__code">{link.link_code}</strong>
                  <div className="referral-link-center__badges">
                    <span className="referral-link-center__badge referral-link-center__badge--target">
                      {getTargetLabel(link.target_type)}
                    </span>
                    <span className="referral-link-center__badge referral-link-center__badge--campaign">
                      {getCampaignLabel(link.campaign_id)}
                    </span>
                  </div>
                </div>

                <div className="referral-link-center__item-actions">
                  <span
                    className={`referral-link-center__status ${
                      link.is_active
                        ? "referral-link-center__status--active"
                        : "referral-link-center__status--inactive"
                    }`}
                  >
                    {link.is_active ? "Aktif" : "Pasif"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(link.short_url, link.link_code)}
                    className="referral-link-center__button referral-link-center__button--copy"
                  >
                    {copiedCode === link.link_code ? "Kopyalandi" : "Kopyala"}
                  </button>
                </div>
              </div>

              <div className="referral-link-center__tracking">
                Takip Kodu: <strong>{link.link_code}</strong>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasCampaignSelection ? null : null}
    </SectionCard>
  );
}

export default ReferralLinkCenter;
