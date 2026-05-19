import { useMemo, useState } from "react";
import PublicBrandLogo from "../../components/PublicBrandLogo";
import { getScopeLabel, getUserScopeType, isSuperAdminUser, isTenantAdminUser } from "../../auth/permissions";
import { BRAND_COLORS } from "../../components/nav-brand-colors";
import type { AuthUser } from "../../context/auth-types";
import type { CatalogRequest } from "../../services/admin.service";

type QuickLink = {
  label: string;
  href: string;
  description: string;
};

type Props = {
  user: AuthUser | null;
  currentUserRoleLabel: string;
  title: string;
  description: string;
  platformMetrics?: {
    partnerCompanies: number;
    partnerActiveCompanies: number;
    partnerPassiveCompanies: number;
    partnerPersonnel: number;
    partnerProjects: number;
    partnerQuotes: number;
    supplierCompanies: number;
    supplierActiveCompanies: number;
    supplierPassiveCompanies: number;
    supplierRespondedQuotes: number;
    supplierRevisedQuotes: number;
    channelCompanies: number;
    channelActiveCompanies: number;
    channelPassiveCompanies: number;
    channelPersonnel: number;
    channelProjects: number;
    channelQuotes: number;
  };
  topNotice?: string | null;
  headerInfo?: string | null;
  footerInfo?: string | null;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  footerBgColor?: string | null;
  footerTextColor?: string | null;
  heroTextColor?: string | null;
  heroMutedTextColor?: string | null;
  accentColor?: string | null;
  secondaryAccentColor?: string | null;
  accentOpacity?: number | null;
  secondaryAccentOpacity?: number | null;
  primaryAccentStop?: number | null;
  secondaryAccentStart?: number | null;
  glowIntensity?: number | null;
  quickLinks: QuickLink[];
  requests: CatalogRequest[];
  requestBusyId: number | null;
  onCreateRoleRequest: (payload: { name: string; description?: string }) => Promise<void>;
  onCreateDepartmentRequest: (payload: { name: string; description?: string }) => Promise<void>;
  onReviewRequest: (requestId: number, decision: "approved" | "rejected") => Promise<void>;
  hideBottomSections?: boolean;
  hideTopSummarySection?: boolean;
};

