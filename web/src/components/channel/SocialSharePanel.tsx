import React, { useState } from "react";
import type { ChannelSocialLinks } from "../../services/profile.service";
import "./SocialSharePanel.css";

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
      <p className="social-share-panel__empty">
        Sosyal paylaşım için aktif referral link bulunamadı.
      </p>
    );
  }

  return (
    <div className="social-share-panel">
      <div className="social-share-panel__summary">
        <div className="social-share-panel__summary-label">Paylaşım Metni</div>
        <div className="social-share-panel__summary-message">{data.share_message}</div>
        <div className="social-share-panel__summary-link">{data.source_short_url}</div>
      </div>

      <div className="social-share-panel__actions">
        {data.items.map((item) => (
          <a
            key={item.channel}
            href={item.share_url}
            target="_blank"
            rel="noreferrer"
            className="social-share-panel__link"
          >
            {item.label}
          </a>
        ))}

        <button
          type="button"
          onClick={copyTemplate}
          className="social-share-panel__copy-button"
        >
          {copied ? "Kopyalandı" : "Metni Kopyala"}
        </button>
      </div>
    </div>
  );
}

export default SocialSharePanel;
