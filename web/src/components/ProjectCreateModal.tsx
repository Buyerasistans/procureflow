import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { createProject } from "../services/project.service";
import { getCompanies, getTenantUsers } from "../services/admin.service";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import type { Company, TenantUser } from "../services/admin.service";
import { filterUsersByAssignmentScope } from "../utils/tenantUserAssignments";
import {
  SUBSCRIPTION_ADDON_CTA_LABEL,
  SUBSCRIPTION_UPGRADE_CTA_LABEL,
  getSubscriptionAddonHref,
  getSubscriptionLimitGuidanceMessage,
  getSubscriptionUpgradeHref,
  hasSubscriptionUpgradeGuidance,
} from "../utils/subscriptionLimitErrors";
import "./ProjectCreateModal.css";

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProjectCreateModal({ isOpen, onClose, onSuccess }: ProjectCreateModalProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [personnel, setPersonnel] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [projectType, setProjectType] = useState<"merkez" | "franchise">("merkez");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [responsibleUserIds, setResponsibleUserIds] = useState<number[]>([]);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState<number | undefined>();
  const [isActive, setIsActive] = useState(true);

  const cityOptions = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(() => (city ? getDistricts(city) : []), [city]);
  const fullAddress = useMemo(
    () => [address, district, city, "Türkiye"].filter(Boolean).join(", "),
    [address, district, city],
  );
  const availableResponsibleUsers = useMemo(
    () => filterUsersByAssignmentScope(personnel, { companyId }),
    [companyId, personnel],
  );

  useEffect(() => {
    if (isOpen && companies.length === 0) {
      void loadCompanies();
    }
    if (isOpen && personnel.length === 0) {
      void loadPersonnel();
    }
  }, [isOpen, companies.length, personnel.length]);

  async function loadCompanies() {
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      setError("Firmalar yüklenemedi: " + String(err));
    }
  }

  async function loadPersonnel() {
    try {
      const data = await getTenantUsers();
      setPersonnel(data.filter((item) => item.is_active));
    } catch (err) {
      setError("Personel yüklenemedi: " + String(err));
    }
  }

  function toggleResponsibleUser(userId: number) {
    setResponsibleUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) throw new Error("Proje adı gerekli");
      if (!code.trim()) throw new Error("Proje kodu gerekli");
      if (!companyId) throw new Error("Firma seçimi gerekli");

      await createProject({
        name,
        code,
        company_id: companyId,
        project_type: projectType,
        manager_name: managerName || undefined,
        manager_phone: managerPhone || undefined,
        manager_email: managerEmail || undefined,
        address: [city, district, address].filter(Boolean).join(", ") || undefined,
        budget: budget || undefined,
        is_active: isActive,
        responsible_user_ids: responsibleUserIds,
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      const errorMessage = getSubscriptionLimitGuidanceMessage(err, "Proje oluşturulamadı");
      setError(errorMessage);

      if (axios.isAxiosError(err)) {
        console.error("[PROJECT] API Error:", {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
      } else {
        console.error("[PROJECT] Error:", err);
      }
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setCode("");
    setCompanyId(undefined);
    setProjectType("merkez");
    setManagerName("");
    setManagerPhone("");
    setManagerEmail("");
    setResponsibleUserIds([]);
    setCity("");
    setDistrict("");
    setAddress("");
    setBudget(undefined);
    setIsActive(true);
    setError("");
  }

  if (!isOpen) return null;

  return (
    <div className="project-create-modal__backdrop">
      <div className="project-create-modal__container" role="dialog" aria-modal="true" aria-labelledby="project-create-modal-title">
        <div className="project-create-modal__header">
          <h2 id="project-create-modal-title" className="project-create-modal__title">
            ➕ Yeni Proje Oluştur
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="project-create-modal__close-button"
            aria-label="Modalı kapat"
            title="Modalı kapat"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-create-modal__form">
          {error ? (
            <div className="project-create-modal__error">
              <div>{error}</div>
              {hasSubscriptionUpgradeGuidance(error) ? (
                <div className="project-create-modal__error-actions">
                  <a
                    href={getSubscriptionUpgradeHref(error)}
                    className="project-create-modal__cta project-create-modal__cta--upgrade"
                  >
                    {SUBSCRIPTION_UPGRADE_CTA_LABEL}
                  </a>
                  <a
                    href={getSubscriptionAddonHref(error)}
                    className="project-create-modal__cta project-create-modal__cta--addon"
                  >
                    {SUBSCRIPTION_ADDON_CTA_LABEL}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="project-create-modal__grid">
            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-name">
                Proje Adı *
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="örn: Pizza Max Merkez"
                className="project-create-modal__input"
                aria-label="Proje Adı"
                title="Proje Adı"
              />
            </div>

            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-code">
                Proje Kodu *
              </label>
              <input
                id="project-code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="örn: PM-001"
                className="project-create-modal__input"
                aria-label="Proje Kodu"
                title="Proje Kodu"
              />
            </div>
          </div>

          <div className="project-create-modal__grid">
            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-company">
                Firma *
              </label>
              <select
                id="project-company"
                value={companyId || ""}
                onChange={(event) =>
                  setCompanyId(event.target.value ? parseInt(event.target.value, 10) : undefined)
                }
                className="project-create-modal__input"
                aria-label="Firma seçimi"
                title="Firma seçimi"
              >
                <option value="">Firma seçin...</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-type">
                Proje Tipi
              </label>
              <select
                id="project-type"
                value={projectType}
                onChange={(event) => setProjectType(event.target.value as "merkez" | "franchise")}
                className="project-create-modal__input"
                aria-label="Proje tipi seçimi"
                title="Proje tipi seçimi"
              >
                <option value="merkez">🏢 Merkez</option>
                <option value="franchise">🍕 Franchise</option>
              </select>
            </div>
          </div>

          <div className="project-create-modal__grid">
            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-manager-name">
                Proje Yetkilisi
              </label>
              <input
                id="project-manager-name"
                type="text"
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
                placeholder="Ad Soyad"
                className="project-create-modal__input"
                aria-label="Proje Yetkilisi"
                title="Proje Yetkilisi"
              />
            </div>

            <div className="project-create-modal__field">
              <label className="project-create-modal__label" htmlFor="project-manager-phone">
                Telefon
              </label>
              <input
                id="project-manager-phone"
                type="tel"
                value={managerPhone}
                onChange={(event) => setManagerPhone(event.target.value)}
                placeholder="+90 555 123 4567"
                className="project-create-modal__input"
                aria-label="Telefon"
                title="Telefon"
              />
            </div>
          </div>

          <div className="project-create-modal__field project-create-modal__field--full">
            <label className="project-create-modal__label" htmlFor="project-manager-email">
              Yetkili E-mail
            </label>
            <input
              id="project-manager-email"
              type="email"
              value={managerEmail}
              onChange={(event) => setManagerEmail(event.target.value)}
              placeholder="yetkili@example.com"
              className="project-create-modal__input"
              aria-label="Yetkili E-mail"
              title="Yetkili E-mail"
            />
          </div>

          <div className="project-create-modal__field project-create-modal__field--full">
            <label className="project-create-modal__label">Satın Alma Sorumluları</label>
            <div className="project-create-modal__helper-text">
              Projeyi oluşturan kullanıcı sistem tarafında otomatik olarak projeye eklenir.
            </div>
            <div className="project-create-modal__people-box">
              {personnel.length === 0 ? (
                <div className="project-create-modal__empty-state">Personel bulunamadı</div>
              ) : (
                availableResponsibleUsers.map((person) => (
                  <label key={person.id} className="project-create-modal__checkbox-row">
                    <input
                      type="checkbox"
                      checked={responsibleUserIds.includes(person.id)}
                      onChange={() => toggleResponsibleUser(person.id)}
                      className="project-create-modal__checkbox-input"
                    />
                    <span>
                      {person.full_name} ({person.email})
                    </span>
                  </label>
                ))
              )}
              {personnel.length > 0 && availableResponsibleUsers.length === 0 ? (
                <div className="project-create-modal__empty-state">
                  Seçili firmaya bağlı aktif ekip üyesi bulunamadı
                </div>
              ) : null}
            </div>
          </div>

          <div className="project-create-modal__field project-create-modal__field--full">
            <label className="project-create-modal__label" htmlFor="project-city">
              Adres
            </label>
            <div className="project-create-modal__grid project-create-modal__grid--address">
              <div className="project-create-modal__field">
                <select
                  id="project-city"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setDistrict("");
                  }}
                  className="project-create-modal__input"
                  aria-label="İl seçimi"
                  title="İl seçimi"
                >
                  <option value="">İl seçin</option>
                  {cityOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="project-create-modal__field">
                <select
                  id="project-district"
                  value={district}
                  onChange={(event) => setDistrict(event.target.value)}
                  className="project-create-modal__input"
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
              </div>
            </div>

            <textarea
              id="project-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Mahalle, cadde, sokak, bina no"
              rows={2}
              className="project-create-modal__textarea"
              aria-label="Adres"
              title="Adres"
            />

            {fullAddress.trim() ? (
              <div className="project-create-modal__map-shell">
                <iframe
                  title="Proje konumu haritası"
                  className="project-create-modal__map"
                  loading="lazy"
                  allowFullScreen
                  src={`https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(fullAddress)}`}
                />
              </div>
            ) : null}
          </div>

          <div className="project-create-modal__field project-create-modal__field--full">
            <label className="project-create-modal__label" htmlFor="project-budget">
              Bütçe (TL)
            </label>
            <input
              id="project-budget"
              type="number"
              value={budget || ""}
              onChange={(event) =>
                setBudget(event.target.value ? parseFloat(event.target.value) : undefined)
              }
              placeholder="0.00"
              step="0.01"
              min="0"
              className="project-create-modal__input"
              aria-label="Bütçe (TL)"
              title="Bütçe (TL)"
            />
          </div>

          <div className="project-create-modal__field project-create-modal__field--full">
            <label className="project-create-modal__checkbox-row">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="project-create-modal__checkbox-input"
              />
              <span>Projeyi aktif olarak oluştur</span>
            </label>
          </div>

          <div className="project-create-modal__footer">
            <button
              type="submit"
              disabled={loading}
              className={
                loading
                  ? "project-create-modal__primary-button project-create-modal__primary-button--disabled"
                  : "project-create-modal__primary-button"
              }
            >
              {loading ? "⏳ Kaydediliyor..." : "✅ Proje Oluştur"}
            </button>
            <button type="button" onClick={onClose} className="project-create-modal__secondary-button">
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
