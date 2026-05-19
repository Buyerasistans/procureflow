import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { updateCompany, getCompanies, uploadCompanyLogo, type Company } from "../services/admin.service";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdminUser } from "../auth/permissions";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { CompanyDetailSuppliersTab } from "./CompanyDetailSuppliersTab";

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
    return <div style={{ padding: 20, color: "red" }}>Erişim Reddedildi</div>;
  }

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  if (!company) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={() => navigate("/admin")}>Geri</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(24px, 3vw, 42px)",
            lineHeight: 1.05,
            fontWeight: 800,
            maxWidth: "100%",
            wordBreak: "break-word",
          }}
        >
          {company.name}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} style={{ padding: "8px 14px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              ✏️ Düzenle
            </button>
          )}
          <button onClick={() => navigate("/admin")} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Geri
          </button>
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b", marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ padding: 12, borderRadius: 8, background: "#d1fae5", color: "#065f46", marginBottom: 12 }}>{success}</div>}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20 }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 132, height: 132, borderRadius: 20, border: "1px solid #dbe3ee", background: "#f8fafc", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
            {logoFile ? "Yeni Logo Seçildi" : logoSrc ? <img src={logoSrc} alt="Firma logosu" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} /> : "Logo Yok"}
          </div>
          {isEditing && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 18px", borderRadius: 8, border: "2px dashed #93c5fd", cursor: "pointer", color: "#2563eb", fontWeight: 600, fontSize: 13, background: "#eff6ff" }}>
                📎 Logo Ekle
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
              </label>
              {logoFile && <div style={{ color: "#475569", fontSize: 12 }}>{logoFile.name}</div>}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button type="button" onClick={() => setShowMap((v) => !v)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 10px", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#334155" }}>
            {showMap ? "Şirket Konumunu Gizle" : "Şirket Konumunu Göster"}
          </button>
          <button type="button" onClick={shareOnWhatsapp} style={{ border: "1px solid #86efac", borderRadius: 8, padding: "7px 10px", background: "#fff", color: "#166534", cursor: "pointer", fontWeight: 600 }}>
            WhatsApp Paylaş
          </button>
        </div>

        {!isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Satır 1: Firma Adı + Renk */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Firma Adı</span><div style={{ fontWeight: 600, marginTop: 2 }}>{company.name || "-"}</div></div>
              <div>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Renk</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 6, background: company.color || "#3b82f6", border: "1px solid #e2e8f0", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{company.color || "-"}</span>
                </div>
              </div>
            </div>
            {/* Satır 2: Firma Ünvanı (varsa, tam genişlik) */}
            {company.trade_name && (
              <div style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Firma Ünvanı</span>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{company.trade_name}</div>
              </div>
            )}
            {/* Satır 3: Vergi Dairesi + Vergi No + Telefon */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vergi Dairesi</span><div style={{ marginTop: 2 }}>{company.tax_office || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vergi No</span><div style={{ marginTop: 2 }}>{company.tax_number || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Telefon</span><div style={{ marginTop: 2 }}>{company.phone || "-"}</div></div>
            </div>
            {/* Satır 4: Yetkili Kullanici + E-posta */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Yetkili Kullanici</span><div style={{ marginTop: 2 }}>{company.owner_full_name || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>E-posta</span><div style={{ marginTop: 2 }}>{company.owner_email || "-"}</div></div>
            </div>
            {/* Satır 5: İl + İlçe + Posta Kodu + Durum */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>İl</span><div style={{ marginTop: 2 }}>{company.city || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>İlçe</span><div style={{ marginTop: 2 }}>{company.address_district || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Posta Kodu</span><div style={{ marginTop: 2 }}>{company.postal_code || "-"}</div></div>
              <div><span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Durum</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: company.is_active ? "#d1fae5" : "#f1f5f9", color: company.is_active ? "#065f46" : "#64748b" }}>
                    {company.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </div>
            </div>
            {/* Satır 6: Adres (tam genişlik) */}
            {company.address && (
              <div style={{ padding: "10px 0" }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Adres</span>
                <div style={{ marginTop: 2 }}>{company.address}</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Firma Adı + Renk */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Firma Adı
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Renk
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 54, height: 38, borderRadius: 8, border: "1px solid #d1d5db", cursor: "pointer" }} />
                  <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
                </div>
              </label>
            </div>
            {/* Firma Ünvanı */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Firma Ünvanı
                <input value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} placeholder="Ticari unvan" style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
            </div>
            {/* Vergi Dairesi + Vergi No + Posta Kodu */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Vergi Dairesi
                <input value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Vergi Numarası
                <input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Posta Kodu
                <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
            </div>
            {/* Telefon + İl + İlçe */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Telefon
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>İl
                <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, address_district: "" })} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                  <option value="">İl seçin</option>
                  {cityNames.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>İlçe
                <select value={form.address_district} onChange={(e) => setForm({ ...form, address_district: e.target.value })} disabled={!form.city} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                  <option value="">İlçe seçin</option>
                  {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            {/* Adres */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Adres
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
              </label>
            </div>
            {/* Aktif */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Aktif
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={handleSave} style={{ padding: "8px 16px", borderRadius: 8, background: "#2563eb", color: "white", border: 0, cursor: "pointer", fontWeight: 600 }}>Kaydet</button>
              <button onClick={() => { setIsEditing(false); setLogoFile(null); setSuccess(null); setShowMap(!(company.hide_location || false)); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>İptal</button>
            </div>
          </>
        )}

        {showMap && mapQuery && (
          <div style={{ marginTop: 14, border: "1px solid #dbe3ee", borderRadius: 8, overflow: "hidden" }}>
            <iframe title="Firma konumu" src={getMapEmbedSrc()} width="100%" height="280" style={{ border: 0 }} loading="lazy" />
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, color: "#0f172a" }}>Tedarikçiler</h2>
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
