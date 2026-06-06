// web/src/pages/ProjectPage.tsx
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProjects, getProjectFiles, uploadProjectFile, deleteProjectFile } from "../services/project.service";
import { getQuotes } from "../services/quotes.service";
import type { Project, ProjectFile } from "../types/project";
import type { Quote } from "../types/quote";

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0");

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const projects = await getProjects();
      const found = projects.find((p) => p.id === projectId);
      setProject(found || null);

      if (found) {
        const projectFiles = await getProjectFiles(projectId);
        setFiles(projectFiles);

        // Eğer Franchise ise teklifleri yükle
        if (found.project_type === "franchise") {
          const allQuotes = await getQuotes();
          // Projeye ait ve onaylanan teklif filtreleme
          const approvedQuotes = allQuotes.filter(
            (q) => q.project_id === projectId && q.status === "APPROVED"
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

  // Proje ve dosyaları yükle
  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadProjectFile(projectId, file);
      await loadProjectData(); // Dosya listesini yenile
      e.target.value = ""; // Input'u temizle
    } catch (error) {
      console.error("Dosya yükleme hatası:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm("Dosyayı silmek istediğinize emin misiniz?")) return;

    try {
      await deleteProjectFile(fileId);
      await loadProjectData(); // Dosya listesini yenile
    } catch (error) {
      console.error("Dosya silme hatası:", error);
    }
  };

  if (loading) return <div className="text-center p-8">Yükleniyor...</div>;
  if (!project) return <div className="text-center p-8 text-red-500">Proje bulunamadı</div>;

  const isImage = (file: ProjectFile) =>
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.file_type);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-gray-600">Kod: {project.code}</p>
          <span className={`text-sm px-3 py-1 rounded ${project.project_type === "franchise" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
            {project.project_type === "franchise" ? "🍕 Franchise" : "🏢 Merkez"}
          </span>
        </div>
        <button onClick={() => setIsEditMode(!isEditMode)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          {isEditMode ? "❌ İptal" : "✏️ Düzenle"}
        </button>
      </div>

      {/* Proje Bilgileri */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        {project.description && <p className="mb-2"><strong>Açıklama:</strong> {project.description}</p>}
        {project.budget && <p className="mb-2"><strong>Bütçe:</strong> {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(project.budget)}</p>}
        {project.manager_name && <p className="mb-2"><strong>Yetkilisi:</strong> {project.manager_name}</p>}
        {project.manager_phone && (
          <p className="mb-2">
            <strong>Telefon:</strong> {project.manager_phone}
            <a href={`tel:${project.manager_phone}`} className="ml-2 bg-green-500 text-white px-2 py-1 rounded text-sm hover:bg-green-600">
              📞 Ara
            </a>
          </p>
        )}
      </div>

      {/* Adres ve Google Maps */}
      {project.address && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">📍 Konum</h2>
          <p className="mb-3">{project.address}</p>
          {project.latitude && project.longitude && (
            <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-300">
              <iframe
                width="100%"
                height="100%"
                className="border-0"
                loading="lazy"
                allowFullScreen
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBaXW3jHmQX3Q6K5Z9Y0L2M0N1O2P3Q4R&q=${encodeURIComponent(project.address)}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Dosyalar */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3">📁 Proje Dosyaları</h2>

        {/* Yükleme */}
        <div className="mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg">
          <label className="cursor-pointer">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <div className="text-center">
              {uploading ? (
                <p>Yükleniyor...</p>
              ) : (
                <>
                  <p className="text-blue-500 font-bold">📤 Dosya Yükle</p>
                  <p className="text-sm text-gray-600">Zip, Rar, JPEG, PDF vb. desteklenir</p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Dosya Listesi */}
        {files.length > 0 ? (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-start justify-between bg-gray-50 p-3 rounded">
                <div className="flex-1">
                  {isImage(file) ? (
                    <img
                      src={`/api/v1/files/${file.id}`}
                      alt={file.original_filename}
                      className="h-16 w-16 object-cover rounded mb-2"
                    />
                  ) : null}
                  <p className="font-medium">{file.original_filename}</p>
                  <p className="text-sm text-gray-600">
                    {(file.file_size / 1024).toFixed(2)} KB • {new Date(file.created_at || "").toLocaleString("tr-TR")}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                >
                  🗑️ Sil
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Henüz dosya yüklenilmedi</p>
        )}
      </div>

      {/* Onaylanan Teklifler (Franchise için) */}
      {project.project_type === "franchise" && (
        <div className="mb-6">
          <button
            onClick={() => setShowQuotes(!showQuotes)}
            className="w-full text-left p-4 bg-purple-100 hover:bg-purple-200 rounded-lg font-bold flex justify-between items-center"
          >
            <span>💰 Onaylanan Teklifler</span>
            <span>{showQuotes ? "▼" : "▶"}</span>
          </button>

          {showQuotes && (
            <div className="mt-3 bg-white border border-purple-200 rounded-lg p-4">
              {quotes.length > 0 ? (
                <div className="space-y-4">
                  {quotes.map((quote) => (
                    <div key={quote.id} className="border-b pb-3">
                      <p className="font-bold">{quote.title}</p>
                      <p className="text-gray-600">
                        Miktar: {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(quote.amount ?? 0)}
                      </p>
                      <p className="text-sm text-gray-500">{quote.description}</p>
                    </div>
                  ))}

                  {/* Toplam */}
                  <div className="pt-3 border-t-2 border-gray-300 font-bold text-lg">
                    Toplam Maliyet:{" "}
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: "TRY"
                    }).format(quotes.reduce((sum, q) => sum + (q.amount ?? 0), 0))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Onaylanan teklif bulunmuyor</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
