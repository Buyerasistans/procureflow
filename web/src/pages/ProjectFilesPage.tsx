import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProjectFiles, deleteProjectFile, getProjects } from "../services/project.service";
import { getCompanies } from "../services/admin.service";
import { isPlatformStaffUser } from "../auth/permissions";
import { useAuth } from "../hooks/useAuth";
import { getAccessToken } from "../lib/token";
import type { ProjectFile, Project } from "../types/project";
import type { Company } from "../services/admin.service";
import "./ProjectFilesPage.css";

export default function ProjectFilesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const projectId = parseInt(id || "0");
  const readOnly = isPlatformStaffUser(user);

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ProjectFile | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectsData, companiesData, filesData] = await Promise.all([
        getProjects(),
        getCompanies(),
        getProjectFiles(projectId),
      ]);

      setCompanies(companiesData);
      const found = projectsData.find((p) => p.id === projectId);
      setProject(found || null);
      setFiles(filesData);
    } catch (error) {
      console.error("Veri yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDeleteFile(fileId: number) {
    if (readOnly) return;
    if (!confirm("Dosyayı silmek istediğinize emin misiniz?")) return;

    try {
      await deleteProjectFile(fileId);
      setFiles(files.filter((f) => f.id !== fileId));
      if (selectedImage?.id === fileId) {
        setSelectedImage(null);
      }
    } catch (error) {
      console.error("Dosya silme hatası:", error);
      alert("Dosya silinemedi!");
    }
  }

  const isImage = (file: ProjectFile) =>
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.file_type);

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
          className="pfp-thumb-img"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      );
    }
    return (
      <div className="pfp-thumb-icon">
        {getFileIcon(file)}
      </div>
    );
  };

  if (loading) return <div className="pfp-loading">Yükleniyor...</div>;
  if (!project) return <div className="pfp-not-found">Proje bulunamadı</div>;

  return (
    <div className="pfp-root">
      {readOnly && (
        <div className="pfp-readonly-banner">
          Bu dosya portföyü platform personeli için salt okunur durumdadır.
        </div>
      )}

      <button type="button" onClick={() => navigate(`/admin/projects/${projectId}`)} className="pfp-back-btn">
        ← Geri Dön
      </button>

      <h1 className="pfp-title">{getCompanyName(project.company_id)}</h1>
      <p className="pfp-subtitle">{project.name} - Tüm Dosyalar ({files.length})</p>

      {files.length > 0 ? (
        <div>
          {files.some((f) => isImage(f)) && (
            <div>
              <h3 className="pfp-section-title">🖼️ Görseller</h3>
              <div className="pfp-images-grid">
                {files
                  .filter((f) => isImage(f))
                  .map((file) => (
                    <div key={file.id} className="pfp-image-card">
                      <img
                        src={`/api/v1/files/${file.id}/thumbnail`}
                        alt={file.original_filename}
                        className="pfp-image-thumb"
                        onClick={() => setSelectedImage(file)}
                        onError={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                      />
                      <div className="pfp-image-actions">
                        <button type="button" onClick={() => handleOpenFile(file)} className="pfp-btn pfp-btn--blue pfp-btn--sm">
                          👁️ Görüntüle
                        </button>
                        <button type="button" onClick={() => handleDownload(file)} className="pfp-btn pfp-btn--green pfp-btn--sm">
                          ⬇️ İndir
                        </button>
                        {!readOnly && (
                          <button type="button" onClick={() => handleDeleteFile(file.id)} className="pfp-btn pfp-btn--red pfp-btn--sm">
                            🗑️ Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {files.some((f) => !isImage(f)) && (
            <div>
              <h3 className="pfp-section-title">📄 Diğer Dosyalar</h3>
              <div className="pfp-files-list">
                {files
                  .filter((f) => !isImage(f))
                  .map((file) => (
                    <div key={file.id} className="pfp-file-row">
                      <div className="pfp-thumb-wrap">
                        {getThumbnail(file)}
                      </div>
                      <div className="pfp-file-info">
                        <p className="pfp-file-name">{file.original_filename}</p>
                        <p className="pfp-file-size">{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div className="pfp-file-actions">
                        <button type="button" onClick={() => handleOpenFile(file)} className="pfp-btn pfp-btn--blue pfp-btn--md">
                          🔓 Aç
                        </button>
                        <button type="button" onClick={() => handleDownload(file)} className="pfp-btn pfp-btn--green pfp-btn--md">
                          ⬇️ İndir
                        </button>
                        {!readOnly && (
                          <button type="button" onClick={() => handleDeleteFile(file.id)} className="pfp-btn pfp-btn--red pfp-btn--md">
                            🗑️ Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="pfp-empty">Henüz dosya yüklenilmedi</p>
      )}

      {selectedImage && (
        <div className="pfp-modal-overlay" onClick={() => setSelectedImage(null)}>
          <button type="button" onClick={() => setSelectedImage(null)} className="pfp-modal-close">✕</button>
          <img
            src={`/api/v1/files/${selectedImage.id}`}
            alt={selectedImage.original_filename}
            className="pfp-modal-image"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="pfp-modal-footer">
            <p className="pfp-modal-filename">{selectedImage.original_filename}</p>
            <div className="pfp-modal-btns">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleOpenFile(selectedImage); }}
                className="pfp-btn pfp-btn--blue pfp-btn--lg"
              >
                🔓 Aç
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDownload(selectedImage); }}
                className="pfp-btn pfp-btn--green pfp-btn--lg"
              >
                ⬇️ İndir
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Dosyayı silmek istediğinize emin misiniz?")) {
                      handleDeleteFile(selectedImage.id);
                      setSelectedImage(null);
                    }
                  }}
                  className="pfp-btn pfp-btn--red pfp-btn--lg"
                >
                  🗑️ Sil
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