export function ScopeWorkspaceHome({
  user,
  currentUserRoleLabel,
  title,
  description,
  platformMetrics,
  topNotice,
  headerInfo,
  footerInfo,
  headerBgColor,
  headerTextColor,
  footerBgColor,
  footerTextColor,
  heroTextColor,
  heroMutedTextColor,
  accentColor,
  secondaryAccentColor,
  accentOpacity,
  secondaryAccentOpacity,
  primaryAccentStop,
  secondaryAccentStart,
  glowIntensity,
  quickLinks,
  requests,
  requestBusyId,
  onCreateRoleRequest,
  onCreateDepartmentRequest,
  onReviewRequest,
  hideBottomSections = false,
  hideTopSummarySection = false,
}: Props) {
  const scope = getUserScopeType(user);
  type BrandPaletteKey = keyof typeof BRAND_COLORS;
  const paletteKey: BrandPaletteKey = scope === "platform"
    ? "platform"
    : scope === "supplier"
      ? "supplier"
      : scope === "channel"
        ? "channel"
        : "strategic";
  const palette = BRAND_COLORS[paletteKey] as {
    bg: string;
    text: string;
    accent?: string;
    accentHover?: string;
    ctaBg?: string;
    ctaText?: string;
  };
  const normalizedAccentOpacity = normalizeRange(accentOpacity, 0.2, 1, 0.85);
  const normalizedSecondaryOpacity = normalizeRange(secondaryAccentOpacity, 0.2, 1, 0.7);
  const normalizedPrimaryStop = normalizeRange(primaryAccentStop, 20, 80, 48);
  const normalizedSecondaryStart = normalizeRange(secondaryAccentStart, 40, 100, 72);
  const normalizedGlow = normalizeRange(glowIntensity, 0, 1, 0.45);
  const hasCustomPrimary = !!accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor);
  const effectivePrimary = hasCustomPrimary ? String(accentColor) : palette.bg;
  const hasSecondary = !!(secondaryAccentColor && /^#[0-9A-Fa-f]{6}$/.test(secondaryAccentColor));
  const effectiveSecondary = hasSecondary
    ? String(secondaryAccentColor)
    : (hasCustomPrimary ? String(accentColor) : (palette.accentHover ?? palette.accent ?? palette.bg));
    const heroBackground = hasSecondary
      ? `linear-gradient(95deg, ${hexToRgba(effectivePrimary, normalizedAccentOpacity)} 0%, ${hexToRgba(effectivePrimary, normalizedAccentOpacity)} ${normalizedPrimaryStop}%, ${hexToRgba(effectiveSecondary, normalizedSecondaryOpacity)} ${normalizedSecondaryStart}%, ${hexToRgba(effectiveSecondary, Math.max(0.22, normalizedSecondaryOpacity - 0.2))} 100%)`
      : `linear-gradient(95deg, ${hexToRgba(effectivePrimary, normalizedAccentOpacity)} 0%, ${hexToRgba(effectivePrimary, Math.max(0.25, normalizedAccentOpacity - 0.18))} 100%)`;
    const heroGlow = `0 0 ${Math.round(22 + normalizedGlow * 20)}px ${hexToRgba(effectivePrimary, 0.16 + normalizedGlow * 0.32)}`;
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");
  const canReview = isSuperAdminUser(user) || scope === "platform";
  const canRequest = isTenantAdminUser(user) || scope === "channel" || scope === "partner";

  const requestSummary = useMemo(() => ({
    pending: requests.filter((item) => item.review_status === "pending_review").length,
    approved: requests.filter((item) => item.review_status === "approved").length,
    rejected: requests.filter((item) => item.review_status === "rejected").length,
  }), [requests]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <section style={{ borderRadius: 28, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "white", boxShadow: "0 20px 48px rgba(15, 23, 42, 0.08)" }}>
        {(topNotice || headerInfo || headerBgColor || headerTextColor) ? (
          <div
            style={{
              padding: "8px 14px",
              background: headerBgColor || "#0f172acc",
              color: headerTextColor || "#f8fafc",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>{topNotice || "Ust bilgi alani"}</span>
            <span>{headerInfo || "Header bilgi alani"}</span>
          </div>
        ) : null}
        <div
          style={{
            padding: "20px 24px",
            color: heroTextColor || palette.text,
            background: heroBackground,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            boxShadow: heroGlow,
          }}
        >
          {/* SOL: Logo */}
          <div style={{ width: 120, height: 56, borderRadius: 14, border: "1px solid rgba(255,255,255,0.22)", background: "rgba(7,18,30,0.22)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <PublicBrandLogo height={26} maxWidth={90} invert />
          </div>

          {/* ORTA: Scope etiketi + Başlık + Rol */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", opacity: 0.88, marginBottom: 6, color: heroMutedTextColor || undefined }}>
              {getScopeLabel(scope)} Yönetim Alanı
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, color: heroTextColor || undefined }}>{title.split(" • ")[0]}</div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: heroMutedTextColor || undefined }}>{currentUserRoleLabel}</div>
            {description ? (
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: heroMutedTextColor || undefined }}>
                {description}
              </div>
            ) : null}
          </div>

          {/* SAĞ: Kullanıcı bilgisi */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, marginBottom: 4, color: heroMutedTextColor || undefined }}>Hoş geldiniz</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: heroTextColor || undefined }}>{user?.full_name || user?.email || "-"}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4, color: heroMutedTextColor || undefined }}>{user?.email || ""}</div>
          </div>
        </div>

        {!hideTopSummarySection && <div style={{ padding: 20, display: "grid", gap: 16 }}>
          {scope === "platform" && platformMetrics ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#1e3a8a" }}>Platform Yonetim Alani</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {[
                  {
                    label: "Stratejik Partner",
                    color: "#2563eb",
                    bg: "#eff6ff",
                    note: `${platformMetrics.partnerActiveCompanies} aktif · ${platformMetrics.partnerPassiveCompanies} pasif`,
                    items: [
                      { key: "Firma", value: platformMetrics.partnerCompanies },
                      { key: "Personel", value: platformMetrics.partnerPersonnel },
                      { key: "Proje", value: platformMetrics.partnerProjects },
                      { key: "Teklif", value: platformMetrics.partnerQuotes },
                    ],
                  },
                  {
                    label: "Tedarikçi",
                    color: "#dc2626",
                    bg: "#fef2f2",
                    note: `${platformMetrics.supplierActiveCompanies} aktif · ${platformMetrics.supplierPassiveCompanies} pasif`,
                    items: [
                      { key: "Firma", value: platformMetrics.supplierCompanies },
                      { key: "Yanıtlanan Teklif", value: platformMetrics.supplierRespondedQuotes },
                      { key: "Revize Teklif", value: platformMetrics.supplierRevisedQuotes },
                    ],
                  },
                  {
                    label: "İş Ortağı",
                    color: "#0f766e",
                    bg: "#f0fdfa",
                    note: `${platformMetrics.channelActiveCompanies} aktif · ${platformMetrics.channelPassiveCompanies} pasif`,
                    items: [
                      { key: "Firma", value: platformMetrics.channelCompanies },
                      { key: "Personel", value: platformMetrics.channelPersonnel },
                      { key: "Proje", value: platformMetrics.channelProjects },
                      { key: "Teklif", value: platformMetrics.channelQuotes },
                    ],
                  },
                ].map((group) => (
                  <div key={group.label} style={{ borderRadius: 18, border: `1px solid ${group.color}33`, background: group.bg, padding: 14, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: group.color }}>{group.label}</div>
                    <div style={{ fontSize: 11, color: group.color, opacity: 0.72, fontWeight: 700, marginTop: -4 }}>{group.note}</div>
                    {group.items.map((entry) => (
                      <div key={`${group.label}-${entry.key}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>{entry.key}</span>
                        <span style={{ fontSize: 18, color: group.color, fontWeight: 900 }}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Bekleyen Talep", value: requestSummary.pending, color: "#b45309" },
              { label: "Onaylanan", value: requestSummary.approved, color: "#15803d" },
              { label: "Reddedilen", value: requestSummary.rejected, color: "#b91c1c" },
              { label: "Hizli Link", value: quickLinks.length, color: palette.bg },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: item.color }}>{item.value}</div>
              </div>
            ))}
            </div>
          </div>}
        {(footerInfo || footerBgColor || footerTextColor) ? (
          <div
            style={{
              padding: "8px 14px",
              background: footerBgColor || "#0f172a99",
              color: footerTextColor || "#e2e8f0",
              fontSize: 12,
              fontWeight: 700,
              borderTop: "1px solid rgba(148, 163, 184, 0.25)",
            }}
          >
            {footerInfo || "Footer bilgi alani"}
          </div>
        ) : null}
      </section>

      {!hideBottomSections && <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
        <div style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "white", padding: 20, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#475569" }}>Rol / Departman Onay Masasi</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Scope ayrışmalı katalog yönetimi</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13, lineHeight: 1.7 }}>
              Tenant ekipleri yeni rol ve departman ihtiyacını talep olarak açar. Platform tarafı talepleri merkezi kuyrukta inceler, onaylanan kayıt gerçek katalog varlığına dönüşür.
            </div>
          </div>

          {canRequest ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!roleName.trim()) return;
                  void onCreateRoleRequest({ name: roleName.trim(), description: roleDescription.trim() || undefined }).then(() => {
                    setRoleName("");
                    setRoleDescription("");
                  });
                }}
                style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}
              >
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Yeni rol talebi</div>
                <input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Ornek: Partner Teknik Lider" style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1" }} />
                <textarea value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="Bu rol hangi ihtiyacı çözüyor?" rows={3} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", resize: "vertical" }} />
                <button type="submit" style={{ padding: "10px 12px", borderRadius: 12, border: "none", background: palette.bg, color: palette.text, fontWeight: 800, cursor: "pointer" }}>Rol talebini gönder</button>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!departmentName.trim()) return;
                  void onCreateDepartmentRequest({ name: departmentName.trim(), description: departmentDescription.trim() || undefined }).then(() => {
                    setDepartmentName("");
                    setDepartmentDescription("");
                  });
                }}
                style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}
              >
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Yeni departman talebi</div>
                <input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Ornek: Kanal Performans ve Hakediş" style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1" }} />
                <textarea value={departmentDescription} onChange={(event) => setDepartmentDescription(event.target.value)} placeholder="Bu departman hangi iş hattını ayırıyor?" rows={3} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", resize: "vertical" }} />
                <button type="submit" style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: "white", color: "#0f172a", fontWeight: 800, cursor: "pointer" }}>Departman talebini gönder</button>
              </form>
            </div>
          ) : (
            <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: "14px 16px", color: "#334155", fontSize: 13 }}>
              Bu profil için katalog talebi açma alanı kapalı. Yine de scope bazlı istek kuyruğunu izleyebilir ve sonuçlarını takip edebilirsiniz.
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {requests.length === 0 ? (
              <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#f8fafc", padding: "14px 16px", color: "#64748b" }}>Gosterilecek katalog talebi yok.</div>
            ) : requests.map((item) => (
              <div key={item.id} style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "white", padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>{item.proposed_name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{item.entity_type === "role" ? "Rol talebi" : "Departman talebi"} • {item.requested_by_name || item.requested_by_email || `Kullanici #${item.requested_by_user_id}`}</div>
                  </div>
                  <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: item.review_status === "approved" ? "#dcfce7" : item.review_status === "rejected" ? "#fee2e2" : "#fffbeb", color: item.review_status === "approved" ? "#166534" : item.review_status === "rejected" ? "#b91c1c" : "#92400e", fontWeight: 800, fontSize: 12 }}>
                    {item.review_status === "approved" ? "Onaylandi" : item.review_status === "rejected" ? "Reddedildi" : "Inceleniyor"}
                  </span>
                </div>
                {item.proposed_description ? <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{item.proposed_description}</div> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
                  <span>Olusturma: {new Date(item.created_at).toLocaleString("tr-TR")}</span>
                  {item.reviewed_at ? <span>Karar: {new Date(item.reviewed_at).toLocaleString("tr-TR")}</span> : null}
                  {item.reviewed_by_name ? <span>Reviewer: {item.reviewed_by_name}</span> : null}
                </div>
                {item.decision_note ? <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 10px", color: "#334155", fontSize: 12 }}>{item.decision_note}</div> : null}
                {canReview && item.review_status === "pending_review" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" disabled={requestBusyId === item.id} onClick={() => void onReviewRequest(item.id, "approved")} style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "#166534", color: "white", fontWeight: 800, cursor: "pointer", opacity: requestBusyId === item.id ? 0.7 : 1 }}>Onayla</button>
                    <button type="button" disabled={requestBusyId === item.id} onClick={() => void onReviewRequest(item.id, "rejected")} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 800, cursor: "pointer", opacity: requestBusyId === item.id ? 0.7 : 1 }}>Reddet</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "white", padding: 20, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#475569" }}>Bu scope icin operasyon ilkeleri</div>
          {[
            `${getScopeLabel(scope)} girisi kendi renk ve tonuyla ayriliyor; bu sayede yanlis kabuga dusme riski azalir.`,
            "Super admin tum scope'lari gorebilir fakat review ve izleme katmani scope sinyalini korur.",
            "Aktif / pasif yasam dongusu yeni katalog taleplerinde de korunur; onaylanmayan kayit canli listeye dusmez.",
            "Scope ana sayfasi agir tek ekran yerine hizli kartlar ve acilir islem bloklariyla tasinacak sekilde kurgulandi.",
          ].map((item) => (
            <div key={item} style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "12px 14px", color: "#334155", fontSize: 13, lineHeight: 1.7 }}>{item}</div>
          ))}
        </div>
      </section>}

      {!hideBottomSections && <section style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "white", padding: 20, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#475569" }}>Hizli Linkler</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {quickLinks.map((item) => (
            <a key={item.href} href={item.href} style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "white", padding: 16, textDecoration: "none", color: "#0f172a", display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{item.description}</div>
              <div style={{ color: palette.bg, fontSize: 12, fontWeight: 800 }}>Ac →</div>
            </a>
          ))}
        </div>
      </section>}
    </section>
  );
}

function normalizeRange(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return `rgba(15, 23, 42, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
