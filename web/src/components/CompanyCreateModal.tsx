import { useMemo, useState } from "react";
import { createCompany, uploadCompanyLogo } from "../services/admin.service";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { modalStyles } from "../styles/modalStyles";
import { SUBSCRIPTION_ADDON_CTA_LABEL, SUBSCRIPTION_UPGRADE_CTA_LABEL, getSubscriptionAddonHref, getSubscriptionLimitGuidanceMessage, getSubscriptionUpgradeHref, hasSubscriptionUpgradeGuidance } from "../utils/subscriptionLimitErrors";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdminUser } from "../auth/permissions";

interface CompanyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CompanyCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: CompanyCreateModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [color, setColor] = useState("#3b82f6");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [hideLocation, setHideLocation] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const cityNames = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(() => (city ? getDistricts(city) : []), [city]);
  const isSuperAdmin = isSuperAdminUser(user);

  const getMapEmbedSrc = (street: string, districtName: string, cityName: string, zip: string) => {
    const query = [street, districtName, cityName, zip, "Türkiye"].filter(Boolean).join(", ");
    return `https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(query)}`;
  };

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) throw new Error("Firma adı gerekli");

      const created = await createCompany({
        name,
        trade_name: tradeName || undefined,
        color,
        tax_office: taxOffice || undefined,
        tax_number: taxNumber || undefined,
        registration_number: registrationNumber || undefined,
        address: address || undefined,
        city: city || undefined,
        address_district: district || undefined,
        postal_code: postalCode || undefined,
        phone: phone || undefined,
        hide_location: hideLocation,
        share_on_whatsapp: true,
        is_active: isActive,
      });

      if (logoFile) {
        await uploadCompanyLogo(created.id, logoFile);
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(getSubscriptionLimitGuidanceMessage(err, "Firma oluşturulamadı"));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setTradeName("");
    setLogoFile(null);
    setLogoPreview(null);
    setColor("#3b82f6");
    setTaxOffice("");
    setTaxNumber("");
    setRegistrationNumber("");
    setAddress("");
    setCity("");
    setDistrict("");
    setPostalCode("");
    setPhone("");
    setHideLocation(false);
    setIsActive(true);
    setError("");
  }

  if (!isOpen) return null;

  return (
    <div style={modalStyles.backdrop}>
      <div style={{ ...modalStyles.container, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>🏢 Yeni Firma Oluştur</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={modalStyles.content}>
          {isSuperAdmin ? (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 800 }}>Platform Ana Firması Notu</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                Platform seviyesinde ilk oluşturulan firma otomatik olarak platform ana firması kabul edilir. Faturalandırma, resmi hesap ve yasal işlem kayıtları bu firma üzerinden izlenir.
              </div>
            </div>
          ) : null}
          {error ? (
            <div style={{ ...modalStyles.errorMessage, display: "grid", gap: 10 }}>
              <div>{error}</div>
              {hasSubscriptionUpgradeGuidance(error) ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={getSubscriptionUpgradeHref(error)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#991b1b", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                    {SUBSCRIPTION_UPGRADE_CTA_LABEL}
                  </a>
                  <a href={getSubscriptionAddonHref(error)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#7c2d12", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                    {SUBSCRIPTION_ADDON_CTA_LABEL}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 110, height: 110, borderRadius: 16, border: "2px solid #e2e8f0", background: "#f8fafc", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              {logoPreview
                ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} />
                : <span>Logo Alanı</span>
              }
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 18px", borderRadius: 8, border: "2px dashed #93c5fd", cursor: "pointer", color: "#2563eb", fontWeight: 600, fontSize: 13, background: "#eff6ff" }}>
              📎 Logo Ekle
              <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
            </label>
            {logoFile && <span style={{ fontSize: 11, color: "#64748b" }}>{logoFile.name}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={modalStyles.label}>Firma Adı *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="örn: Pizza Max Ltd. Şti." style={modalStyles.input} />
            </div>
            <div>
              <label style={modalStyles.label}>Renk</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 46, height: 38, cursor: "pointer", borderRadius: 6, border: "1px solid #d1d5db" }} />
                <input type="text" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} style={modalStyles.input} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={modalStyles.label}>Firma Ünvanı</label>
            <input type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Ticari unvan (örn: Pizza Max Gıda Tic. Ltd. Şti.)" style={modalStyles.input} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={modalStyles.label}>Vergi Dairesi</label>
              <input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} style={modalStyles.input} />
            </div>
            <div>
              <label style={modalStyles.label}>Vergi Numarası</label>
              <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} style={modalStyles.input} />
            </div>
            <div>
              <label style={modalStyles.label}>Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={modalStyles.input} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#334155" }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={modalStyles.checkbox} />
              <span>Aktif</span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={modalStyles.label}>İl</label>
              <select value={city} onChange={(e) => { setCity(e.target.value); setDistrict(""); }} style={modalStyles.input}>
                <option value="">İl seçin</option>
                {cityNames.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label style={modalStyles.label}>İlçe</label>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} style={modalStyles.input} disabled={!city}>
                <option value="">İlçe seçin</option>
                {districtOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label style={modalStyles.label}>Posta Kodu</label>
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} style={modalStyles.input} />
            </div>
          </div>

          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Adres</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Mahalle, cadde, sokak, bina no" style={modalStyles.textarea} />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setHideLocation((prev) => !prev)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#334155" }}
            >
              {hideLocation ? "Şirket Konumunu Göster" : "Şirket Konumunu Gizle"}
            </button>
          </div>

          {!hideLocation && (address || city || district) && (
            <div style={{ marginBottom: 16, border: "1px solid #dbe3ee", borderRadius: 10, overflow: "hidden" }}>
              <iframe title="Firma konumu" src={getMapEmbedSrc(address, district, city, postalCode)} width="100%" height="260" style={{ border: 0 }} loading="lazy" />
            </div>
          )}

          <div style={modalStyles.footer}>
            <button type="submit" disabled={loading} style={loading ? modalStyles.primaryButtonDisabled : modalStyles.primaryButton}>
              {loading ? "⏳ Kaydediliyor..." : "✅ Firma Oluştur"}
            </button>
            <button type="button" onClick={onClose} style={modalStyles.secondaryButton}>
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
