import { useState } from "react";
import { createCompany } from "../services/admin.service";
import "./CompanyCreateModal_new.css";

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="company-create-modal__backdrop">
      <div className="company-create-modal__container">
        <div className="company-create-modal__header">
          <h2 className="company-create-modal__title">🏢 Yeni Firma Oluştur</h2>
          <button type="button" onClick={onClose} className="company-create-modal__close-button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="company-create-modal__form">
          {error ? <div className="company-create-modal__error">{error}</div> : null}

          <div className="company-create-modal__two-column">
            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Firma Adı *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="örn: Pizza Max şti."
                className="company-create-modal__input"
                aria-label="Firma Adı"
                title="Firma Adı"
              />
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Renk</span>
              <div className="company-create-modal__color-row">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="company-create-modal__color-input"
                  aria-label="Renk seç"
                  title="Renk seç"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  maxLength={7}
                  className="company-create-modal__input"
                  aria-label="Renk kodu"
                  title="Renk kodu"
                />
              </div>
            </label>
          </div>

          <label className="company-create-modal__field company-create-modal__field--full">
            <span className="company-create-modal__label">Açıklama</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Firma hakkında bilgi..."
              rows={2}
              className="company-create-modal__textarea"
              aria-label="Açıklama"
              title="Açıklama"
            />
          </label>

          <label className="company-create-modal__field company-create-modal__field--full">
            <span className="company-create-modal__label">Firma Logo URL</span>
            <input
              type="url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://ornek.com/logo.png"
              className="company-create-modal__input"
              aria-label="Firma Logo URL"
              title="Firma Logo URL"
            />
          </label>

          <div className="company-create-modal__two-column">
            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Vergi Dairesi</span>
              <input
                type="text"
                value={taxOffice}
                onChange={(event) => setTaxOffice(event.target.value)}
                placeholder="örn: İstanbul Vergi Dairesi"
                className="company-create-modal__input"
                aria-label="Vergi Dairesi"
                title="Vergi Dairesi"
              />
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Telefon</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="örn: +90 212 xxx xxxx"
                className="company-create-modal__input"
                aria-label="Telefon"
                title="Telefon"
              />
            </label>
          </div>

          <label className="company-create-modal__field company-create-modal__field--full">
            <span className="company-create-modal__label">Adres</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Firma adresi..."
              rows={2}
              className="company-create-modal__textarea"
              aria-label="Adres"
              title="Adres"
            />
          </label>

          <label className="company-create-modal__field company-create-modal__field--full">
            <span className="company-create-modal__label">İletişim Bilgileri</span>
            <textarea
              value={contactInfo}
              onChange={(event) => setContactInfo(event.target.value)}
              placeholder="Ek iletişim bilgileri, yetkili adları, web sitesi vb..."
              rows={2}
              className="company-create-modal__textarea"
              aria-label="İletişim Bilgileri"
              title="İletişim Bilgileri"
            />
          </label>

          <div className="company-create-modal__checkbox-grid">
            <label className="company-create-modal__checkbox">
              <input
                type="checkbox"
                checked={hideLocation}
                onChange={(event) => setHideLocation(event.target.checked)}
                className="company-create-modal__checkbox-input"
              />
              <span>Şirket konumunu gizle</span>
            </label>

            <label className="company-create-modal__checkbox">
              <input
                type="checkbox"
                checked={shareOnWhatsapp}
                onChange={(event) => setShareOnWhatsapp(event.target.checked)}
                className="company-create-modal__checkbox-input"
              />
              <span>WhatsApp'da paylaşılabilir</span>
            </label>
          </div>

          <label className="company-create-modal__checkbox company-create-modal__checkbox--full">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="company-create-modal__checkbox-input"
            />
            <span>Firmayı aktif olarak oluştur</span>
          </label>

          <div className="company-create-modal__footer">
            <button
              type="submit"
              disabled={loading}
              className={
                loading
                  ? "company-create-modal__primary-button company-create-modal__primary-button--disabled"
                  : "company-create-modal__primary-button"
              }
            >
              {loading ? "⏳ Kaydediliyor..." : "✅ Firma Oluştur"}
            </button>
            <button type="button" onClick={onClose} className="company-create-modal__secondary-button">
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
