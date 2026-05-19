import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { createProject } from "../services/project.service";
import { getCompanies, getTenantUsers } from "../services/admin.service";
import { modalStyles } from "../styles/modalStyles";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import type { Company, TenantUser } from "../services/admin.service";
import { filterUsersByAssignmentScope } from "../utils/tenantUserAssignments";
import { SUBSCRIPTION_ADDON_CTA_LABEL, SUBSCRIPTION_UPGRADE_CTA_LABEL, getSubscriptionAddonHref, getSubscriptionLimitGuidanceMessage, getSubscriptionUpgradeHref, hasSubscriptionUpgradeGuidance } from "../utils/subscriptionLimitErrors";

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
      loadCompanies();
    }
    if (isOpen && personnel.length === 0) {
      loadPersonnel();
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
      setPersonnel(data.filter((p) => p.is_active));
    } catch (err) {
      setError("Personel yüklenemedi: " + String(err));
    }
  }

  function toggleResponsibleUser(userId: number) {
    setResponsibleUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      // Detaylı error log
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
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.container}>
        {/* Header */}
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>➕ Yeni Proje Oluştur</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={modalStyles.content}>
          {/* Error */}
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

          {/* Row 1: Name & Code */}
          <div style={modalStyles.grid}>
            <div>
              <label style={modalStyles.label}>Proje Adı *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn: Pizza Max Merkez"
                style={modalStyles.input}
              />
            </div>
            <div>
              <label style={modalStyles.label}>Proje Kodu *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="örn: PM-001"
                style={modalStyles.input}
              />
            </div>
          </div>

          {/* Row 2: Company & Type */}
          <div style={modalStyles.grid}>
            <div>
              <label style={modalStyles.label}>Firma *</label>
              <select
                value={companyId || ""}
                onChange={(e) =>
                  setCompanyId(e.target.value ? parseInt(e.target.value) : undefined)
                }
                style={modalStyles.input}
              >
                <option value="">Firma seçin...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={modalStyles.label}>Proje Tipi</label>
              <select
                value={projectType}
                onChange={(e) =>
                  setProjectType(e.target.value as "merkez" | "franchise")
                }
                style={modalStyles.input}
              >
                <option value="merkez">🏢 Merkez</option>
                <option value="franchise">🍕 Franchise</option>
              </select>
            </div>
          </div>

          {/* Row 3: Manager & Phone */}
          <div style={modalStyles.grid}>
            <div>
              <label style={modalStyles.label}>Proje Yetkilisi</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Ad Soyad"
                style={modalStyles.input}
              />
            </div>
            <div>
              <label style={modalStyles.label}>Telefon</label>
              <input
                type="tel"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                placeholder="+90 555 123 4567"
                style={modalStyles.input}
              />
            </div>
          </div>

          {/* Row 3b: Manager Email */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Yetkili E-mail</label>
            <input
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="yetkili@example.com"
              style={modalStyles.input}
            />
          </div>

          {/* Responsible Purchasing Personnel */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Satın Alma Sorumluları</label>
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
              Projeyi olusturan kullanici sistem tarafinda otomatik olarak projeye eklenir.
            </div>
            <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px" }}>
              {personnel.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#6b7280" }}>Personel bulunamadı</div>
              ) : (
                availableResponsibleUsers.map((p) => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={responsibleUserIds.includes(p.id)}
                      onChange={() => toggleResponsibleUser(p.id)}
                    />
                    <span>{p.full_name} ({p.email})</span>
                  </label>
                ))
              )}
              {personnel.length > 0 && availableResponsibleUsers.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#6b7280" }}>Secili firmaya bagli aktif ekip uyesi bulunamadi</div>
              ) : null}
            </div>
          </div>

          {/* Address */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Adres</label>
            <div style={{ ...modalStyles.grid, marginBottom: "8px" }}>
              <div>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setDistrict("");
                  }}
                  style={modalStyles.input}
                >
                  <option value="">İl seçin</option>
                  {cityOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  style={modalStyles.input}
                  disabled={!city}
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
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Mahalle, cadde, sokak, bina no"
              rows={2}
              style={modalStyles.textarea}
            />
            {fullAddress.trim() && (
              <div
                style={{
                  width: "100%",
                  height: "200px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid #ddd",
                  marginTop: "8px",
                }}
              >
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(fullAddress)}`}
                />
              </div>
            )}
          </div>

          {/* Budget */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Bütçe (TL)</label>
            <input
              type="number"
              value={budget || ""}
              onChange={(e) =>
                setBudget(e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="0.00"
              step="0.01"
              min="0"
              style={modalStyles.input}
            />
          </div>

          {/* Checkbox */}
          <div style={{ ...modalStyles.fullWidth, marginBottom: "16px" }}>
            <label style={modalStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={modalStyles.checkbox}
              />
              <span>Projeyi aktif olarak oluştur</span>
            </label>
          </div>

          {/* Buttons */}
          <div style={modalStyles.footer}>
            <button
              type="submit"
              disabled={loading}
              style={loading ? modalStyles.primaryButtonDisabled : modalStyles.primaryButton}
            >
              {loading ? "⏳ Kaydediliyor..." : "✅ Proje Oluştur"}
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
