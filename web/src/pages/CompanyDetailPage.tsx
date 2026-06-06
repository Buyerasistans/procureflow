import { useState, useEffect, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  updateCompany,
  getCompanies,
  uploadCompanyLogo,
  getCompanyCandidateOwners,
  setCompanyResponsible,
  reactivateUser,
  createCompanyOwner,
  type Company,
  type CandidateOwner,
} from "../services/admin.service";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdminUser } from "../auth/permissions";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { CompanyDetailSuppliersTab } from "./CompanyDetailSuppliersTab";
import "./CompanyDetailPage.css";

export default function CompanyDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  const [company, setCompany] = useState<Company | null>(null);
  const [isEditing, setIsEditing] = useState(editMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [candidateOwners, setCandidateOwners] = useState<CandidateOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | "">("");
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerNotice, setOwnerNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateResult, setReactivateResult] = useState<{ email: string; temp_password: string } | null>(null);
  const [showCreateOwnerForm, setShowCreateOwnerForm] = useState(false);
  const [newOwnerForm, setNewOwnerForm] = useState({ full_name: "", email: "", password: "Aa1234!!" });
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [createOwnerError, setCreateOwnerError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    trade_name: "",
    color: "#3b82f6",
    tax_office: "",
    tax_number: "",
    registration_number: "",
    address: "",
    city: "",
    address_district: "",
    postal_code: "",
    phone: "",
    share_on_whatsapp: true,
    is_active: true,
  });

  const cityNames = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(() => (form.city ? getDistricts(form.city) : []), [form.city]);

  const logoSrc = useMemo(() => {
    const url = company?.logo_url;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    return `${apiBase}${url}`;
  }, [company?.logo_url]);

  const mapQuery = useMemo(() => {
    return [form.address, form.address_district, form.city, form.postal_code, "Türkiye"].filter(Boolean).join(", ");
  }, [form.address, form.address_district, form.city, form.postal_code]);

  const getMapLink = () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const getMapEmbedSrc = () => `https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(mapQuery)}`;

  const shareOnWhatsapp = () => {
    const lines = [
      form.name || "-",
      `Vergi Dairesi: ${form.tax_office || "-"}`,
      `Vergi No: ${form.tax_number || "-"}`,
      `Tic. Sicil No: ${form.registration_number || "-"}`,
      `Telefon: ${form.phone || "-"}`,
      `İl / İlçe: ${[form.city, form.address_district].filter(Boolean).join(" / ") || "-"}`,
      `Posta Kodu: ${form.postal_code || "-"}`,
      `Adres: ${form.address || "-"}`,
      `Konum: ${mapQuery ? getMapLink() : "-"}`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  };

  const isDeletedOwner = (c: Company | null) => {
    if (!c) return false;
    const name = (c.owner_full_name || "").toLowerCase();
    const email = (c.owner_email || "").toLowerCase();
    return name.includes("silinen personel") || email.endsWith("@procureflow.local") || (!c.owner_full_name && !c.owner_email);
  };

  const fetchCandidates = useCallback(async (cid: number) => {
    try {
      const list = await getCompanyCandidateOwners(cid);
      setCandidateOwners(list);
    } catch {
      setCandidateOwners([]);
    }
  }, []);

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      const companies = await getCompanies();
      const found = companies.find((item) => item.id === parseInt(id || "0"));
      if (!found) {
        setError("Firma bulunamadı");
        return;
      }
      setCompany(found);
      setForm({
        name: found.name,
        trade_name: found.trade_name || "",
        color: found.color || "#3b82f6",
        tax_office: found.tax_office || "",
        tax_number: found.tax_number || "",
        registration_number: found.registration_number || "",
        address: found.address || "",
        city: found.city || "",
        address_district: found.address_district || "",
        postal_code: found.postal_code || "",
        phone: found.phone || "",
        share_on_whatsapp: found.share_on_whatsapp !== false,
        is_active: found.is_active,
      });
      setShowMap(!(found.hide_location || false));
    } catch {
      setError("Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isSuperAdminUser(user)) {
      void fetchCompany();
    }
  }, [fetchCompany, user]);

  useEffect(() => {
    if (company && isEditing) {
      void fetchCandidates(company.id);
    }
  }, [company, isEditing, fetchCandidates]);

  const handleSetOwner = async () => {
    if (!company || !selectedOwnerId) return;
    setOwnerSaving(true);
    setOwnerNotice(null);
    try {
      const result = await setCompanyResponsible(company.id, Number(selectedOwnerId));
      setOwnerNotice({ type: "success", text: `Yetkili güncellendi: ${result.owner_full_name}` });
      await fetchCompany();
      setSelectedOwnerId("");
    } catch {
      setOwnerNotice({ type: "error", text: "Yetkili güncellenemedi." });
    } finally {
      setOwnerSaving(false);
    }
  };

  const handleReactivate = async () => {
    if (!company) return;
    const ownerEmail = company.owner_email || "";
    if (!ownerEmail.endsWith("@procureflow.local")) {
      setOwnerNotice({ type: "error", text: "Yetkili zaten aktif ya da orijinal e-posta bulunamıyor." });
      return;
    }
    const userId = company.created_by_id;
    if (!userId) {
      setOwnerNotice({ type: "error", text: "Yetkili kullanıcı ID bulunamadı." });
      return;
    }
    setReactivating(true);
    setOwnerNotice(null);
    try {
      const result = await reactivateUser(userId);
      setReactivateResult(result);
      await fetchCompany();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Reaktivasyon başarısız.";
      setOwnerNotice({ type: "error", text: msg });
    } finally {
      setReactivating(false);
    }
  };

  const handleCreateOwner = async () => {
    if (!company) return;
    const { full_name, email, password } = newOwnerForm;
    if (!full_name.trim() || !email.trim() || !password.trim()) {
      setCreateOwnerError("Ad, e-posta ve şifre zorunludur.");
      return;
    }
    setCreatingOwner(true);
    setCreateOwnerError(null);
    try {
      await createCompanyOwner(company.id, { full_name: full_name.trim(), email: email.trim(), password: password.trim() });
      setShowCreateOwnerForm(false);
      setNewOwnerForm({ full_name: "", email: "", password: "Aa1234!!" });
      await fetchCompany();
      await fetchCandidates(company.id);
      setOwnerNotice({ type: "success", text: `Yetkili oluşturuldu: ${full_name.trim()} (${email.trim()})` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Yetkili oluşturulamadı.";
      setCreateOwnerError(msg);
    } finally {
      setCreatingOwner(false);
    }
  };

  const handleSave = async () => {
    try {
      const updated = await updateCompany(parseInt(id || "0"), {
        ...form,
        hide_location: !showMap,
      });
      if (logoFile) {
        const upload = await uploadCompanyLogo(updated.id, logoFile);
        updated.logo_url = upload.logo_url;
      }
      updated.hide_location = !showMap;
      setCompany(updated);
      setIsEditing(false);
      setLogoFile(null);
      setSuccess("Firma bilgileri güncellendi");
      setError(null);
    } catch {
      setError("Kaydetme hatası");
    }
  };

  if (!isSuperAdminUser(user)) {
    return <div className="cdp-denied">Erişim Reddedildi</div>;
  }

  if (loading) return <div className="cdp-loading">Yükleniyor...</div>;

  if (!company) {
    return (
      <div className="cdp-not-found">
        <button type="button" className="cdp-btn cdp-btn--secondary" onClick={() => navigate("/admin")}>Geri</button>
      </div>
    );
  }

  return (
    <div className="cdp-root">
      <div className="cdp-header">
        <h1 className="cdp-title">{company.name}</h1>
        <div className="cdp-header-actions">
          {!isEditing && (
            <button type="button" onClick={() => setIsEditing(true)} className="cdp-btn cdp-btn--primary">
              ✏️ Düzenle
            </button>
          )}
          <button type="button" onClick={() => navigate("/admin")} className="cdp-btn cdp-btn--secondary">
            Geri
          </button>
        </div>
      </div>

      {error && <div className="cdp-error-msg">{error}</div>}
      {success && <div className="cdp-success-msg">{success}</div>}

      <div className="cdp-card">
        <div className="cdp-logo-area">
          <div className="cdp-logo-box">
            {logoFile
              ? "Yeni Logo Seçildi"
              : logoSrc
                ? <img src={logoSrc} alt="Firma logosu" className="cdp-logo-img" />
                : "Logo Yok"}
          </div>
          {isEditing && (
            <div className="cdp-logo-upload">
              <label className="cdp-logo-upload-label">
                📎 Logo Ekle
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="cdp-logo-file-input" />
              </label>
              {logoFile && <div className="cdp-logo-file-name">{logoFile.name}</div>}
            </div>
          )}
        </div>

        <div className="cdp-actions-row">
          <button type="button" onClick={() => setShowMap((v) => !v)} className="cdp-btn--map">
            {showMap ? "Şirket Konumunu Gizle" : "Şirket Konumunu Göster"}
          </button>
          <button type="button" onClick={shareOnWhatsapp} className="cdp-btn--whatsapp">
            WhatsApp Paylaş
          </button>
        </div>

        {!isEditing ? (
          <div className="cdp-fields">
            {/* Satır 1: Firma Adı + Renk */}
            <div className="cdp-field-row cdp-field-row--2col">
              <div>
                <span className="cdp-field-label">Firma Adı</span>
                <div className="cdp-field-value">{company.name || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">Renk</span>
                <div className="cdp-color-display">
                  <span className="cdp-color-swatch" style={{ "--cdp-swatch-bg": company.color || "#3b82f6" } as CSSProperties} />
                  <span className="cdp-field-value">{company.color || "-"}</span>
                </div>
              </div>
            </div>
            {/* Satır 2: Firma Ünvanı (varsa) */}
            {company.trade_name && (
              <div className="cdp-field-row">
                <span className="cdp-field-label">Firma Ünvanı</span>
                <div className="cdp-field-value">{company.trade_name}</div>
              </div>
            )}
            {/* Satır 3: Vergi Dairesi + Vergi No + Telefon */}
            <div className="cdp-field-row cdp-field-row--3col">
              <div>
                <span className="cdp-field-label">Vergi Dairesi</span>
                <div className="cdp-field-value--normal">{company.tax_office || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">Vergi No</span>
                <div className="cdp-field-value--normal">{company.tax_number || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">Telefon</span>
                <div className="cdp-field-value--normal">{company.phone || "-"}</div>
              </div>
            </div>
            {/* Satır 4: Yetkili Kullanıcı + E-posta */}
            <div className="cdp-field-row cdp-field-row--2col">
              <div>
                <span className="cdp-field-label">Yetkili Kullanıcı</span>
                {isDeletedOwner(company) ? (
                  <div className="cdp-owner-warn">⚠️ Yetkili eksik veya silinmiş — lütfen yeni bir yetkili atayın</div>
                ) : (
                  <div className="cdp-field-value--normal">{company.owner_full_name || "-"}</div>
                )}
              </div>
              <div>
                <span className="cdp-field-label">E-posta</span>
                <div className="cdp-field-value--normal">
                  {isDeletedOwner(company) ? "—" : (company.owner_email || "-")}
                </div>
              </div>
            </div>
            {/* Satır 5: İl + İlçe + Posta Kodu + Durum */}
            <div className="cdp-field-row cdp-field-row--4col">
              <div>
                <span className="cdp-field-label">İl</span>
                <div className="cdp-field-value--normal">{company.city || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">İlçe</span>
                <div className="cdp-field-value--normal">{company.address_district || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">Posta Kodu</span>
                <div className="cdp-field-value--normal">{company.postal_code || "-"}</div>
              </div>
              <div>
                <span className="cdp-field-label">Durum</span>
                <div className="cdp-status-wrap">
                  <span className={company.is_active ? "cdp-status-badge cdp-status-badge--active" : "cdp-status-badge cdp-status-badge--inactive"}>
                    {company.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </div>
            </div>
            {/* Satır 6: Adres */}
            {company.address && (
              <div className="cdp-field-row cdp-field-row--last">
                <span className="cdp-field-label">Adres</span>
                <div className="cdp-field-value--normal">{company.address}</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Firma Adı + Renk */}
            <div className="cdp-form-row cdp-form-row--name-color">
              <label className="cdp-form-label">Firma Adı
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="cdp-input" />
              </label>
              <label className="cdp-form-label">Renk
                <div className="cdp-color-row">
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="cdp-color-picker" />
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="cdp-color-text" />
                </div>
              </label>
            </div>
            {/* Firma Ünvanı */}
            <div className="cdp-form-mb">
              <label className="cdp-form-label">Firma Ünvanı
                <input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} placeholder="Ticari unvan" className="cdp-input" />
              </label>
            </div>
            {/* Vergi Dairesi + Vergi No + Posta Kodu */}
            <div className="cdp-form-row cdp-form-row--3col">
              <label className="cdp-form-label">Vergi Dairesi
                <input value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} className="cdp-input" />
              </label>
              <label className="cdp-form-label">Vergi Numarası
                <input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className="cdp-input" />
              </label>
              <label className="cdp-form-label">Posta Kodu
                <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="cdp-input" />
              </label>
            </div>
            {/* Telefon + İl + İlçe */}
            <div className="cdp-form-row cdp-form-row--3col">
              <label className="cdp-form-label">Telefon
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="cdp-input" />
              </label>
              <label className="cdp-form-label">İl
                <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, address_district: "" })} className="cdp-select">
                  <option value="">İl seçin</option>
                  {cityNames.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="cdp-form-label">İlçe
                <select value={form.address_district} onChange={(e) => setForm({ ...form, address_district: e.target.value })} disabled={!form.city} className="cdp-select">
                  <option value="">İlçe seçin</option>
                  {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            {/* Adres */}
            <div className="cdp-form-mb">
              <label className="cdp-form-label">Adres
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="cdp-textarea" />
              </label>
            </div>
            {/* Aktif */}
            <label className="cdp-form-check">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Aktif
            </label>

            {/* ── Yetkili Kullanıcı bölümü ── */}
            <div className="cdp-owner-section">
              <h3 className="cdp-owner-title">Yetkili Kullanıcı</h3>

              {/* Mevcut durum */}
              {isDeletedOwner(company) ? (
                <div className="cdp-owner-warn">
                  ⚠️ Mevcut yetkili eksik veya silinmiş.
                  {company.owner_email?.endsWith("@procureflow.local") && company.created_by_id && (
                    <div className="cdp-reactivate-bar">
                      <span>Orijinal e-posta sistemde mevcut — yetkiliyi işe geri alabilirsiniz.</span>
                      <button
                        type="button"
                        className="cdp-btn cdp-btn--reactivate"
                        disabled={reactivating}
                        onClick={() => { void handleReactivate(); }}
                      >
                        {reactivating ? "İşleniyor…" : "İşe Geri Al"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="cdp-owner-current">
                  <span className="cdp-owner-av">
                    {(company.owner_full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div>
                    <b>{company.owner_full_name}</b>
                    <span>{company.owner_email}</span>
                  </div>
                </div>
              )}

              {reactivateResult && (
                <div className="cdp-reactivate-result">
                  <b>Kullanıcı reaktive edildi!</b>
                  <span>E-posta: <code>{reactivateResult.email}</code></span>
                  <span>Geçici şifre: <code>{reactivateResult.temp_password}</code></span>
                  <span className="cdp-reactivate-hint">Lütfen bu bilgileri not alın ve kullanıcıya iletin. Şifreyi paylaştıktan sonra değiştirmelerini isteyin.</span>
                </div>
              )}

              {ownerNotice && (
                <div className={`cdp-owner-notice cdp-owner-notice--${ownerNotice.type}`}>
                  {ownerNotice.text}
                </div>
              )}

              {/* Yeni yetkili seç veya oluştur */}
              {candidateOwners.length > 0 ? (
                <div className="cdp-owner-assign">
                  <label className="cdp-form-label">Mevcut kullanıcıdan yetkili seç
                    <select
                      className="cdp-select"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                      <option value="">— Kullanıcı seçin —</option>
                      {candidateOwners.map((u) => {
                        const roleLabel = u.system_role === "tenant_admin" ? "Admin" : u.system_role === "tenant_owner" ? "Hesap Sahibi" : u.system_role || "Üye";
                        return (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email} ({roleLabel}) — {u.email}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="cdp-btn cdp-btn--primary"
                    disabled={!selectedOwnerId || ownerSaving}
                    onClick={() => { void handleSetOwner(); }}
                  >
                    {ownerSaving ? "Kaydediliyor…" : "Yetkiliyi Güncelle"}
                  </button>
                </div>
              ) : !showCreateOwnerForm ? (
                <div className="cdp-owner-empty">
                  <span>Bu firmaya atanabilecek kayıtlı kullanıcı yok.</span>
                  <button
                    type="button"
                    className="cdp-btn cdp-btn--primary cdp-btn--sm"
                    onClick={() => setShowCreateOwnerForm(true)}
                  >
                    + Yetkili Ekle
                  </button>
                </div>
              ) : null}

              {/* Yeni yetkili oluştur formu */}
              {showCreateOwnerForm && (
                <div className="cdp-create-owner-form">
                  <h4 className="cdp-create-owner-title">Yeni Yetkili Kullanıcı Oluştur</h4>
                  <p className="cdp-create-owner-hint">Oluşturulan kullanıcı tenant admin yetkisiyle firmaya atanır.</p>
                  {createOwnerError && (
                    <div className="cdp-owner-notice cdp-owner-notice--error">{createOwnerError}</div>
                  )}
                  <div className="cdp-form-row cdp-form-row--3col">
                    <label className="cdp-form-label">Ad Soyad
                      <input
                        className="cdp-input"
                        placeholder="Ahmet Yılmaz"
                        value={newOwnerForm.full_name}
                        onChange={(e) => setNewOwnerForm({ ...newOwnerForm, full_name: e.target.value })}
                      />
                    </label>
                    <label className="cdp-form-label">E-posta
                      <input
                        className="cdp-input"
                        type="email"
                        placeholder="yetkili@firma.com"
                        value={newOwnerForm.email}
                        onChange={(e) => setNewOwnerForm({ ...newOwnerForm, email: e.target.value })}
                      />
                    </label>
                    <label className="cdp-form-label">Şifre
                      <input
                        className="cdp-input"
                        type="text"
                        value={newOwnerForm.password}
                        onChange={(e) => setNewOwnerForm({ ...newOwnerForm, password: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="cdp-create-owner-actions">
                    <button
                      type="button"
                      className="cdp-btn cdp-btn--primary"
                      disabled={creatingOwner}
                      onClick={() => { void handleCreateOwner(); }}
                    >
                      {creatingOwner ? "Oluşturuluyor…" : "Oluştur ve Ata"}
                    </button>
                    <button
                      type="button"
                      className="cdp-btn cdp-btn--secondary"
                      disabled={creatingOwner}
                      onClick={() => { setShowCreateOwnerForm(false); setCreateOwnerError(null); }}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="cdp-form-actions">
              <button type="button" onClick={handleSave} className="cdp-btn cdp-btn--primary">Kaydet</button>
              <button type="button" onClick={() => { setIsEditing(false); setLogoFile(null); setSuccess(null); setShowMap(!(company.hide_location || false)); setOwnerNotice(null); setReactivateResult(null); setShowCreateOwnerForm(false); setCreateOwnerError(null); }} className="cdp-btn cdp-btn--secondary">İptal</button>
            </div>
          </>
        )}

        {showMap && mapQuery && (
          <div className="cdp-map-wrap">
            <iframe title="Firma konumu" src={getMapEmbedSrc()} className="cdp-map-iframe" loading="lazy" />
          </div>
        )}

        <div className="cdp-suppliers-section">
          <h2 className="cdp-suppliers-title">Tedarikçiler</h2>
          <CompanyDetailSuppliersTab
            tenantId={company.tenant_id ?? null}
            tenantName={company.name}
            companyCreatedById={company.created_by_id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
