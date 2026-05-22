import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProjectFiles, deleteProjectFile, getProjects } from "../services/project.service";
import { getCompanies } from "../services/admin.service";
import { isPlatformStaffUser } from "../auth/permissions";
import { useAuth } from "../hooks/useAuth";
import { getAccessToken } from "../lib/token";
import type { ProjectFile, Project } from "../types/project";
import type { Company } from "../services/admin.service";

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

  if (loading) return <div style={{ textAlign: "center", padding: "32px" }}>Yükleniyor...</div>;
  if (!project) return <div style={{ textAlign: "center", padding: "32px", color: "red" }}>Proje bulunamadı</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {readOnly && (
        <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "12px", background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }}>
          Bu dosya portfoyu platform personeli icin salt okunur durumdadir.
        </div>
      )}
      {/* Header */}
      <button
        onClick={() => navigate(`/admin/projects/${projectId}`)}
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

      <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 8px 0" }}>
        {getCompanyName(project.company_id)}
      </h1>
      <p style={{ fontSize: "14px", color: "#666", margin: "0 0 24px 0" }}>
        {project.name} - Tüm Dosyalar ({files.length})
      </p>

      {files.length > 0 ? (
        <div>
          {/* Görüntüler Grid */}
          {files.some((f) => isImage(f)) && (
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
                🖼️ Görseller
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "12px",
                  marginBottom: "32px",
                }}
              >
                {files
                  .filter((f) => isImage(f))
                  .map((file) => (
                    <div
                      key={file.id}
                      style={{
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid #e0e0e0",
                        backgroundColor: "white",
                      }}
                    >
                      <img
                        src={`/api/v1/files/${file.id}/thumbnail`}
                        alt={file.original_filename}
                        style={{
                          width: "100%",
                          height: "150px",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedImage(file)}
                        onError={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                      />
                      <div style={{ padding: "8px", display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => handleOpenFile(file)}
                          style={{
                            flex: "1",
                            padding: "6px",
                            backgroundColor: "#2196F3",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontWeight: "bold",
                          }}
                        >
                          👁️ Görüntüle
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          style={{
                            flex: "1",
                            padding: "6px",
                            backgroundColor: "#4caf50",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                            fontWeight: "bold",
                          }}
                        >
                          ⬇️ İndir
                        </button>
                        {!readOnly && (
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            style={{
                              flex: "1",
                              padding: "6px",
                              backgroundColor: "#f44336",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: "pointer",
                              fontWeight: "bold",
                            }}
                          >
                            🗑️ Sil
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Diğer Dosyalar */}
          {files.some((f) => !isImage(f)) && (
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px", color: "#333" }}>
                📄 Diğer Dosyalar
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {files
                  .filter((f) => !isImage(f))
                  .map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px",
                        backgroundColor: "#f9f9f9",
                        borderRadius: "4px",
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      {/* Sol Thumbnail */}
                      <div style={{ flexShrink: 0 }}>
                        {getThumbnail(file)}
                      </div>

                      {/* Ortadaki Bilgiler */}
                      <div style={{ flex: "1", minWidth: 0 }}>
                        <p style={{ margin: "0 0 4px 0", fontWeight: "bold", fontSize: "13px", wordBreak: "break-word" }}>
                          {file.original_filename}
                        </p>
                        <p style={{ margin: "0", fontSize: "12px", color: "#666" }}>
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* Sağdaki Butonlar */}
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
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
                            fontWeight: "bold",
                          }}
                        >
                          🔓 Aç
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
                            fontWeight: "bold",
                          }}
                        >
                          ⬇️ İndir
                        </button>
                        {!readOnly && (
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
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
        <p style={{ fontSize: "14px", color: "#999" }}>Henüz dosya yüklenilmedi</p>
      )}

      {/* Görüntü Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "9999",
          }}
        >
          <button
            onClick={() => setSelectedImage(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              backgroundColor: "white",
              color: "black",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              fontSize: "24px",
              cursor: "pointer",
              fontWeight: "bold",
              zIndex: "10000",
            }}
          >
            ✕
          </button>
          <img
            src={`/api/v1/files/${selectedImage.id}`}
            alt={selectedImage.original_filename}
            style={{
              maxWidth: "90%",
              maxHeight: "90vh",
              borderRadius: "8px",
              boxShadow: "0 0 30px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <p
              style={{
                color: "white",
                fontSize: "14px",
                margin: "0",
                maxWidth: "80%",
                textAlign: "center",
              }}
            >
              {selectedImage.original_filename}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenFile(selectedImage);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#2196f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🔓 Aç
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedImage);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ⬇️ İndir
              </button>
              {!readOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Dosyayı silmek istediğinize emin misiniz?")) {
                      handleDeleteFile(selectedImage.id);
                      setSelectedImage(null);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
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
