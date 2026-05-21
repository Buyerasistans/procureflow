import { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdminUser } from "../auth/permissions";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { createCompany, uploadCompanyLogo } from "../services/admin.service";
import {
  SUBSCRIPTION_ADDON_CTA_LABEL,
  SUBSCRIPTION_UPGRADE_CTA_LABEL,
  getSubscriptionAddonHref,
  getSubscriptionLimitGuidanceMessage,
  getSubscriptionUpgradeHref,
  hasSubscriptionUpgradeGuidance,
} from "../utils/subscriptionLimitErrors";
import "./CompanyCreateModal.css";

interface CompanyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CompanyCreateModal({ isOpen, onClose, onSuccess }: CompanyCreateModalProps) {
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

  function getMapEmbedSrc(street: string, districtName: string, cityName: string, zip: string) {
    const query = [street, districtName, cityName, zip, "Türkiye"].filter(Boolean).join(", ");
    return `https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(query)}`;
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);

    if (!file) {
      setLogoPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => setLogoPreview(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="company-create-modal__backdrop">
      <div
        className="company-create-modal__container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-create-modal-title"
      >
        <div className="company-create-modal__header">
          <h2 id="company-create-modal-title" className="company-create-modal__title">
            🏢 Yeni Firma Oluştur
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="company-create-modal__close-button"
            aria-label="Modalı kapat"
            title="Modalı kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="company-create-modal__form">
          {isSuperAdmin ? (
            <div className="company-create-modal__notice company-create-modal__notice--info">
              <div className="company-create-modal__notice-title">Platform Ana Firması Notu</div>
              <div className="company-create-modal__notice-text">
                Platform seviyesinde ilk oluşturulan firma otomatik olarak platform ana firması kabul edilir.
                Faturalandırma, resmi hesap ve yasal işlem kayıtları bu firma üzerinden izlenir.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="company-create-modal__notice company-create-modal__notice--error">
              <div className="company-create-modal__notice-text">{error}</div>
              {hasSubscriptionUpgradeGuidance(error) ? (
                <div className="company-create-modal__cta-row">
                  <a
                    href={getSubscriptionUpgradeHref(error)}
                    className="company-create-modal__cta-button company-create-modal__cta-button--upgrade"
                  >
                    {SUBSCRIPTION_UPGRADE_CTA_LABEL}
                  </a>
                  <a
                    href={getSubscriptionAddonHref(error)}
                    className="company-create-modal__cta-button company-create-modal__cta-button--addon"
                  >
                    {SUBSCRIPTION_ADDON_CTA_LABEL}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="company-create-modal__logo-block">
            <div className="company-create-modal__logo-preview">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Firma logo önizleme"
                  className="company-create-modal__logo-image"
                />
              ) : (
                <span>Logo Alanı</span>
              )}
            </div>

            <label className="company-create-modal__logo-upload">
              📎 Logo Ekle
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="company-create-modal__file-input"
                aria-label="Firma logosu yükle"
                title="Firma logosu yükle"
              />
            </label>

            {logoFile ? <span className="company-create-modal__file-name">{logoFile.name}</span> : null}
          </div>

          <div className="company-create-modal__two-column">
            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Firma Adı *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="örn: Pizza Max Ltd. Şti."
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
            <span className="company-create-modal__label">Firma Ünvanı</span>
            <input
              type="text"
              value={tradeName}
              onChange={(event) => setTradeName(event.target.value)}
              placeholder="Ticari unvan (örn: Pizza Max Gıda Tic. Ltd. Şti.)"
              className="company-create-modal__input"
              aria-label="Firma Ünvanı"
              title="Firma Ünvanı"
            />
          </label>

          <div className="company-create-modal__three-column">
            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Vergi Dairesi</span>
              <input
                type="text"
                value={taxOffice}
                onChange={(event) => setTaxOffice(event.target.value)}
                className="company-create-modal__input"
                placeholder="Vergi dairesi"
                aria-label="Vergi Dairesi"
                title="Vergi Dairesi"
              />
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Vergi Numarası</span>
              <input
                type="text"
                value={taxNumber}
                onChange={(event) => setTaxNumber(event.target.value)}
                className="company-create-modal__input"
                placeholder="Vergi numarası"
                aria-label="Vergi Numarası"
                title="Vergi Numarası"
              />
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Telefon</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="company-create-modal__input"
                placeholder="Telefon numarası"
                aria-label="Telefon"
                title="Telefon"
              />
            </label>
          </div>

          <div className="company-create-modal__three-column">
            <label className="company-create-modal__field">
              <span className="company-create-modal__label">İl</span>
              <select
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setDistrict("");
                }}
                className="company-create-modal__input"
                aria-label="İl seçimi"
                title="İl seçimi"
              >
                <option value="">İl seçin</option>
                {cityNames.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">İlçe</span>
              <select
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                className="company-create-modal__input"
                disabled={!city}
                aria-label="İlçe seçimi"
                title="İlçe seçimi"
              >
                <option value="">İlçe seçin</option>
                {districtOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="company-create-modal__field">
              <span className="company-create-modal__label">Posta Kodu</span>
              <input
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="company-create-modal__input"
                placeholder="Posta kodu"
                aria-label="Posta Kodu"
                title="Posta Kodu"
              />
            </label>
          </div>

          <label className="company-create-modal__field company-create-modal__field--full">
            <span className="company-create-modal__label">Adres</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={3}
              placeholder="Mahalle, cadde, sokak, bina no"
              className="company-create-modal__textarea"
              aria-label="Adres"
              title="Adres"
            />
          </label>

          <div className="company-create-modal__toggle-row">
            <button
              type="button"
              onClick={() => setHideLocation((prev) => !prev)}
              className="company-create-modal__toggle-button"
            >
              {hideLocation ? "Şirket Konumunu Göster" : "Şirket Konumunu Gizle"}
            </button>
          </div>

          {!hideLocation && (address || city || district) ? (
            <div className="company-create-modal__map-frame">
              <iframe
                title="Firma konumu"
                src={getMapEmbedSrc(address, district, city, postalCode)}
                className="company-create-modal__map-iframe"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="company-create-modal__checkbox-grid">
            <label className="company-create-modal__checkbox">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="company-create-modal__checkbox-input"
              />
              <span>Aktif</span>
            </label>
          </div>

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
