import React, { useState } from "react";
import type { ChannelReferralLink } from "../../services/profile.service";
import { SectionCard, SectionHeader } from "./ChannelPrimitives";

interface ReferralLinkCenterProps {
  links: ChannelReferralLink[];
  loading: boolean;
  creating?: boolean;
  campaignOptions?: Array<{ id: number; name: string }>;
  onCreateLink?: (targetType: "mixed" | "partner" | "supplier", campaignId?: number) => void;
}

export function ReferralLinkCenter({
  links,
  loading,
  creating = false,
  campaignOptions = [],
  onCreateLink,
}: ReferralLinkCenterProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"mixed" | "partner" | "supplier">("mixed");
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

  function getTargetLabel(targetType: string) {
    const key = String(targetType || "mixed").toLowerCase();
    if (key === "partner") return "Stratejik Partner";
    if (key === "supplier") return "Tedarikci";
    return "Karma";
  }

  function getCampaignLabel(campaignId: number | null) {
    if (!campaignId) return "Genel";
    const match = campaignOptions.find((item) => item.id === campaignId);
    return match?.name || `Kampanya #${campaignId}`;
  }

  return (
    <SectionCard borderColor="#dbeafe">
      <SectionHeader
        title="Link Merkezi"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              {loading ? "Yukleniyor..." : `${links.length} aktif link`}
            </span>
            {onCreateLink ? (
              <>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as "mixed" | "partner" | "supplier")}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "#334155",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="mixed">Karma</option>
                  <option value="partner">Stratejik Partner</option>
                  <option value="supplier">Tedarikci</option>
                </select>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => onCreateLink(targetType)}
                  style={{
                    border: "1px solid #93c5fd",
                    borderRadius: 8,
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 10px",
                    cursor: creating ? "not-allowed" : "pointer",
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? "Olusturuluyor..." : "Genel Link"}
                </button>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "#334155",
                    backgroundColor: "#fff",
                    minWidth: 120,
                  }}
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
                  style={{
                    border: "1px solid #86efac",
                    borderRadius: 8,
                    backgroundColor: creating || !selectedCampaignId ? "#f1f5f9" : "#f0fdf4",
                    color: "#166534",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "5px 10px",
                    cursor: creating || !selectedCampaignId ? "not-allowed" : "pointer",
                    opacity: creating || !selectedCampaignId ? 0.7 : 1,
                  }}
                >
                  {creating ? "Olusturuluyor..." : "Kampanya Linki"}
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {links.length === 0 ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
          Henuz referral linki olusturulmamis.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {links.slice(0, 6).map((link) => (
            <div
              key={link.link_id}
              style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, backgroundColor: "#f8fafc" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <strong>{link.link_code}</strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#1d4ed8", background: "#dbeafe", borderRadius: 999, padding: "2px 6px" }}>
                      {getTargetLabel(link.target_type)}
                    </span>
                    <span style={{ fontSize: 11, color: "#065f46", background: "#d1fae5", borderRadius: 999, padding: "2px 6px" }}>
                      {getCampaignLabel(link.campaign_id)}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: link.is_active ? "#166534" : "#9f1239" }}>
                    {link.is_active ? "Aktif" : "Pasif"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(link.short_url, link.link_code)}
                    style={{
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 7px",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCode === link.link_code ? "Kopyalandi" : "Kopyala"}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 6 }}>
                Takip Kodu: <strong>{link.link_code}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default ReferralLinkCenter;
