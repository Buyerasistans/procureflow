import { useEffect, useState } from "react";

export default function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const isImpersonation = sessionStorage.getItem("pf_is_impersonation") === "1";
    if (isImpersonation) {
      setName(sessionStorage.getItem("pf_impersonated_name") || "Personel");
    }
  }, []);

  if (!name) return null;

  return (
    <div style={{
      background: "#7c3aed",
      color: "#fff",
      padding: "8px 20px",
      fontSize: "0.8rem",
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: 12,
      position: "sticky",
      top: 0,
      zIndex: 9999,
    }}>
      <span>👁 Super Admin Görünüm Modu — {name} olarak görüntülüyorsunuz</span>
      <button
        type="button"
        onClick={() => window.close()}
        style={{
          marginLeft: "auto",
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "#fff",
          padding: "4px 12px",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: "0.75rem",
        }}
      >
        Sekmeyi Kapat
      </button>
    </div>
  );
}
