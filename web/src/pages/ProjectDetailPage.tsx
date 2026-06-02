import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProjects, getProjectFiles, uploadProjectFile, deleteProjectFile, deleteProject, updateProject, getProjectSuppliers, removeProjectTenantUser, type ProjectSupplierItem } from "../services/project.service";
import { getRfqs } from "../services/quotes.service";
import { getSupplierQuotesGrouped, type SupplierQuoteRevision } from "../services/quote.service";
import { getCompanies, getTenantUsers } from "../services/admin.service";
import { QuoteTab } from "../components/QuoteTab";
import { ProjectSuppliersModal } from "../components/ProjectSuppliersModal";
import { isPlatformStaffUser } from "../auth/permissions";
import { useAuth } from "../hooks/useAuth";
import { getAccessToken } from "../lib/token";
import "../styles/modal.css";
import "./ProjectDetailPage.css";
import type { Project, ProjectFile } from "../types/project";
import type { Quote } from "../types/quote";
import type { Company } from "../services/admin.service";
import { SUBSCRIPTION_ADDON_CTA_LABEL, SUBSCRIPTION_UPGRADE_CTA_LABEL, getSubscriptionAddonHref, getSubscriptionLimitGuidanceMessage, getSubscriptionUpgradeHref, hasSubscriptionUpgradeGuidance } from "../utils/subscriptionLimitErrors";

type SupplierOfferSummary = {
  quoteId: number;
  quoteTitle: string;
  supplierQuoteId: number;
  status: string;
  currency?: string;
  totalAmount: number;
  initialAmount: number;
  submittedAt?: string;
  revisionNumber: number;
};

const normalizeCurrency = (value?: string | null): "TRY" | "USD" | "EUR" => {
  const raw = String(value || "TRY").toUpperCase();
  if (raw === "TL" || raw === "TRL") return "TRY";
  if (raw === "USDT") return "USD";
  if (raw === "USD" || raw === "EUR") return raw;
  return "TRY";
};

const formatMoney = (amount: number, currency?: string) =>
  Number(amount || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: normalizeCurrency(currency),
  });

