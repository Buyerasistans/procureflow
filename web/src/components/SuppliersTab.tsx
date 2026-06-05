// web/src/components/SuppliersTab.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../lib/http";
import { isPlatformStaffUser } from "../auth/permissions";
import { useAuth } from "../hooks/useAuth";
import { getMailCenterAccounts, type MailCenterAccount } from "../services/mail-center.service";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { CategorySelectionModal } from "./CategorySelectionModal";
import type { Supplier, SupplierUser } from "../types/supplier";
import "./SuppliersTab.css";

function getErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === "string"
  ) {
    return (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function SuppliersTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const readOnly = isPlatformStaffUser(user);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [mailAccounts, setMailAccounts] = useState<MailCenterAccount[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "private" | "platform_network">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [showPartnerCategoryModal, setShowPartnerCategoryModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    phone: "",
    email: "",
    city: "",
    address_district: "",
    notes: "",
    category: "",
    partner_category_tags: [] as string[],
  });


  // Supplier user management
  const [selectedSupplier] = useState<Supplier | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getMailCenterAccounts()
      .then((data) => {
        if (mounted) setMailAccounts(data);
      })
      .catch(() => {
        if (mounted) setMailAccounts([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const getUnreadCountForEmail = useCallback(
    (email?: string | null) => mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === String(email || "").trim().toLowerCase())?.unread_count || 0,
    [mailAccounts],
  );

  const totalUnreadMailCount = useMemo(() => mailAccounts.reduce((sum, account) => sum + (account.unread_count || 0), 0), [mailAccounts]);

  const [supplierUsers, setSupplierUsers] = useState<SupplierUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedSupplierUser, setSelectedSupplierUser] = useState<SupplierUser | null>(null);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [userEditForm, setUserEditForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [editForm, setEditForm] = useState({
    company_name: "",
    company_title: "",
    tax_number: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    postal_code: "",
    category: "",
    notes: "",
  });

  const cityOptions = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(() => getDistricts(formData.city), [formData.city]);

  const resetInviteForm = useCallback(() => {
    setFormData({
      company_name: "",
      phone: "",
      email: "",
      city: "",
      address_district: "",
      notes: "",
      category: "",
      partner_category_tags: [],
    });
  }, []);

  const resolveLogoUrl = (logoUrl?: string) => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith("http")) return logoUrl;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    return `${apiBase}${logoUrl}`;
  };

  // Load suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[SuppliersTab] Loading suppliers...");
      const response = await http.get("/suppliers", {
        params: sourceFilter === "all" ? undefined : { source_type: sourceFilter },
      });
      console.log("[SuppliersTab] Suppliers loaded:", response.data);
      setSuppliers(response.data);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Tedarikçiler yüklenemedi");
      console.error("[SuppliersTab] Error loading suppliers:", errorMsg, err);
      setError(`❌ Tedarikçiler yüklenemedi: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => {
    console.log("[SuppliersTab] Component mounted, loading suppliers...");
    loadSuppliers();
  }, [loadSuppliers]);

  // Load supplier users when supplier is selected
  const loadSupplierUsers = useCallback(async (supplierId: number) => {
    try {
      setUsersLoading(true);
      const response = await http.get(`/suppliers/${supplierId}/users`);
      setSupplierUsers(response.data);
    } catch (err: unknown) {
      console.error("Error loading supplier users:", err);
      setSupplierUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleEditSupplierUser = (user: SupplierUser) => {
    setSelectedSupplierUser(user);
    setUserEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
    });
    setShowUserEditModal(true);
  };

  const handleSaveEditSupplierUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedSupplierUser) return;

    try {
      setFormLoading(true);
      setError(null);

      await http.put(
        `/suppliers/${selectedSupplier.id}/users/${selectedSupplierUser.id}`,
        {
          name: userEditForm.name,
          email: userEditForm.email,
          phone: userEditForm.phone,
        }
      );

      setSuccess("Kullanıcı başarıyla güncellendi");
      setShowUserEditModal(false);
      loadSupplierUsers(selectedSupplier.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Güncelleme hatası");
      setError(errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSupplierUser = async (userId: number) => {
    if (!selectedSupplier) {
      setError("Tedarikçi seçili değil");
      return;
    }
    if (!confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) return;

    try {
      setError(null);
      console.log("[SuppliersTab] Deleting user:", userId, "from supplier:", selectedSupplier.id);

      const response = await http.delete(`/suppliers/${selectedSupplier.id}/users/${userId}`);
      console.log("[SuppliersTab] Delete response:", response.data);

      setSuccess("Kullanıcı başarıyla silindi");

      await loadSupplierUsers(selectedSupplier.id);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Silme hatası");
      console.error("[SuppliersTab] Delete error:", errorMsg, err);
      setError(`❌ Silme hatası: ${errorMsg}`);
    }
  };

  const handleSetDefaultSupplierUser = async (userId: number) => {
    if (!selectedSupplier) return;
    try {
      setError(null);
      await http.post(`/suppliers/${selectedSupplier.id}/users/${userId}/set-default`);
      setSuccess("Varsayılan yetkili güncellendi");
      await loadSupplierUsers(selectedSupplier.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Varsayılan yetkili güncellenemedi");
      setError(`❌ ${errorMsg}`);
    }
  };

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      setFormLoading(true);
      await http.post("/suppliers", formData);

      setSuccess("Tedarikçi daveti oluşturuldu. Magic link e-postası gönderilmeye çalışıldı.");
      setShowForm(false);
      resetInviteForm();

      loadSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Tedarikçi eklenemedi"));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteSupplier(supplierId: number) {
    if (!confirm("Bu tedarikçiyi silmek istediğinizden emin misiniz?")) return;

    try {
      await http.delete(`/suppliers/${supplierId}`);

      setSuccess("Tedarikçi başarıyla silindi");
      loadSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Tedarikçi silinemedi"));
    }
  }

  async function handleAddSupplierUser(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedSupplier) return;

    try {
      setFormLoading(true);
      setError(null);
      console.log("[SuppliersTab] Adding supplier user:", userForm);

      const payload = {
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone,
      };

      const response = await http.post(`/suppliers/${selectedSupplier.id}/users`, payload);
      console.log("[SuppliersTab] Added supplier user:", response.data);

      setSuccess("✅ Kullanıcı eklendi. Davet emaili gönderilmeye çalışıldı. (SMTP ayarlarını kontrol edin)");
      setShowUserModal(false);
      setUserForm({ name: "", email: "", phone: "" });

      await loadSuppliers();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Kullanıcı ekleme hatası");
      console.error("[SuppliersTab] Supplier User Add Error:", errorMsg, err);
      setError(`❌ ${errorMsg}`);
    } finally {
      setFormLoading(false);
    }
  }

  async function handleSaveEditSupplier(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedSupplier) return;

    try {
      setFormLoading(true);
      setError(null);

      const payload = {
        company_name: editForm.company_name,
        company_title: editForm.company_title,
        tax_number: editForm.tax_number,
        phone: editForm.phone,
        email: editForm.email,
        website: editForm.website,
        address: editForm.address,
        city: editForm.city,
        postal_code: editForm.postal_code,
        category: editForm.category,
        notes: editForm.notes,
      };

      await http.put(`/suppliers/${selectedSupplier.id}`, payload);

      setSuccess("Tedarikçi başarıyla güncellendi");
      setShowEditModal(false);
      setEditForm({
        company_name: "",
        company_title: "",
        tax_number: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        city: "",
        postal_code: "",
        category: "",
        notes: "",
      });
      loadSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Güncelleme hatası");
      console.error("Supplier Update Error:", err);
      setError(errorMsg);
    } finally {
      setFormLoading(false);
    }
  }

  if (loading) return <div className="su-container su-loading">⏳ Tedarikçiler yükleniyor...</div>;

  const formatSupplierCategories = (supplier: Supplier) => {
    const tags = supplier.effective_category_tags?.length
      ? supplier.effective_category_tags
      : supplier.category
        ? [supplier.category]
        : [];
    return tags.length > 0 ? tags.join(", ") : "-";
  };

  const supplierSourceSummary = {
    all: suppliers.length,
    private: suppliers.filter((supplier) => (supplier.source_type || "private") === "private").length,
    platform_network: suppliers.filter((supplier) => (supplier.source_type || "private") === "platform_network").length,
  };

  const visibleSuppliers = suppliers.filter((supplier) => {
    if (sourceFilter === "all") return true;
    return (supplier.source_type || "private") === sourceFilter;
  });

  return (
    <div className="su-container">
      {error && <div className="su-msg su-msg--error">❌ {error}</div>}
      {success && <div className="su-msg su-msg--success">✅ {success}</div>}
      {readOnly && (
        <div className="su-msg su-msg--error">
          Platform personeli tedarikçi portföyünü inceleyebilir; yeni tedarikçi, düzenleme, silme ve tedarikçi kullanıcısı yönetimi bu yüzeyde kapatıldı.
        </div>
      )}

      <div className="su-header">
        <h2>Tedarikçiler</h2>
        <button type="button" className="su-btn" onClick={() => setShowForm(true)} disabled={readOnly}>
          + Yeni Tedarikçi
        </button>
      </div>

      <div className="su-stats-grid">
        {[
          { key: "all", label: "Tum Kaynaklar", value: supplierSourceSummary.all },
          { key: "private", label: "Private Supplier", value: supplierSourceSummary.private },
          { key: "platform_network", label: "Platform Ağı", value: supplierSourceSummary.platform_network },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`su-stat-card su-stat-card--${item.key}${sourceFilter === item.key ? " su-stat-card--active" : ""}`}
            onClick={() => setSourceFilter(item.key as "all" | "private" | "platform_network")}
          >
            <div className="su-stat-card__label">{item.label}</div>
            <div className="su-stat-card__value">{item.value}</div>
          </button>
        ))}
      </div>

      {!readOnly && showForm && (
        <div
          className="su-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              resetInviteForm();
            }
          }}
        >
          <div className="su-modal__content">
            <div className="su-modal__hdr">
              <div>
                <h3 className="su-modal__title">Hızlı Tedarikçi Daveti</h3>
                <div className="su-modal__desc">
                  Stratejik partner burada sadece temel davet bilgisini girer. Geri kalan firma detaylarını tedarikçi magic link ile kendi tamamlar.
                </div>
              </div>
              <button
                type="button"
                className="su-modal__close"
                onClick={() => {
                  setShowForm(false);
                  resetInviteForm();
                }}
              >
                ×
              </button>
            </div>

            <form className="su-form su-form--no-mb" onSubmit={handleAddSupplier}>
              <div className="su-form-group su-form-group--full">
                <label className="su-label">Şirket Adı *</label>
                <input
                  className="su-input"
                  type="text"
                  aria-label="Şirket Adı"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Telefon *</label>
                <input
                  className="su-input"
                  type="tel"
                  aria-label="Telefon"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">E-posta *</label>
                <input
                  className="su-input"
                  type="email"
                  aria-label="E-posta"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">İl *</label>
                <select
                  className="su-select"
                  aria-label="İl *"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value, address_district: "" })}
                >
                  <option value="">İl seçin</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="su-form-group">
                <label className="su-label">İlçe *</label>
                <select
                  className="su-select"
                  aria-label="İlçe *"
                  required
                  value={formData.address_district}
                  onChange={(e) => setFormData({ ...formData, address_district: e.target.value })}
                  disabled={!formData.city}
                >
                  <option value="">İlçe seçin</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Stratejik Partner Kategorileri</label>
                <button type="button" className="su-btn" onClick={() => setShowPartnerCategoryModal(true)}>
                  Kategori Seç
                </button>
                <div className="su-cat-pills">
                  {formData.partner_category_tags.length > 0 ? formData.partner_category_tags.map((item) => (
                    <span key={item} className="su-cat-pill">{item}</span>
                  )) : <span className="su-cat-pills__empty">Henüz kategori atanmadı</span>}
                </div>
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Notlar</label>
                <textarea
                  className="su-textarea"
                  aria-label="Notlar"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="İlk temas notu, özel yönlendirme veya eşleşme bilgisi"
                />
              </div>

              <div className="su-form-actions">
                <button type="submit" className="su-btn" disabled={formLoading}>
                  {formLoading ? "Davet oluşturuluyor..." : "Davet Oluştur"}
                </button>
                <button
                  type="button"
                  className="su-btn su-btn--cancel"
                  onClick={() => {
                    setShowForm(false);
                    resetInviteForm();
                  }}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="su-table-wrap">
        <table className="su-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Firma Adı</th>
              <th>E-mail</th>
              <th>Telefon</th>
              <th>Kategori</th>
              <th>Şehir</th>
              <th>Puan</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {visibleSuppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>
                  <div className="su-logo-thumb">
                    {resolveLogoUrl(supplier.logo_url) ? (
                      <img src={resolveLogoUrl(supplier.logo_url) || ""} alt={`${supplier.company_name} logosu`} />
                    ) : (
                      <span>🏢</span>
                    )}
                  </div>
                </td>
                <td>
                  <div>{supplier.company_name}</div>
                  {supplier.dual_role_status === "active" && supplier.linked_tenant_id && (
                    <span className="su-dual-badge">Stratejik Partner</span>
                  )}
                  {supplier.dual_role_status === "pending" && supplier.linked_tenant_id && (
                    <span className="su-dual-badge su-dual-badge--pending">Partner Başvurusu</span>
                  )}
                </td>
                <td>
                  <div>{supplier.email}</div>
                  <div className={`su-src-badge ${supplier.source_type === "platform_network" ? "su-src-badge--platform" : "su-src-badge--private"}`}>
                    {supplier.source_type === "platform_network" ? "Platform Havuzu" : "Firma Tedarikçisi"}
                  </div>
                </td>
                <td>{supplier.phone}</td>
                <td>{formatSupplierCategories(supplier)}</td>
                <td>{[supplier.city, supplier.address_district].filter(Boolean).join(" / ") || "-"}</td>
                <td>⭐ {supplier.reference_score || "0"}</td>
                <td>{supplier.is_verified ? "✅ Doğrulanmış" : "⏳ Beklemede"}</td>
                <td>
                  <div className="su-actions-cell">
                    <button
                      type="button"
                      className="su-action-btn"
                      onClick={() => navigate(`/admin/suppliers/${supplier.id}`)}
                    >
                      Tedarikçiyi Görüntüle
                    </button>
                    <button
                      type="button"
                      className="su-action-btn su-action-btn--mail"
                      onClick={() => navigate(`/admin?${new URLSearchParams({ tab: "mail", mailComposeTo: supplier.email || "" }).toString()}`)}
                    >
                      Mail Merkezi {getUnreadCountForEmail(supplier.email) > 0 ? `(${getUnreadCountForEmail(supplier.email)})` : ""}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="su-action-btn su-action-btn--danger"
                        onClick={() => handleDeleteSupplier(supplier.id)}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CategorySelectionModal
        isOpen={showPartnerCategoryModal}
        title="Stratejik Partner Kategorileri"
        subtitle="Bu alan partner panelinde hızlı arama ve eşleme için kullanılır. Tedarikçi kendi profilinde ayrıca bulunmak istediği kategorileri düzenler."
        availableOptions={COMPANY_CATEGORY_OPTIONS}
        value={formData.partner_category_tags}
        maxSelectionCount={5}
        onClose={() => setShowPartnerCategoryModal(false)}
        onSave={(value) => {
          setFormData((prev) => ({ ...prev, partner_category_tags: value, category: value[0] || prev.category || "" }));
          setShowPartnerCategoryModal(false);
        }}
      />

      {/* Edit Supplier Modal */}
      {!readOnly && showEditModal && selectedSupplier && (
        <div
          className="su-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="su-modal__content">
            <div className="su-modal__hdr su-modal__hdr--mb20">
              <h3 className="su-modal__title">Tedarikçiyi Düzenle - {selectedSupplier.company_name}</h3>
              <button type="button" className="su-modal__close" onClick={() => setShowEditModal(false)}>×</button>
            </div>

            {error && <div className="su-msg su-msg--error">❌ {error}</div>}

            <form className="su-form" onSubmit={handleSaveEditSupplier}>
              <div className="su-form-group su-form-group--full">
                <label className="su-label">Şirket Adı *</label>
                <input
                  className="su-input"
                  type="text"
                  required
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Ünvanı</label>
                <input
                  className="su-input"
                  type="text"
                  aria-label="Ünvanı"
                  value={editForm.company_title}
                  onChange={(e) => setEditForm({ ...editForm, company_title: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Vergi Numarası</label>
                <input
                  className="su-input"
                  type="text"
                  aria-label="Vergi Numarası"
                  value={editForm.tax_number}
                  onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Telefon</label>
                <input
                  className="su-input"
                  type="tel"
                  aria-label="Telefon"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">E-mail</label>
                <input
                  className="su-input"
                  type="email"
                  aria-label="E-mail"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Web Sitesi</label>
                <input
                  className="su-input"
                  type="url"
                  aria-label="Web Sitesi"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                />
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Adres</label>
                <textarea
                  className="su-textarea"
                  aria-label="Adres"
                  rows={3}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Şehir</label>
                <input
                  className="su-input"
                  type="text"
                  aria-label="Şehir"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Posta Kodu</label>
                <input
                  className="su-input"
                  type="text"
                  aria-label="Posta Kodu"
                  value={editForm.postal_code}
                  onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                />
              </div>

              <div className="su-form-group">
                <label className="su-label">Kategori</label>
                <select
                  className="su-select"
                  aria-label="Kategori"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  <option value="">-- Seç --</option>
                  <option value="Yazılım">💻 Yazılım</option>
                  <option value="Donanım">🖥️ Donanım</option>
                  <option value="Hizmet">🔧 Hizmet</option>
                  <option value="Danışmanlık">📋 Danışmanlık</option>
                  <option value="Muhasebe">📊 Muhasebe</option>
                  <option value="İnsan Kaynakları">👥 İnsan Kaynakları</option>
                </select>
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Notlar</label>
                <textarea
                  className="su-textarea"
                  aria-label="Notlar"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              <div className="su-form-actions">
                <button type="submit" className="su-btn" disabled={formLoading}>
                  {formLoading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
                <button type="button" className="su-btn su-btn--cancel" onClick={() => setShowEditModal(false)}>
                  İptal
                </button>
              </div>
            </form>

            {/* Supplier Users Section */}
            <div className="su-users">
              <div className="su-users__hdr">
                <h4>Firma Kullanıcıları ({supplierUsers.length})</h4>
                <div className="su-users__hdr-actions">
                  <button
                    type="button"
                    className="su-btn su-btn--sm su-btn--mail"
                    onClick={() => navigate("/admin?tab=mail")}
                  >
                    Mail Merkezi {totalUnreadMailCount > 0 ? `(${totalUnreadMailCount})` : ""}
                  </button>
                  <button type="button" className="su-btn su-btn--sm" onClick={() => setShowUserModal(true)}>
                    + Kullanıcı Ekle
                  </button>
                </div>
              </div>

              {usersLoading ? (
                <div className="su-users__loading">Yükleniyor...</div>
              ) : supplierUsers.length === 0 ? (
                <div className="su-users__empty">Kullanıcı bulunamadı</div>
              ) : (
                <table className="su-table">
                  <thead>
                    <tr>
                      <th>Ad</th>
                      <th>Email</th>
                      <th>Telefon</th>
                      <th className="su-td--center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name} {user.is_default ? "⭐" : ""}</td>
                        <td>{user.email}{user.email_verified ? " ✅" : " ⏳"}</td>
                        <td>{user.phone || "-"}</td>
                        <td className="su-td--center">
                          <div className="su-actions-cell su-actions-cell--center">
                            {!user.is_default && (
                              <button
                                type="button"
                                className="su-action-btn su-action-btn--amber"
                                onClick={() => handleSetDefaultSupplierUser(user.id)}
                              >
                                Varsayılan Yap
                              </button>
                            )}
                            <button
                              type="button"
                              className="su-action-btn"
                              onClick={() => handleEditSupplierUser(user)}
                              disabled={!!user.is_default}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="su-action-btn su-action-btn--danger"
                              onClick={() => handleDeleteSupplierUser(user.id)}
                              disabled={!!user.is_default}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {!readOnly && showUserModal && selectedSupplier && (
        <div
          className="su-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUserModal(false);
          }}
        >
          <div className="su-modal__content">
            <div className="su-modal__hdr su-modal__hdr--mb20">
              <h3 className="su-modal__title">Kullanıcı Ekle - {selectedSupplier.company_name}</h3>
              <button type="button" className="su-modal__close" onClick={() => setShowUserModal(false)}>×</button>
            </div>

            {error && <div className="su-msg su-msg--error">❌ {error}</div>}

            <p className="su-modal__hint">
              Magic link (sihirli bağlantı) kendisinin email adresine gönderilecektir.
            </p>

            <form className="su-form" onSubmit={handleAddSupplierUser}>
              <div className="su-form-group su-form-group--full">
                <label className="su-label">Adı *</label>
                <input
                  className="su-input"
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                />
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">E-mail *</label>
                <input
                  className="su-input"
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Telefon</label>
                <input
                  className="su-input"
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                />
              </div>

              <div className="su-form-actions">
                <button type="submit" className="su-btn" disabled={formLoading}>
                  {formLoading ? "⏳ Gönderiliyor..." : "✅ Email'i Gönder"}
                </button>
                <button type="button" className="su-btn su-btn--cancel" onClick={() => setShowUserModal(false)}>
                  ❌ İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier User Modal */}
      {!readOnly && showUserEditModal && selectedSupplier && selectedSupplierUser && (
        <div
          className="su-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUserEditModal(false);
          }}
        >
          <div className="su-modal__content">
            <div className="su-modal__hdr su-modal__hdr--mb20">
              <h3 className="su-modal__title">Kullanıcıyı Düzenle - {selectedSupplierUser.name}</h3>
              <button type="button" className="su-modal__close" onClick={() => setShowUserEditModal(false)}>×</button>
            </div>

            {error && <div className="su-msg su-msg--error">❌ {error}</div>}

            <form className="su-form" onSubmit={handleSaveEditSupplierUser}>
              <div className="su-form-group su-form-group--full">
                <label className="su-label">Ad *</label>
                <input
                  className="su-input"
                  type="text"
                  required
                  value={userEditForm.name}
                  onChange={(e) => setUserEditForm({ ...userEditForm, name: e.target.value })}
                />
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Email *</label>
                <input
                  className="su-input"
                  type="email"
                  required
                  value={userEditForm.email}
                  onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                />
              </div>

              <div className="su-form-group su-form-group--full">
                <label className="su-label">Telefon</label>
                <input
                  className="su-input"
                  type="tel"
                  value={userEditForm.phone}
                  onChange={(e) => setUserEditForm({ ...userEditForm, phone: e.target.value })}
                />
              </div>

              <div className="su-form-actions">
                <button type="submit" className="su-btn" disabled={formLoading}>
                  {formLoading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
                <button type="button" className="su-btn su-btn--cancel" onClick={() => setShowUserEditModal(false)}>
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
