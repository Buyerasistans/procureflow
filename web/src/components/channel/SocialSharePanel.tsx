import React, { useState } from "react";
import type { ChannelSocialLinks } from "../../services/profile.service";

interface SocialSharePanelProps {
  data: ChannelSocialLinks | null;
}

export function SocialSharePanel({ data }: SocialSharePanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    if (!data?.source_short_url) return;
    const text = `${data.share_message}\n\n${data.source_short_url}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      setCopied(false);
    }
  }

  if (!data || !data.source_short_url) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
        Sosyal paylaşım için aktif referral link bulunamadı.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          border: "1px dashed #cbd5e1",
          borderRadius: 8,
          padding: 10,
          backgroundColor: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Paylaşım Metni</div>
        <div style={{ fontSize: 13, color: "#334155", marginBottom: 6 }}>{data.share_message}</div>
        <div style={{ fontSize: 12, color: "#0f766e", wordBreak: "break-all" }}>{data.source_short_url}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {data.items.map((item) => (
          <a
            key={item.channel}
            href={item.share_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              textDecoration: "none",
              backgroundColor: "#fff",
            }}
          >
            {item.label}
          </a>
        ))}

        <button
          type="button"
          onClick={copyTemplate}
          style={{
            border: "1px solid #a7f3d0",
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 700,
            color: "#065f46",
            backgroundColor: "#ecfdf5",
            cursor: "pointer",
          }}
        >
          {copied ? "Kopyalandı" : "Metni Kopyala"}
        </button>
      </div>
    </div>
  );
}

export default SocialSharePanel;