function getLatestRevisionNode(node: SupplierQuoteRevision): SupplierQuoteRevision {
  if (!node.revisions || node.revisions.length === 0) return node;
  return node.revisions.reduce((latest, current) => {
    const latestNode = getLatestRevisionNode(latest);
    const currentNode = getLatestRevisionNode(current);
    return currentNode.revision_number > latestNode.revision_number ? currentNode : latestNode;
  });
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = parseInt(id || "0");
  const readOnly = isPlatformStaffUser(user);

  const [project, setProject] = useState<Project | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: number; full_name: string; role?: string; company_assignments?: Array<{ company_id: number; is_active: boolean }> }>>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projectSuppliers, setProjectSuppliers] = useState<ProjectSupplierItem[]>([]);
  const [supplierOffersBySupplierId, setSupplierOffersBySupplierId] = useState<Record<number, SupplierOfferSummary[]>>({});

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const [fileActionError, setFileActionError] = useState<string | null>(null);

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsData, companiesData, usersData] = await Promise.all([
        getProjects(),
        getCompanies(),
        getTenantUsers().catch(() => []),
      ]);

      setCompanies(companiesData);
      setTenantUsers(usersData as typeof tenantUsers);
      const found = projectsData.find((p) => p.id === projectId);
      setProject(found || null);
      if (found) {
        setEditData(found);
      }

      if (found) {
        const projectFiles = await getProjectFiles(projectId);
        setFiles(projectFiles);
        const suppliers = await getProjectSuppliers(projectId).catch(() => []);
        setProjectSuppliers(suppliers);

        const allQuotes = await getRfqs().catch(() => []);
        const projectQuotes = allQuotes.filter((q: Quote) => q.project_id === projectId);

        const groupedResponses = await Promise.all(
          projectQuotes.map(async (q: Quote) => ({
            quote: q,
            groups: await getSupplierQuotesGrouped(q.id).catch(() => []),
          }))
        );

        const offersMap: Record<number, SupplierOfferSummary[]> = {};
        for (const row of groupedResponses) {
          for (const group of row.groups) {
            if (!group.quotes || group.quotes.length === 0) continue;
            const baseLatest = group.quotes.reduce((latest, current) => {
              const latestNode = getLatestRevisionNode(latest);
              const currentNode = getLatestRevisionNode(current);
              return currentNode.revision_number > latestNode.revision_number ? current : latest;
            });
            const latestQuote = getLatestRevisionNode(baseLatest);
            const summary: SupplierOfferSummary = {
              quoteId: row.quote.id,
              quoteTitle: row.quote.title,
              supplierQuoteId: latestQuote.id,
              status: latestQuote.status,
              currency: latestQuote.currency,
              totalAmount: Number(latestQuote.total_amount || 0),
              initialAmount: Number(latestQuote.initial_final_amount || latestQuote.total_amount || 0),
              submittedAt: latestQuote.submitted_at,
              revisionNumber: latestQuote.revision_number,
            };
            if (!offersMap[group.supplier_id]) {
              offersMap[group.supplier_id] = [];
            }
            offersMap[group.supplier_id].push(summary);
          }
        }

        Object.keys(offersMap).forEach((supplierId) => {
          offersMap[Number(supplierId)].sort((a, b) => b.quoteId - a.quoteId);
        });
        setSupplierOffersBySupplierId(offersMap);

        if (found.project_type === "franchise") {
          const approvedQuotes = projectQuotes.filter(
            (q: Quote) => q.project_id === projectId && q.status === "APPROVED"
          );
          setQuotes(approvedQuotes);
        }
      }
    } catch (error) {
      console.error("Proje yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  async function handleRemoveResponsible(userId: number) {
    if (readOnly) return;
    if (!confirm("Bu personeli projeden çıkarmak istiyor musunuz?")) return;
    try {
      await removeProjectTenantUser(projectId, userId);
      await loadProjectData();
    } catch (error) {
      console.error("Proje sorumlusu kaldırma hatası:", error);
      alert("Sorumlu kaldırılamadı");
    }
  }

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  async function handleDelete() {
    if (readOnly) return;
    if (!confirm("Projeyi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteProject(projectId);
      navigate("/admin?tab=projects");
    } catch (error) {
      console.error("Proje silme hatası:", error);
      alert("Proje silinemedi!");
    }
  }

  async function handleUpdate() {
    if (readOnly) return;
    if (!project) return;
    try {
      setEditLoading(true);
      await updateProject(projectId, editData);
      setProject({ ...project, ...editData });
      setShowEditModal(false);
      alert("Proje güncellendi!");
    } catch (error) {
      console.error("Proje güncelleme hatası:", error);
      alert("Proje güncellenemedi!");
    } finally {
      setEditLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setFileActionError(null);
      await uploadProjectFile(projectId, file);
      await loadProjectData();
      e.target.value = "";
    } catch (error) {
      console.error("Dosya yükleme hatası:", error);
      setFileActionError(getSubscriptionLimitGuidanceMessage(error, "Dosya yuklenemedi"));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (readOnly) return;
    if (!confirm("Dosyayı silmek istediğinize emin misiniz?")) return;

    try {
      await deleteProjectFile(fileId);
      await loadProjectData();
    } catch (error) {
      console.error("Dosya silme hatası:", error);
    }
  };

  if (loading) return <div className="pdp-centered">Yükleniyor...</div>;
  if (!project) return <div className="pdp-centered pdp-centered--error">Proje bulunamadı</div>;

  const isImage = (file: ProjectFile) =>
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.file_type);

  const getFileIcon = (file: ProjectFile) => {
    const filename = file.original_filename.toLowerCase();
    if (filename.endsWith(".pdf")) return "📕";
    if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) return "📊";
    if (filename.endsWith(".docx") || filename.endsWith(".doc")) return "📄";
    if (filename.endsWith(".zip")) return "📦";
    if (filename.endsWith(".rar")) return "📦";
    if (isImage(file)) return "🖼️";
    return "📎";
  };

  const getThumbnail = (file: ProjectFile) => {
    if (isImage(file)) {
      return (
        <img
          src={`/api/v1/files/${file.id}/thumbnail`}
          alt={file.original_filename}
          className="pdp-thumb-img"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      );
    }
    return (
      <div className="pdp-file-icon">
        {getFileIcon(file)}
      </div>
    );
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const token = getAccessToken();
      console.log("Download token:", token ? "Present" : "Missing");
      const response = await fetch(`/api/v1/files/${file.id}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        console.error("Download response not ok:", response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Dosya indirme hatası:", error);
      alert(`Dosya indirilirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    }
  };

  const handleOpenFile = async (file: ProjectFile) => {
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/v1/files/${file.id}/open`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        handleDownload(file);
        return;
      }
    } catch (error) {
      console.error("Dosya açma hatası:", error);
      handleDownload(file);
    }
  };

  const getCompanyName = (companyId?: number) => {
    return companies.find((c) => c.id === companyId)?.name || "Firma yok";
  };

  return (
    <div className="pdp-page">
      {fileActionError ? (
        <div className="pdp-file-error">
          <div>{fileActionError}</div>
          {hasSubscriptionUpgradeGuidance(fileActionError) ? (
            <div className="pdp-cta-row">
              <a href={getSubscriptionUpgradeHref(fileActionError)} className="pdp-cta-link">
                {SUBSCRIPTION_UPGRADE_CTA_LABEL}
              </a>
              <a href={getSubscriptionAddonHref(fileActionError)} className="pdp-cta-link pdp-cta-link--dark">
                {SUBSCRIPTION_ADDON_CTA_LABEL}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Header - Back Button */}
      <button
        type="button"
        onClick={() => navigate("/admin?tab=projects")}
        className="pdp-back-btn"
      >
        ← Geri Dön
      </button>

      {/* Proje Header Card */}
      <div className="pdp-card pdp-card--mb">
        {readOnly && (
          <div className="pdp-readonly-banner">
            Bu proje sayfasi platform personeli icin salt okunur durumdadir.
          </div>
        )}

        <h1 className="pdp-company-title">
          {getCompanyName(project.company_id)}
        </h1>

        {/* Info Grid */}
        <div className="pdp-info-grid">
          <div>
            <p className="pdp-info-label">Proje Adı</p>
            <p className="pdp-info-value">{project.name}</p>
          </div>

          <div>
            <p className="pdp-info-label">Tür</p>
            <span className={project.project_type === "franchise" ? "pdp-type-badge pdp-type-badge--franchise" : "pdp-type-badge pdp-type-badge--merkez"}>
              {project.project_type === "franchise" ? "🍕 Franchise" : "🏢 Merkez"}
            </span>
          </div>

          <div>
            <p className="pdp-info-label">Kod</p>
            <p className="pdp-info-value">{project.code}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pdp-action-row">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="ms-btn ms-btn--primary ms-btn--auto-flex"
              >
                ✏️ Düzenle
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="ms-btn ms-btn--danger ms-btn--auto-flex"
              >
                🗑️ Sil
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const companyName = getCompanyName(project.company_id);
              const message = `🏢 ${companyName}\n📌 ${project.name}\n👤 ${project.manager_name || "Belirtilmemiş"}\n ${project.manager_phone || "Tel yok"}\n📮 ${project.address || "Adres belirtilmemiş"}`;
              const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
              window.open(url, "_blank");
            }}
            className="pdp-btn-whatsapp"
          >
            💬 WhatsApp Paylaş
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowSuppliersModal(true)}
              className="pdp-btn-suppliers"
            >
              📧 Projeye Tedarikçi Ekle
            </button>
          )}
        </div>
      </div>

      {/* Satın Alma Sorumluları */}
      <div className="pdp-card pdp-card--mb">
        <h3 className="pdp-section-h3">👥 Satın Alma Sorumluları</h3>
        {project.created_by_id ? (
          <div className="pdp-creator-note">
            Projeyi olusturan kullanici sistem tarafinda otomatik eklenir ve "Proje olusturan" etiketi ile gosterilir.
          </div>
        ) : null}

        {project.personnel && project.personnel.length > 0 ? (
          <div className="pdp-pill-row">
            {project.personnel.map((member) => (
              <div key={member.id} className="pdp-pill">
                <span>{member.full_name}</span>
                {member.role ? (
                  <span className="pdp-pill-role">{member.role}</span>
                ) : null}
                {project.created_by_id === member.id ? (
                  <span className="pdp-pill-creator">Proje olusturan</span>
                ) : null}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveResponsible(member.id)}
                    className="pdp-pill-remove"
                    title="Projeden çıkar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="pdp-empty-text">
            Bu projeye henüz satın alma sorumlusu atanmadı.
          </p>
        )}

        {!readOnly && (
          <div className="pdp-assign-wrap">
            <select
              aria-label="Sorumlu ekle"
              onChange={async (e) => {
                const userId = parseInt(e.target.value);
                if (!userId) return;
                try {
                  const { addProjectTenantUser } = await import("../services/project.service");
                  await addProjectTenantUser(projectId, userId);
                  await loadProjectData();
                } catch { /* ignore */ }
              }}
            >
              <option value="">Sorumlu seç...</option>
              {tenantUsers
                .filter((u) => {
                  if (!project?.company_id) return false;
                  return Boolean(
                    u.company_assignments?.some(
                      (ca) => ca.company_id === project.company_id && ca.is_active,
                    ),
                  );
                })
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Proje Bilgileri - Grid */}
      <div className="pdp-two-col-grid">
        {/* Card 1: Genel Bilgiler */}
        <div className="pdp-card">
          <h3 className="pdp-section-h3">📊 Genel Bilgiler</h3>
          {project.budget && (
            <p className="pdp-info-p">
              <strong>Bütçe:</strong> {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(project.budget)}
            </p>
          )}
          {project.description && (
            <p className="pdp-info-p">
              <strong>Açıklama:</strong> {project.description}
            </p>
          )}
          <p className="pdp-info-p pdp-info-p--last">
            <strong>Aktif:</strong> {project.is_active ? "✅ Evet" : "❌ Hayır"}
          </p>
        </div>

        {/* Card 2: Yetkili Bilgileri */}
        <div className="pdp-card">
          <h3 className="pdp-section-h3">👤 Yetkili Bilgileri</h3>
          {(project.manager_name || project.manager_phone) ? (
            <div className="pdp-manager-info">
              {project.manager_name && (
                <p className="pdp-info-p">
                  <strong>Adı Soyadı:</strong> {project.manager_name}
                </p>
              )}
              {project.manager_phone && (
                <p className="pdp-phone-p">
                  <strong>Telefon:</strong> {project.manager_phone}
                  <a href={`tel:${project.manager_phone}`} className="pdp-ara-link">
                    📞 Ara
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="pdp-no-info">Yetkili bilgisi kayıtlı değil</p>
          )}
        </div>
      </div>

      {/* Adres */}
      {project.address && (
        <div className="pdp-card pdp-card--mb">
          <h3 className="pdp-section-h3">📍 Adres</h3>
          <p className="pdp-info-p">{project.address}</p>
          {project.latitude && project.longitude && (
            <div className="pdp-map-wrapper">
              <iframe
                width="100%"
                height="100%"
                className="pdp-map-iframe"
                loading="lazy"
                allowFullScreen
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBaXW3jHmQX3Q6K5Z9Y0L2M0N1O2P3Q4R&q=${encodeURIComponent(project.address)}`}
              />
            </div>
          )}

          <div className="pdp-suppliers-sub">
            <h4 className="pdp-suppliers-h4">Projeye Eklenen Tedarikçiler</h4>
            {projectSuppliers.length === 0 ? (
              <p className="pdp-empty-text pdp-empty-text--no-margin">Henüz tedarikçi eklenmemiş.</p>
            ) : (
              <div className="pdp-suppliers-grid">
                {projectSuppliers.map((ps) => (
                  <div key={ps.id} className={`pdp-supplier-card${ps.is_active ? " pdp-supplier-card--active" : ""}`}>
                    <div className="pdp-supplier-header-row">
                      <span className="pdp-supplier-name">{ps.supplier_name}</span>
                      <span className={ps.is_active ? "pdp-status-badge pdp-status-badge--active" : "pdp-status-badge"}>
                        {ps.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div className="pdp-offers-grid">
                      {(supplierOffersBySupplierId[ps.supplier_id] || []).length === 0 ? (
                        <span className="pdp-empty-text">Henüz gelen teklif yok.</span>
                      ) : (
                        (supplierOffersBySupplierId[ps.supplier_id] || []).map((offer) => (
                          <div key={`${ps.supplier_id}-${offer.quoteId}-${offer.supplierQuoteId}`} className="pdp-offer-card">
                            <div className="pdp-offer-header-row">
                              <div className="pdp-offer-content">
                                <div className="pdp-offer-title">{offer.quoteTitle}</div>
                                <div className="pdp-offer-amount">
                                  {offer.revisionNumber > 0 && offer.initialAmount > 0 ? (
                                    <>
                                      <span className="pdp-offer-amount__label">İlk Teklif: </span>
                                      <span className="pdp-offer-amount__strikethrough">
                                        {formatMoney(offer.initialAmount, offer.currency)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span>Gelen teklif: </span>
                                      {formatMoney(Number(offer.totalAmount || 0), offer.currency)}
                                    </>
                                  )}
                                </div>
                                {offer.revisionNumber > 0 && offer.initialAmount > 0 && (
                                  <div className="pdp-offer-revision">
                                    <div className="pdp-offer-revision__label">
                                      Revize Teklif {offer.revisionNumber}: {formatMoney(Number(offer.totalAmount || 0), offer.currency)}
                                    </div>
                                    {offer.totalAmount < offer.initialAmount && (
                                      <div className="pdp-discount-badge">
                                        ▼ İndirim: {formatMoney((offer.initialAmount - offer.totalAmount), offer.currency)}
                                        {" "}(%{((offer.initialAmount - offer.totalAmount) / offer.initialAmount * 100).toFixed(1)})
                                      </div>
                                    )}
                                    {offer.totalAmount > offer.initialAmount && (
                                      <div className="pdp-increase-badge">
                                        ▲ Artış: {formatMoney((offer.totalAmount - offer.initialAmount), offer.currency)}
                                        {" "}(%{((offer.totalAmount - offer.initialAmount) / offer.initialAmount * 100).toFixed(1)})
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="pdp-offer-status">{offer.status}</span>
                            </div>
                            <div className="pdp-offer-footer">
                              <span className="pdp-offer-date">
                                {offer.submittedAt ? new Date(offer.submittedAt).toLocaleString("tr-TR") : "Tarih bilgisi yok"}
                              </span>
                              <div className="pdp-offer-actions">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/quotes/${offer.quoteId}?supplierQuoteId=${offer.supplierQuoteId}`)}
                                  className="pdp-btn-view"
                                >
                                  Göster
                                </button>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/quotes/${offer.quoteId}?supplierQuoteId=${offer.supplierQuoteId}&action=revize`)}
                                    className="pdp-btn-revize"
                                  >
                                    Revize
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dosyalar */}
      <div className="pdp-card pdp-card--mb">
        <h3 className="pdp-section-h3">📁 Proje Dosyaları</h3>

        {!readOnly && (
          <label className="pdp-upload-label">
            <input type="file" onChange={handleFileUpload} disabled={uploading} className="pdp-file-input-hidden" />
            {uploading ? (
              <p className="pdp-uploading-p">⏳ Yükleniyor...</p>
            ) : (
              <>
                <p className="pdp-upload-title">📤 Dosya Yükle</p>
                <p className="pdp-upload-hint">
                  Zip (500MB), Rar (500MB), JPEG, PNG, GIF, PDF, Excel, Word vb. desteklenir
                </p>
              </>
            )}
          </label>
        )}

        {files.length > 0 ? (
          <div className="pdp-files-list">
            {files.map((file) => (
              <div key={file.id} className="pdp-file-row">
                {getThumbnail(file)}
                <div className="pdp-file-info">
                  <p className="pdp-file-name">{file.original_filename}</p>
                  <p className="pdp-file-size">{(file.file_size / 1024).toFixed(2)} KB</p>
                </div>
                <div className="pdp-file-actions">
                  <button
                    type="button"
                    onClick={() => handleOpenFile(file)}
                    className="pdp-btn-open"
                  >
                    👁️ Aç
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="pdp-btn-download"
                  >
                    ⬇️ İndir
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file.id)}
                      className="pdp-btn-file-del"
                    >
                      🗑️ Sil
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="pdp-empty-text">Henüz dosya yüklenilmedi</p>
        )}

        <button
          type="button"
          onClick={() => navigate(`/admin/project-files/${projectId}`)}
          className="pdp-btn-all-files"
        >
          📂 Tüm Dosyaları Göster
        </button>
      </div>

      {/* Onaylanan Teklifler */}
      {project.project_type === "franchise" && (
        <div className="pdp-card">
          <button
            type="button"
            onClick={() => setShowQuotes(!showQuotes)}
            className="pdp-toggle-btn"
          >
            <span>💰 Onaylanan Teklifler ({quotes.length})</span>
            <span>{showQuotes ? "▼" : "▶"}</span>
          </button>

          {showQuotes && (
            <div className="pdp-quotes-body">
              {quotes.length > 0 ? (
                <div className="pdp-quotes-list">
                  {quotes.map((quote: Quote) => (
                    <div key={quote.id} className="pdp-quote-card">
                      <p className="pdp-quote-title">{quote.title}</p>
                      <p className="pdp-quote-amount">
                        Miktar:{" "}
                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                          Number(quote.amount || 0)
                        )}
                      </p>
                      <p className="pdp-quote-desc">{quote.description}</p>
                    </div>
                  ))}

                  <div className="pdp-quotes-total">
                    Toplam Maliyet:{" "}
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                      Number(quotes.reduce((sum: number, q: Quote) => sum + (q.amount || 0), 0))
                    )}
                  </div>
                </div>
              ) : (
                <p className="pdp-empty-text">Onaylanan teklif bulunmuyor</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quote Tab */}
      {project && user && (
        <div className="pdp-quote-tab-wrap">
          <QuoteTab
            projectId={projectId}
            apiUrl={import.meta.env.VITE_API_URL || "http://localhost:8000"}
            authToken={getAccessToken() || ""}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Project Suppliers Modal */}
      {!readOnly && showSuppliersModal && (
        <ProjectSuppliersModal
          projectId={projectId}
          onClose={() => setShowSuppliersModal(false)}
          onSuccess={() => {
            loadProjectData();
          }}
        />
      )}

      {/* Edit Modal */}
      {!readOnly && showEditModal && (
        <div className="ms-backdrop">
          <div className="ms-container">
            <div className="ms-header">
              <h2 className="ms-title">✏️ Proje Düzenle</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="ms-close-btn">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdate();
              }}
              className="ms-content"
            >
              <div className="ms-grid">
                <div>
                  <label className="ms-label">Proje Adı</label>
                  <input
                    type="text"
                    value={editData.name || ""}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="ms-input"
                  />
                </div>
                <div>
                  <label className="ms-label">Proje Kodu</label>
                  <input
                    type="text"
                    value={editData.code || ""}
                    onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                    className="ms-input"
                  />
                </div>
              </div>

              <div className="ms-grid">
                <div>
                  <label className="ms-label">Yetkilisi</label>
                  <input
                    type="text"
                    value={editData.manager_name || ""}
                    onChange={(e) => setEditData({ ...editData, manager_name: e.target.value })}
                    className="ms-input"
                  />
                </div>
                <div>
                  <label className="ms-label">Telefon</label>
                  <input
                    type="tel"
                    value={editData.manager_phone || ""}
                    onChange={(e) => setEditData({ ...editData, manager_phone: e.target.value })}
                    className="ms-input"
                  />
                </div>
              </div>

              <div className="ms-full-width">
                <label className="ms-label">Adres</label>
                <textarea
                  value={editData.address || ""}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  rows={2}
                  className="ms-textarea"
                />
              </div>

              <div className="ms-full-width">
                <label className="ms-label">Bütçe</label>
                <input
                  type="number"
                  value={editData.budget || ""}
                  onChange={(e) => setEditData({ ...editData, budget: parseFloat(e.target.value) })}
                  step="0.01"
                  min="0"
                  className="ms-input"
                />
              </div>

              <div className="ms-footer">
                <button
                  type="submit"
                  disabled={editLoading}
                  className={editLoading ? "ms-btn ms-btn--primary ms-btn--disabled" : "ms-btn ms-btn--primary"}
                >
                  {editLoading ? "⏳ Kaydediliyor..." : "✅ Güncelle"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="ms-btn ms-btn--secondary"
                >
                  ❌ İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
