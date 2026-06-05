import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getCityNames, getDistricts } from "../../data/turkey-cities";
import { useProfile } from "../../hooks/useProfile";
import { useAuth } from "../../hooks/useAuth";
import { changePassword } from "../../services/profile.service";
import {
  getMySessions,
  revokeSession,
  setup2FA,
  verify2FA,
  disable2FA,
} from "../../services/profile.service";
import type { SessionInfo } from "../../services/profile.service";
import { getUserDisplayRoleLabel } from "../../auth/permissions";
import "./AdminProfileTab.css";

function parseAddressParts(addr: string | null | undefined): { city: string; district: string; detail: string } {
  if (!addr) return { city: "", district: "", detail: "" };
  const parts = addr.split(",").map((s) => s.trim());
  const cities = getCityNames();
  if (parts.length > 0 && cities.includes(parts[0])) {
    const dists = getDistricts(parts[0]);
    if (parts.length > 1 && dists.includes(parts[1])) {
      return { city: parts[0], district: parts[1], detail: parts.slice(2).join(", ").trim() };
    }
    return { city: parts[0], district: "", detail: parts.slice(1).join(", ").trim() };
  }
  return { city: "", district: "", detail: addr };
}

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Admin",
  tenant_owner: "Tenant Sahibi",
  tenant_admin: "Tenant Admin",
  tenant_member: "Tenant Üyesi",
  platform_admin: "Platform Admin",
  platform_staff: "Platform Personel",
  candidate_user: "Aday",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatSessionDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminProfileTab() {
  const { profile, loading, refreshProfile, updateProfile } = useProfile();
  const { user } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    work_email: "",
    personal_phone: "",
    company_phone: "",
    company_phone_short: "",
    address: "",
    hide_location: false,
    share_on_whatsapp: true,
    photo: "",
    login_notifications: true,
  });

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: "", new1: "", new2: "" });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Address pickers
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  // Map
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");
  const [mapOpen, setMapOpen] = useState(false);;

  const cityOptions = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(
    () => (selectedCity ? getDistricts(selectedCity) : []),
    [selectedCity]
  );

  // Sessions
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // 2FA
  const [twoFaSetupMode, setTwoFaSetupMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFaMsg, setTwoFaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) refreshProfile();
  }, [profile, refreshProfile]);

  useEffect(() => {
    if (profile) {
      const parsed = parseAddressParts(profile.address);
      setSelectedCity(parsed.city);
      setSelectedDistrict(parsed.district);
      setForm({
        full_name: profile.full_name ?? "",
        work_email: profile.work_email ?? "",
        personal_phone: profile.personal_phone ?? "",
        company_phone: profile.company_phone ?? "",
        company_phone_short: profile.company_phone_short ?? "",
        address: parsed.detail,
        hide_location: profile.hide_location ?? false,
        share_on_whatsapp: profile.share_on_whatsapp ?? true,
        photo: profile.photo ?? "",
        login_notifications: profile.login_notifications ?? true,
      });
    }
  }, [profile]);

  // Load sessions
  useEffect(() => {
    setLoadingSessions(true);
    getMySessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSaveMsg({ ok: false, text: "Fotoğraf 2 MB'dan küçük olmalı." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const fullAddress = [selectedCity, selectedDistrict, form.address].filter(Boolean).join(", ");
      await updateProfile({
        full_name: form.full_name || undefined,
        work_email: form.work_email || null,
        personal_phone: form.personal_phone || null,
        company_phone: form.company_phone || null,
        company_phone_short: form.company_phone_short || null,
        address: fullAddress || null,
        hide_location: form.hide_location,
        share_on_whatsapp: form.share_on_whatsapp,
        photo: form.photo || null,
        login_notifications: form.login_notifications,
      });
      setSaveMsg({ ok: true, text: "Profil kaydedildi." });
      setEditing(false);
    } catch (err: unknown) {
      let msg = "Kayıt başarısız.";
      if (err && typeof err === "object") {
        const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
        msg = axiosErr.response?.data?.detail ?? axiosErr.message ?? msg;
      }
      setSaveMsg({ ok: false, text: msg });
    } finally {
      setSaving(false);
    }
  }, [form, updateProfile, selectedCity, selectedDistrict]);

  const handleCancel = useCallback(() => {
    if (profile) {
      const parsed = parseAddressParts(profile.address);
      setSelectedCity(parsed.city);
      setSelectedDistrict(parsed.district);
      setForm({
        full_name: profile.full_name ?? "",
        work_email: profile.work_email ?? "",
        personal_phone: profile.personal_phone ?? "",
        company_phone: profile.company_phone ?? "",
        company_phone_short: profile.company_phone_short ?? "",
        address: parsed.detail,
        hide_location: profile.hide_location ?? false,
        share_on_whatsapp: profile.share_on_whatsapp ?? true,
        photo: profile.photo ?? "",
        login_notifications: profile.login_notifications ?? true,
      });
    }
    setEditing(false);
    setSaveMsg(null);
  }, [profile]);

  const handleToggle = useCallback(
    async (field: "hide_location" | "share_on_whatsapp" | "login_notifications", val: boolean) => {
      setForm((f) => ({ ...f, [field]: val }));
      try {
        await updateProfile({ [field]: val });
      } catch {
        setForm((f) => ({ ...f, [field]: !val }));
      }
    },
    [updateProfile]
  );

  const handlePwdSave = useCallback(async () => {
    setPwdMsg(null);
    if (!pwdForm.old || !pwdForm.new1) {
      setPwdMsg({ ok: false, text: "Tüm alanları doldurun." });
      return;
    }
    if (pwdForm.new1 !== pwdForm.new2) {
      setPwdMsg({ ok: false, text: "Yeni şifreler eşleşmiyor." });
      return;
    }
    if (pwdForm.new1.length < 8) {
      setPwdMsg({ ok: false, text: "Şifre en az 8 karakter olmalı." });
      return;
    }
    setPwdSaving(true);
    try {
      await changePassword(pwdForm.old, pwdForm.new1);
      setPwdMsg({ ok: true, text: "Şifre başarıyla değiştirildi." });
      setPwdForm({ old: "", new1: "", new2: "" });
      setPwdOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Şifre değiştirme başarısız.";
      setPwdMsg({ ok: false, text: msg });
    } finally {
      setPwdSaving(false);
    }
  }, [pwdForm]);

  const handleRevokeSession = useCallback(async (id: number) => {
    setRevokingId(id);
    try {
      await revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* ignore */ }
    finally { setRevokingId(null); }
  }, []);

  const handleRevokeAllOther = useCallback(async () => {
    if (sessions.length <= 1) return;
    setRevokingAll(true);
    try {
      const others = sessions.slice(1);
      await Promise.allSettled(others.map((s) => revokeSession(s.id)));
      setSessions((prev) => prev.slice(0, 1));
    } finally {
      setRevokingAll(false);
    }
  }, [sessions]);

  const handleSetup2FA = useCallback(async () => {
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      const result = await setup2FA();
      setQrDataUrl(result.qr_data_url);
      setTotpSecret(result.secret);
      setTwoFaSetupMode(true);
      setVerifyCode("");
    } catch {
      setTwoFaMsg({ ok: false, text: "2FA kurulumu başlatılamadı." });
    } finally {
      setTwoFaLoading(false);
    }
  }, []);

  const handleVerify2FA = useCallback(async () => {
    if (!verifyCode.trim()) return;
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      await verify2FA(verifyCode.trim());
      setTwoFaSetupMode(false);
      setQrDataUrl("");
      setTotpSecret("");
      setVerifyCode("");
      setTwoFaMsg({ ok: true, text: "2FA başarıyla etkinleştirildi." });
      await refreshProfile();
    } catch {
      setTwoFaMsg({ ok: false, text: "Geçersiz kod. Authenticator uygulamanızı kontrol edin." });
    } finally {
      setTwoFaLoading(false);
    }
  }, [verifyCode, refreshProfile]);

  const handleDisable2FA = useCallback(async () => {
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      await disable2FA();
      setTwoFaMsg({ ok: true, text: "2FA devre dışı bırakıldı." });
      await refreshProfile();
    } catch {
      setTwoFaMsg({ ok: false, text: "2FA devre dışı bırakılamadı." });
    } finally {
      setTwoFaLoading(false);
    }
  }, [refreshProfile]);

  if (loading && !profile) {
    return (
      <div className="apt-wrap">
        <div className="apt-header">
          <div className="apt-avatar-wrap">
            <div className="apt-avatar" style={{ background: "#e2e8f0" }} />
          </div>
        </div>
        <div style={{ padding: "0 32px", color: "#94a3b8", fontSize: 13 }}>Profil yükleniyor...</div>
      </div>
    );
  }

  const displayName = editing ? form.full_name : (profile?.full_name ?? "");
  const displayPhoto = editing ? form.photo : (profile?.photo ?? "");
  const roleLabel = getUserDisplayRoleLabel(user) || SYSTEM_ROLE_LABELS[profile?.system_role ?? ""] || profile?.role || "—";
  const isActive = profile?.is_active ?? true;
  const orgName = user?.organization_name ?? user?.platform_name ?? null;
  const twoFaEnabled = profile?.totp_enabled ?? false;
  const mapQuery = editing
    ? [selectedCity, selectedDistrict, form.address].filter(Boolean).join(", ")
    : (profile?.address ?? "");
  const mapSrc = (q: string, type: "satellite" | "roadmap") =>
    `https://maps.google.com/maps?output=embed&t=${type === "satellite" ? "k" : "m"}&q=${encodeURIComponent(q + ", Turkiye")}`;

  return (
    <div className="apt-wrap">
      <div className="apt-header">
        <div className="apt-avatar-wrap">
          <div className="apt-avatar">
            {displayPhoto ? (
              <img src={displayPhoto} alt={displayName} />
            ) : (
              getInitials(displayName || "?")
            )}
          </div>
          {editing && (
            <label className="apt-avatar-upload" title="Fotoğraf yükle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          )}
        </div>

        <div className="apt-header-info">
          {editing ? (
            <input
              className="apt-input"
              style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, width: "100%" }}
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Ad Soyad"
            />
          ) : (
            <h1 className="apt-header-name">{displayName}</h1>
          )}
          <div className="apt-header-badges">
            <span className="apt-badge apt-badge--role">{roleLabel}</span>
            <span className={`apt-badge ${isActive ? "apt-badge--active" : "apt-badge--inactive"}`}>
              {isActive ? "Aktif" : "Pasif"}
            </span>
          </div>
        </div>

        <div className="apt-header-actions">
          {!editing ? (
            <>
              <button className="apt-btn apt-btn--secondary" onClick={() => { setEditing(true); setSaveMsg(null); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Düzenle
              </button>
            </>
          ) : (
            <>
              <button className="apt-btn apt-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button className="apt-btn apt-btn--secondary" onClick={handleCancel} disabled={saving}>
                İptal
              </button>
            </>
          )}
        </div>
      </div>

      {saveMsg && (
        <div style={{ padding: "0 32px", marginBottom: 12 }}>
          <p className={`apt-pwd-msg ${saveMsg.ok ? "apt-pwd-msg--ok" : "apt-pwd-msg--err"}`}>
            {saveMsg.text}
          </p>
        </div>
      )}

      {/* Password change panel */}
      {pwdOpen && (
        <div style={{ padding: "0 32px", marginBottom: 16 }}>
          <div className="apt-card">
            <div className="apt-card__head">
              <h3 className="apt-card__title">
                <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Şifre Değiştir
              </h3>
              <button className="apt-btn apt-btn--sm apt-btn--secondary" onClick={() => { setPwdOpen(false); setPwdMsg(null); }}>
                Kapat
              </button>
            </div>
            <div className="apt-card__body">
              <div className="apt-pwd-form">
                <div className="apt-pwd-field">
                  <label>Mevcut Şifre</label>
                  <input className="apt-input" type="password" value={pwdForm.old}
                    onChange={(e) => setPwdForm((f) => ({ ...f, old: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="apt-pwd-field">
                  <label>Yeni Şifre</label>
                  <input className="apt-input" type="password" value={pwdForm.new1}
                    onChange={(e) => setPwdForm((f) => ({ ...f, new1: e.target.value }))} placeholder="En az 8 karakter" />
                </div>
                <div className="apt-pwd-field">
                  <label>Yeni Şifre (Tekrar)</label>
                  <input className="apt-input" type="password" value={pwdForm.new2}
                    onChange={(e) => setPwdForm((f) => ({ ...f, new2: e.target.value }))} placeholder="••••••••" />
                </div>
                {pwdMsg && (
                  <p className={`apt-pwd-msg ${pwdMsg.ok ? "apt-pwd-msg--ok" : "apt-pwd-msg--err"}`}>{pwdMsg.text}</p>
                )}
                <div className="apt-save-bar">
                  <button className="apt-btn apt-btn--primary" onClick={handlePwdSave} disabled={pwdSaving}>
                    {pwdSaving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: 2-column grid ── */}
      <div className="apt-body">

        {/* Left column */}
        <div>

          {/* İletişim Bilgileri */}
          <div className="apt-card">
            <div className="apt-card__head">
              <h3 className="apt-card__title">
                <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                İletişim Bilgileri
              </h3>
            </div>
            <div className="apt-card__body">
              <div className="apt-field">
                <span className="apt-field__label">E-posta</span>
                <span className="apt-field__value apt-field__value--email">
                  {profile?.email ? (
                    <a href={`mailto:${profile.email}`} className="apt-contact-link">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      {profile.email}
                    </a>
                  ) : "—"}
                </span>
              </div>
              <div className="apt-field">
                <span className="apt-field__label">İş E-posta</span>
                {editing ? (
                  <input className="apt-input" type="email" value={form.work_email}
                    onChange={(e) => setForm((f) => ({ ...f, work_email: e.target.value }))} placeholder="is@firma.com" />
                ) : (
                  <span className={`apt-field__value apt-field__value--email${!profile?.work_email ? " apt-field__value--muted" : ""}`}>
                    {profile?.work_email || "Belirtilmemiş"}
                  </span>
                )}
              </div>
              <div className="apt-field">
                <span className="apt-field__label">Cep Telefonu</span>
                {editing ? (
                  <input className="apt-input" type="tel" value={form.personal_phone}
                    onChange={(e) => setForm((f) => ({ ...f, personal_phone: e.target.value }))} placeholder="+90 5xx xxx xx xx" />
                ) : (
                  <span className={`apt-field__value${!profile?.personal_phone ? " apt-field__value--muted" : ""}`}>
                    {profile?.personal_phone ? (
                      <span className="apt-phone-row">
                        <a href={`tel:${profile.personal_phone}`} className="apt-contact-link">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.07 6.07l1.83-1.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {profile.personal_phone}
                        </a>
                        <a href={`https://wa.me/${profile.personal_phone.replace(/[\s\-\(\)]/g, "").replace(/^0/, "90").replace(/^\+/, "")}`}
                          target="_blank" rel="noopener noreferrer" className="apt-contact-link apt-contact-link--wa" title="WhatsApp'tan mesaj gönder">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      </span>
                    ) : "Belirtilmemiş"}
                  </span>
                )}
              </div>
              <div className="apt-field">
                <span className="apt-field__label">İş Telefonu</span>
                {editing ? (
                  <input className="apt-input" type="tel" value={form.company_phone}
                    onChange={(e) => setForm((f) => ({ ...f, company_phone: e.target.value }))} placeholder="+90 2xx xxx xx xx" />
                ) : (
                  <span className={`apt-field__value${!profile?.company_phone ? " apt-field__value--muted" : ""}`}>
                    {profile?.company_phone ? (
                      <span className="apt-phone-row">
                        <a href={`tel:${profile.company_phone}`} className="apt-contact-link">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.07 6.07l1.83-1.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {profile.company_phone}
                        </a>
                        <a href={`https://wa.me/${profile.company_phone.replace(/[\s\-\(\)]/g, "").replace(/^0/, "90").replace(/^\+/, "")}`}
                          target="_blank" rel="noopener noreferrer" className="apt-contact-link apt-contact-link--wa" title="WhatsApp'tan mesaj gönder">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                      </span>
                    ) : "Belirtilmemiş"}
                  </span>
                )}
              </div>
              <div className="apt-field">
                <span className="apt-field__label">Dahili</span>
                {editing ? (
                  <input className="apt-input" value={form.company_phone_short}
                    onChange={(e) => setForm((f) => ({ ...f, company_phone_short: e.target.value }))}
                    placeholder="1234" aria-label="Dahili telefon" />
                ) : (
                  <span className={`apt-field__value${!profile?.company_phone_short ? " apt-field__value--muted" : ""}`}>
                    {profile?.company_phone_short || "—"}
                  </span>
                )}
              </div>
              {!editing && (profile?.personal_phone || profile?.company_phone) && (
                <div className="apt-wa-share-row">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      [
                        profile?.full_name,
                        profile?.personal_phone || profile?.company_phone,
                      ].filter(Boolean).join(" — ")
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apt-wa-share-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp'ta Paylaş
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Aktif Oturumlar — YUKARI TAŞINDI */}
          <div className="apt-card">
            <div className="apt-card__head">
              <h3 className="apt-card__title">
                <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Aktif Oturumlar
              </h3>
              {sessions.length > 1 && (
                <button
                  className="apt-btn apt-btn--sm apt-btn--danger"
                  onClick={handleRevokeAllOther}
                  disabled={revokingAll}
                >
                  {revokingAll ? "..." : "Tümünü Kapat"}
                </button>
              )}
            </div>
            <div className="apt-card__body">
              {loadingSessions ? (
                <p className="apt-sessions-loading">Yükleniyor...</p>
              ) : sessions.length === 0 ? (
                <div className="apt-sessions-placeholder">
                  <span className="apt-sessions-placeholder__icon">🖥️</span>
                  <p className="apt-sessions-placeholder__text">Aktif oturum bulunamadı.</p>
                </div>
              ) : (
                <div className="apt-sessions-list">
                  {sessions.map((s, i) => (
                    <div key={s.id} className="apt-session-row">
                      <div className="apt-session-row__info">
                        <div className="apt-session-row__title">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                          Oturum #{i + 1}
                          {i === 0 && <span className="apt-session-row__current">Bu cihaz</span>}
                        </div>
                        <div className="apt-session-row__meta">
                          {s.created_at ? `Başlangıç: ${formatSessionDate(s.created_at)}` : ""}
                          {s.created_at ? " · " : ""}
                          Bitiş: {formatSessionDate(s.expires_at)}
                        </div>
                      </div>
                      {i !== 0 && (
                        <button
                          className="apt-btn apt-btn--sm apt-btn--danger"
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingId === s.id}
                        >
                          {revokingId === s.id ? "..." : "Kapat"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right column */}
        <div>

          {/* Organizasyon */}
          {orgName && (
            <div className="apt-card">
              <div className="apt-card__head">
                <h3 className="apt-card__title">
                  <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Organizasyon
                </h3>
              </div>
              <div className="apt-card__body">
                <div className="apt-field">
                  <span className="apt-field__label">Kurum</span>
                  <span className="apt-field__value">{orgName}</span>
                </div>
                {profile?.tenant_id && (
                  <div className="apt-field">
                    <span className="apt-field__label">Tenant ID</span>
                    <span className="apt-field__value" style={{ fontFamily: "monospace", fontSize: 12 }}>
                      #{profile.tenant_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rol ve İzinler */}
          <div className="apt-card">
            <div className="apt-card__head">
              <h3 className="apt-card__title">
                <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Rol ve İzinler
              </h3>
            </div>
            <div className="apt-card__body">
              <div className="apt-chips">
                {profile?.system_role && (
                  <span className="apt-chip apt-chip--sys">
                    {SYSTEM_ROLE_LABELS[profile.system_role] || profile.system_role}
                  </span>
                )}
                {profile?.role && profile.role !== profile.system_role && (
                  <span className="apt-chip apt-chip--biz">{profile.role}</span>
                )}
                {profile?.tenant_id && (
                  <span className="apt-chip apt-chip--tenant">Tenant #{profile.tenant_id}</span>
                )}
                {profile?.approval_limit != null && (
                  <span className="apt-chip apt-chip--biz">
                    Onay Limiti: {profile.approval_limit.toLocaleString("tr-TR")} ₺
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Güvenlik */}
          <div className="apt-card">
            <div className="apt-card__head">
              <h3 className="apt-card__title">
                <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Güvenlik
              </h3>
            </div>
            <div className="apt-card__body">

              {/* 2FA */}
              <div className="apt-2fa">
                <div className="apt-toggle-row" style={{ borderBottom: twoFaSetupMode ? "none" : undefined }}>
                  <div>
                    <div className="apt-toggle-label">İki Faktörlü Doğrulama</div>
                    <div className="apt-toggle-sub">
                      {twoFaEnabled ? "Aktif — authenticator uygulaması ile" : "Devre dışı"}
                    </div>
                  </div>
                  <div className="apt-2fa__actions">
                    {twoFaEnabled ? (
                      <button className="apt-btn apt-btn--sm apt-btn--danger" onClick={handleDisable2FA} disabled={twoFaLoading}>
                        Kapat
                      </button>
                    ) : (
                      <button className="apt-btn apt-btn--sm apt-btn--secondary" onClick={handleSetup2FA} disabled={twoFaLoading || twoFaSetupMode}>
                        {twoFaLoading ? "..." : "Etkinleştir"}
                      </button>
                    )}
                  </div>
                </div>

                {twoFaSetupMode && (
                  <div className="apt-2fa__setup">
                    <p className="apt-2fa__setup-hint">
                      Google Authenticator veya Authy gibi bir uygulama ile QR kodu tarayın, ardından 6 haneli kodu girin.
                    </p>
                    {qrDataUrl && <img src={qrDataUrl} alt="2FA QR Kod" className="apt-2fa__qr" />}
                    <p className="apt-2fa__secret-label">Manuel giriş kodu:</p>
                    <code className="apt-2fa__secret">{totpSecret}</code>
                    <div className="apt-2fa__verify-row">
                      <input
                        className="apt-input apt-2fa__code-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="6 haneli kod"
                      />
                      <button className="apt-btn apt-btn--primary apt-btn--sm" onClick={handleVerify2FA} disabled={twoFaLoading || verifyCode.length < 6}>
                        {twoFaLoading ? "..." : "Doğrula"}
                      </button>
                      <button className="apt-btn apt-btn--secondary apt-btn--sm" onClick={() => { setTwoFaSetupMode(false); setTwoFaMsg(null); }}>
                        İptal
                      </button>
                    </div>
                  </div>
                )}

                {twoFaMsg && (
                  <p className={`apt-pwd-msg ${twoFaMsg.ok ? "apt-pwd-msg--ok" : "apt-pwd-msg--err"}`} style={{ marginTop: 8 }}>
                    {twoFaMsg.text}
                  </p>
                )}
              </div>

              {/* Login notifications */}
              <div className="apt-toggle-row">
                <div>
                  <div className="apt-toggle-label">Giriş Bildirimleri</div>
                  <div className="apt-toggle-sub">Yeni oturum açıldığında e-posta al</div>
                </div>
                <label className="apt-switch">
                  <input type="checkbox" checked={form.login_notifications}
                    onChange={(e) => handleToggle("login_notifications", e.target.checked)} />
                  <span className="apt-switch__track" />
                </label>
              </div>

              {/* Password button — full width, primary */}
              <div style={{ marginTop: 12 }}>
                <button
                  className="apt-btn apt-btn--pwd"
                  style={{ width: "100%" }}
                  onClick={() => { setPwdOpen(true); setPwdMsg(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Şifre Değiştir
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Adres Bilgileri ── */}
      {/* ── Adres Bilgileri ── */}
      <div className="apt-address-section">
        <div className="apt-card">
          <div className="apt-card__head">
            <h3 className="apt-card__title">
              <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Adres Bilgileri
            </h3>
          </div>
          <div className="apt-card__body">
            {editing ? (
              <div className="apt-address-fields">
                <div className="apt-field">
                  <span className="apt-field__label">İl</span>
                  <select className="apt-input" value={selectedCity}
                    onChange={(e) => { setSelectedCity(e.target.value); setSelectedDistrict(""); }}
                    aria-label="İl seçiniz">
                    <option value="">İl seçiniz</option>
                    {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="apt-field">
                  <span className="apt-field__label">İlçe</span>
                  <select className="apt-input" value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedCity} aria-label="İlçe seçiniz">
                    <option value="">İlçe seçiniz</option>
                    {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="apt-field">
                  <span className="apt-field__label">Detaylı Adres</span>
                  <input className="apt-input" type="text" value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Mahalle, cadde, kapı no..."
                    aria-label="Detaylı adres" />
                </div>
              </div>
            ) : (
              <div className="apt-field">
                <span className="apt-field__label">Adres</span>
                <span className={`apt-field__value${!profile?.address ? " apt-field__value--muted" : ""}`}>
                  {profile?.address || "Belirtilmemiş"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Konum Haritası (collapsible) ── */}
      <div className="apt-address-section">
        <div className="apt-card">
          <div className="apt-card__head apt-map-head">
            <h3 className="apt-card__title">
              <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              Konum Haritası
            </h3>
            <div className="apt-map-head__actions">
              {mapOpen && !form.hide_location && (
                <div className="apt-map-type-toggle">
                  <button type="button"
                    className={`apt-btn apt-btn--sm ${mapType === "satellite" ? "apt-btn--primary" : "apt-btn--secondary"}`}
                    onClick={() => setMapType("satellite")}>
                    🛰️ Uydu
                  </button>
                  <button type="button"
                    className={`apt-btn apt-btn--sm ${mapType === "roadmap" ? "apt-btn--primary" : "apt-btn--secondary"}`}
                    onClick={() => setMapType("roadmap")}>
                    🗺️ Harita
                  </button>
                </div>
              )}
              <button type="button" className="apt-btn apt-btn--sm apt-btn--secondary apt-map-toggle-btn"
                onClick={() => setMapOpen((v) => !v)}>
                {mapOpen ? "▲ Kapat" : "▼ Aç"}
              </button>
            </div>
          </div>
          {mapOpen && (
            <>
              <div className="apt-card__body apt-map-settings">
                <div className="apt-toggle-row">
                  <div>
                    <div className="apt-toggle-label">Konumu gizle</div>
                    <div className="apt-toggle-sub">Profilinizde adres bilgisi gösterilmez</div>
                  </div>
                  <label className="apt-switch" aria-label="Konumu gizle">
                    <input type="checkbox" checked={form.hide_location}
                      onChange={(e) => handleToggle("hide_location", e.target.checked)} />
                    <span className="apt-switch__track" />
                  </label>
                </div>
              </div>
              {form.hide_location ? (
                <div className="apt-card__body apt-map-placeholder">
                  <p>Konum gizlenmiştir. Göstermek için "Konumu gizle" ayarını kapatın.</p>
                </div>
              ) : mapQuery ? (
                <div className="apt-card__body apt-card__body--flush">
                  <iframe
                    title="Konum haritası"
                    className="apt-map__iframe apt-map__iframe--full"
                    src={mapSrc(mapQuery, mapType)}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div className="apt-card__body apt-map-placeholder">
                  <p>Adres girilmemiş, harita gösterilemiyor.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Kariyer / İş Arama ── */}
      <div className="apt-address-section">
        <div className="apt-card">
          <div className="apt-card__head">
            <h3 className="apt-card__title">
              <svg className="apt-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
              Kariyer & İş Arama
            </h3>
            <span className="apt-badge" style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a", fontSize: 11 }}>Yakında</span>
          </div>
          <div className="apt-card__body">
            <div className="apt-career-gate">
              <div className="apt-career-gate__icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p className="apt-career-gate__text">
                CV oluşturma, iş ilanı bulma ve başvuru yönetimi yakında bu panelden kullanılabilecek.
                Firmanız referans olarak otomatik eklenir.
              </p>
              <button type="button" className="apt-btn apt-btn--secondary" disabled>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                İş Ara (Erişim Gerekli)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
