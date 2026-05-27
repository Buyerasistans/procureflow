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

  // Proje ve dosyaları yükle
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

        // Eğer Franchise ise teklifleri yükle
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

  if (loading) return <div style={{ textAlign: "center", padding: "32px" }}>Yükleniyor...</div>;
  if (!project) return <div style={{ textAlign: "center", padding: "32px", color: "red" }}>Proje bulunamadı</div>;

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
          style={{
            width: "60px",
            height: "60px",
            objectFit: "cover",
            borderRadius: "4px",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      );
    }
    return (
      <div
        style={{
          width: "60px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f0f0f0",
          borderRadius: "4px",
          fontSize: "32px",
        }}
      >
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
        // Eğer hatarsa indir
        handleDownload(file);
        return;
      }
    } catch (error) {
      console.error("Dosya açma hatası:", error);
      // Fallback: indir
      handleDownload(file);
    }
  };

  const getCompanyName = (companyId?: number) => {
    return companies.find((c) => c.id === companyId)?.name || "Firma yok";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {fileActionError ? (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff5f5", color: "#991b1b", fontWeight: 600, display: "grid", gap: 10 }}>
          <div>{fileActionError}</div>
          {hasSubscriptionUpgradeGuidance(fileActionError) ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={getSubscriptionUpgradeHref(fileActionError)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#991b1b", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                {SUBSCRIPTION_UPGRADE_CTA_LABEL}
              </a>
              <a href={getSubscriptionAddonHref(fileActionError)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", padding: "8px 12px", borderRadius: 10, background: "#7c2d12", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                {SUBSCRIPTION_ADDON_CTA_LABEL}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* Header - Back Button */}
      <button
        onClick={() => navigate("/admin?tab=projects")}
        style={{
          marginBottom: "20px",
          padding: "8px 16px",
          backgroundColor: "#f0f0f0",
          border: "1px solid #ddd",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
        }}
      >
        ← Geri Dön
      </button>

      {/* Proje Header Card */}
      <div
        style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
          marginBottom: "24px",
        }}
      >
        {readOnly && (
          <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "12px", background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }}>
            Bu proje sayfasi platform personeli icin salt okunur durumdadir.
          </div>
        )}
        {/* Title - Firma Adı */}
        <h1 style={{ fontSize: "28px", fontWeight: "bold", margin: "0 0 16px 0", color: "#333" }}>
          {getCompanyName(project.company_id)}
        </h1>

        {/* Info Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {/* Proje Adı */}
          <div>
            <p style={{ fontSize: "12px", color: "#999", fontWeight: "bold", margin: "0 0 4px 0", textTransform: "uppercase" }}>
              Proje Adı
            </p>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#333", margin: "0" }}>
              {project.name}
            </p>
          </div>

          {/* Proje Tipi */}
          <div>
            <p style={{ fontSize: "12px", color: "#999", fontWeight: "bold", margin: "0 0 4px 0", textTransform: "uppercase" }}>
              Tür
            </p>
            <span
              style={{
                display: "inline-block",
                fontSize: "12px",
                padding: "6px 12px",
                borderRadius: "4px",
                backgroundColor: project.project_type === "franchise" ? "#f3e5f5" : "#e3f2fd",
                color: project.project_type === "franchise" ? "#7b1fa2" : "#1976d2",
                fontWeight: "bold",
              }}
            >
              {project.project_type === "franchise" ? "🍕 Franchise" : "🏢 Merkez"}
            </span>
          </div>

          {/* Kod */}
          <div>
            <p style={{ fontSize: "12px", color: "#999", fontWeight: "bold", margin: "0 0 4px 0", textTransform: "uppercase" }}>
              Kod
            </p>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#333", margin: "0" }}>
              {project.code}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
          {!readOnly && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="ms-btn ms-btn--primary ms-btn--auto-flex"
              >
                ✏️ Düzenle
              </button>
              <button
                onClick={handleDelete}
                className="ms-btn ms-btn--danger ms-btn--auto-flex"
              >
                🗑️ Sil
              </button>
            </>
          )}
          <button
            onClick={() => {
              const companyName = getCompanyName(project.company_id);
              const message = `🏢 ${companyName}\n📌 ${project.name}\n👤 ${project.manager_name || "Belirtilmemiş"}\n ${project.manager_phone || "Tel yok"}\n📮 ${project.address || "Adres belirtilmemiş"}`;
              const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
              window.open(url, "_blank");
            }}
            style={{
              padding: "10px 16px",
              backgroundColor: "#25D366",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              flex: "0 1 auto",
            }}
          >
            💬 WhatsApp Paylaş
          </button>
          {!readOnly && (
            <button
              onClick={() => setShowSuppliersModal(true)}
              style={{
                padding: "10px 16px",
                backgroundColor: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
                flex: "0 1 auto",
              }}
            >
              📧 Projeye Tedarikçi Ekle
            </button>
          )}
        </div>
      </div>

      {/* Satın Alma Sorumluları */}
      <div
        style={{
          backgroundColor: "white",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
          👥 Satın Alma Sorumluları
        </h3>
        {project.created_by_id ? (
          <div style={{ marginBottom: "12px", fontSize: "12px", color: "#64748b" }}>
            Projeyi olusturan kullanici sistem tarafinda otomatik eklenir ve "Proje olusturan" etiketi ile gosterilir.
          </div>
        ) : null}

        {project.personnel && project.personnel.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {project.personnel.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  backgroundColor: "#eef2ff",
                  color: "#3730a3",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <span>{member.full_name}</span>
                {member.role ? (
                  <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#ede9fe", color: "#6d28d9", fontSize: "11px", fontWeight: 700 }}>
                    {member.role}
                  </span>
                ) : null}
                {project.created_by_id === member.id ? (
                  <span style={{ padding: "2px 8px", borderRadius: "999px", backgroundColor: "#dbeafe", color: "#1d4ed8", fontSize: "11px", fontWeight: 700 }}>
                    Proje olusturan
                  </span>
                ) : null}
                {!readOnly && <button
                  onClick={() => handleRemoveResponsible(member.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  title="Projeden çıkar"
                >
                  ×
                </button>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
            Bu projeye henüz satın alma sorumlusu atanmadı.
          </p>
        )}

        {/* Personnel assignment select for tenant admin */}
        {!readOnly && (
          <div style={{ marginTop: "12px" }}>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {/* Card 1: Genel Bilgiler */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
            📊 Genel Bilgiler
          </h3>
          {project.budget && (
            <p style={{ marginBottom: "8px", fontSize: "13px" }}>
              <strong>Bütçe:</strong> {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(project.budget)}
            </p>
          )}
          {project.description && (
            <p style={{ marginBottom: "8px", fontSize: "13px" }}>
              <strong>Açıklama:</strong> {project.description}
            </p>
          )}
          <p style={{ marginBottom: "0", fontSize: "13px" }}>
            <strong>Aktif:</strong> {project.is_active ? "✅ Evet" : "❌ Hayır"}
          </p>
        </div>

        {/* Card 2: Yetkilisi Bilgileri */}
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
            👤 Yetkili Bilgileri
          </h3>
          {(project.manager_name || project.manager_phone) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {project.manager_name && (
                <p style={{ marginBottom: "0", fontSize: "13px" }}>
                  <strong>Adı Soyadı:</strong> {project.manager_name}
                </p>
              )}
              {project.manager_phone && (
                <p style={{ marginBottom: "0", fontSize: "13px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <strong>Telefon:</strong> {project.manager_phone}
                  <a
                    href={`tel:${project.manager_phone}`}
                    style={{
                      padding: "4px 12px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📞 Ara
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#999" }}>Yetkili bilgisi kayıtlı değil</p>
          )}
        </div>
      </div>

      {/* Adres */}
      {project.address && (
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
            📍 Adres
          </h3>
          <p style={{ marginBottom: "12px", fontSize: "13px" }}>{project.address}</p>
          {project.latitude && project.longitude && (
            <div
              style={{
                width: "100%",
                height: "300px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #ddd",
              }}
            >
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBaXW3jHmQX3Q6K5Z9Y0L2M0N1O2P3Q4R&q=${encodeURIComponent(project.address)}`}
              />
            </div>
          )}

          <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#374151" }}>Projeye Eklenen Tedarikçiler</h4>
            {projectSuppliers.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Henüz tedarikçi eklenmemiş.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {projectSuppliers.map((ps) => (
                  <div key={ps.id} style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", background: ps.is_active ? "#f8fffb" : "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{ps.supplier_name}</span>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: ps.is_active ? "#dcfce7" : "#e5e7eb", color: "#065f46" }}>
                        {ps.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                      {(supplierOffersBySupplierId[ps.supplier_id] || []).length === 0 ? (
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>Henüz gelen teklif yok.</span>
                      ) : (
                        (supplierOffersBySupplierId[ps.supplier_id] || []).map((offer) => (
                          <div key={`${ps.supplier_id}-${offer.quoteId}-${offer.supplierQuoteId}`} style={{ border: "1px solid #e5e7eb", borderRadius: "6px", padding: "8px", background: "#fff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#1f2937" }}>{offer.quoteTitle}</div>
                                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                                  {offer.revisionNumber > 0 && offer.initialAmount > 0 ? (
                                    <>
                                      <span style={{ color: "#6b7280" }}>İlk Teklif: </span>
                                      <span style={{ textDecoration: "line-through", color: "#9ca3af" }}>
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
                                  <div style={{ marginTop: "4px" }}>
                                    <div style={{ fontSize: "12px", color: "#1f2937", fontWeight: 600 }}>
                                      Revize Teklif {offer.revisionNumber}: {formatMoney(Number(offer.totalAmount || 0), offer.currency)}
                                    </div>
                                    {offer.totalAmount < offer.initialAmount && (
                                      <div style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: "#dc2626",
                                        background: "#fef2f2",
                                        border: "1px solid #fecaca",
                                        borderRadius: "4px",
                                        padding: "3px 7px",
                                        marginTop: "3px",
                                        display: "inline-block",
                                      }}>
                                        ▼ İndirim: {formatMoney((offer.initialAmount - offer.totalAmount), offer.currency)}
                                        {" "}(%{((offer.initialAmount - offer.totalAmount) / offer.initialAmount * 100).toFixed(1)})
                                      </div>
                                    )}
                                    {offer.totalAmount > offer.initialAmount && (
                                      <div style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: "#b45309",
                                        background: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        borderRadius: "4px",
                                        padding: "3px 7px",
                                        marginTop: "3px",
                                        display: "inline-block",
                                      }}>
                                        ▲ Artış: {formatMoney((offer.totalAmount - offer.initialAmount), offer.currency)}
                                        {" "}(%{((offer.totalAmount - offer.initialAmount) / offer.initialAmount * 100).toFixed(1)})
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: "11px", background: "#f3f4f6", borderRadius: "999px", padding: "2px 8px", color: "#374151", whiteSpace: "nowrap" }}>
                                {offer.status}
                              </span>
                            </div>
                            <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "11px", color: "#6b7280" }}>
                                {offer.submittedAt ? new Date(offer.submittedAt).toLocaleString("tr-TR") : "Tarih bilgisi yok"}
                              </span>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  onClick={() => navigate(`/quotes/${offer.quoteId}?supplierQuoteId=${offer.supplierQuoteId}`)}
                                  style={{ padding: "5px 9px", borderRadius: "4px", border: "none", background: "#2563eb", color: "#fff", fontSize: "11px", cursor: "pointer" }}
                                >
                                  Göster
                                </button>
                                {!readOnly && (
                                  <button
                                    onClick={() => navigate(`/quotes/${offer.quoteId}?supplierQuoteId=${offer.supplierQuoteId}&action=revize`)}
                                    style={{ padding: "5px 9px", borderRadius: "4px", border: "none", background: "#f59e0b", color: "#fff", fontSize: "11px", cursor: "pointer" }}
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
      <div
        style={{
          backgroundColor: "white",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
          📁 Proje Dosyaları
        </h3>

        {!readOnly && <label
          style={{
            display: "block",
            marginBottom: "16px",
            padding: "16px",
            border: "2px dashed #2196F3",
            borderRadius: "8px",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: "#f5f9ff",
          }}
        >
          <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
          {uploading ? (
            <p style={{ margin: "0", fontWeight: "bold" }}>⏳ Yükleniyor...</p>
          ) : (
            <>
              <p style={{ margin: "0 0 4px 0", fontWeight: "bold", color: "#2196F3" }}>📤 Dosya Yükle</p>
              <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                Zip (500MB), Rar (500MB), JPEG, PNG, GIF, PDF, Excel, Word vb. desteklenir
              </p>
            </>
          )}
        </label>}

        {files.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {files.map((file) => (
              <div
                key={file.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr auto",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  border: "1px solid #e0e0e0",
                }}
              >
                {getThumbnail(file)}
                <div style={{ flex: "1" }}>
                  <p style={{ margin: "0 0 4px 0", fontWeight: "bold", fontSize: "13px" }}>
                    {file.original_filename}
                  </p>
                  <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                    {(file.file_size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleOpenFile(file)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    👁️ Aç
                  </button>
                  <button
                    onClick={() => handleDownload(file)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#4caf50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ⬇️ İndir
                  </button>
                  {!readOnly && <button
                    onClick={() => handleDeleteFile(file.id)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    🗑️ Sil
                  </button>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: "0", fontSize: "13px", color: "#999" }}>Henüz dosya yüklenilmedi</p>
        )}

        <button
          onClick={() => navigate(`/admin/project-files/${projectId}`)}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "10px",
            backgroundColor: "#ff9800",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          📂 Tüm Dosyaları Göster
        </button>
      </div>

      {/* Onaylanan Teklifler */}
      {project.project_type === "franchise" && (
        <div
          style={{
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0",
          }}
        >
          <button
            onClick={() => setShowQuotes(!showQuotes)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#f3e5f5",
              border: "1px solid #ce93d8",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>💰 Onaylanan Teklifler ({quotes.length})</span>
            <span>{showQuotes ? "▼" : "▶"}</span>
          </button>

          {showQuotes && (
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e0e0e0" }}>
              {quotes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {quotes.map((quote: Quote) => (
                    <div
                      key={quote.id}
                      style={{
                        padding: "12px",
                        backgroundColor: "#fafafa",
                        borderRadius: "4px",
                        borderLeft: "4px solid #ce93d8",
                      }}
                    >
                      <p style={{ margin: "0 0 4px 0", fontWeight: "bold", fontSize: "13px" }}>
                        {quote.title}
                      </p>
                      <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#666" }}>
                        Miktar:{" "}
                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                          Number(quote.amount || 0)
                        )}
                      </p>
                      <p style={{ margin: "0", fontSize: "12px", color: "#999" }}>
                        {quote.description}
                      </p>
                    </div>
                  ))}

                  <div
                    style={{
                      paddingTop: "12px",
                      borderTop: "2px solid #ddd",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    Toplam Maliyet:{" "}
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                      Number(quotes.reduce((sum: number, q: Quote) => sum + (q.amount || 0), 0))
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ margin: "0", fontSize: "13px", color: "#999" }}>
                  Onaylanan teklif bulunmuyor
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quote Tab */}
      {project && user && (
        <div style={{ marginTop: "20px" }}>
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
            // Optionally reload project data
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
              <button onClick={() => setShowEditModal(false)} className="ms-close-btn">
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
