import { useState } from "react";
import { createCompany } from "../services/admin.service";
import { modalStyles } from "../styles/modalStyles";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [taxOffice, setTaxOffice] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [hideLocation, setHideLocation] = useState(false);
  const [shareOnWhatsapp, setShareOnWhatsapp] = useState(true);
  const [isActive, setIsActive] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) throw new Error("Firma adı gerekli");

      await createCompany({
        name,
        description: description || undefined,
        logo_url: logoUrl || undefined,
        color,
        tax_office: taxOffice || undefined,
        address: address || undefined,
        phone: phone || undefined,
        contact_info: contactInfo || undefined,
        hide_location: hideLocation,
        share_on_whatsapp: shareOnWhatsapp,
        is_active: isActive,
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firma oluşturulamadı");
      console.error("Firma oluşturma hatası:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setLogoUrl("");
    setColor("#3b82f6");
    setTaxOffice("");
    setAddress("");
    setPhone("");
    setContactInfo("");
    setHideLocation(false);
    setShareOnWhatsapp(true);
    setIsActive(true);
    setError("");
  }

  if (!isOpen) return null;

  return (
    <div style={modalStyles.backdrop}>
      <div style={{ ...modalStyles.container, maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>🏢 Yeni Firma Oluştur</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={modalStyles.content}>
          {/* Error */}
          {error && <div style={modalStyles.errorMessage}>{error}</div>}

          {/* Firma Adı & Renk - 2 Column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={modalStyles.label}>Firma Adı *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn: Pizza Max şti."
                style={modalStyles.input}
              />
            </div>
            <div>
              <label style={modalStyles.label}>Renk</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: 50, height: 40, cursor: "pointer", borderRadius: 4 }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  maxLength={7}
                  style={modalStyles.input}
                />
              </div>
            </div>
          </div>

          {/* Açıklama */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Firma hakkında bilgi..."
              rows={2}
              style={modalStyles.textarea}
            />
          </div>

          {/* Logo URL */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Firma Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://ornek.com/logo.png"
              style={modalStyles.input}
            />
          </div>

          {/* Vergi Dairesi & Telefon - 2 Column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={modalStyles.label}>Vergi Dairesi</label>
              <input
                type="text"
                value={taxOffice}
                onChange={(e) => setTaxOffice(e.target.value)}
                placeholder="örn: İstanbul Vergi Dairesi"
                style={modalStyles.input}
              />
            </div>
            <div>
              <label style={modalStyles.label}>Telefon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="örn: +90 212 xxx xxxx"
                style={modalStyles.input}
              />
            </div>
          </div>

          {/* Adres */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Adres</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Firma adresi..."
              rows={2}
              style={modalStyles.textarea}
            />
          </div>

          {/* İletişim Bilgileri */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>İletişim Bilgileri</label>
            <textarea
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Ek iletişim bilgileri, yetkili adları, web sitesi vb..."
              rows={2}
              style={modalStyles.textarea}
            />
          </div>

          {/* Checkboxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={modalStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={hideLocation}
                onChange={(e) => setHideLocation(e.target.checked)}
                style={modalStyles.checkbox}
              />
              <span>Şirket konumunu gizle</span>
            </label>
            <label style={modalStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={shareOnWhatsapp}
                onChange={(e) => setShareOnWhatsapp(e.target.checked)}
                style={modalStyles.checkbox}
              />
              <span>WhatsApp'da paylaşılabilir</span>
            </label>
          </div>

          {/* Aktif Checkbox */}
          <div style={{ ...modalStyles.fullWidth, marginBottom: "16px" }}>
            <label style={modalStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={modalStyles.checkbox}
              />
              <span>Firmayı aktif olarak oluştur</span>
            </label>
          </div>

          {/* Buttons */}
          <div style={modalStyles.footer}>
            <button
              type="submit"
              disabled={loading}
              style={
                loading
                  ? modalStyles.primaryButtonDisabled
                  : modalStyles.primaryButton
              }
            >
              {loading ? "⏳ Kaydediliyor..." : "✅ Firma Oluştur"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={modalStyles.secondaryButton}
            >
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
