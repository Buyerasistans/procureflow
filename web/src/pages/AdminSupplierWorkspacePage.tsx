import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteAdminSupplierDocument,
  listAdminSupplierDocuments,
  uploadAdminSupplierDocument,
  type AdminSupplierDocCategory,
  type AdminSupplierDocumentItem,
} from "../services/admin.service";
import { getToken } from "../lib/session";
import "./AdminSupplierWorkspacePage.css";

type WorkspaceTab = AdminSupplierDocCategory;

function getInitialTab(search: string): WorkspaceTab {
  const tab = new URLSearchParams(search).get("tab") as WorkspaceTab | null;
  if (tab === "certificates" || tab === "company_docs" || tab === "personnel_docs" || tab === "guarantee_docs") {
    return tab;
  }
  return "certificates";
}

export default function AdminSupplierWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const supplierId = Number(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<WorkspaceTab>(() => getInitialTab(location.search));
  const [documents, setDocuments] = useState<AdminSupplierDocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileNameFilter, setFileNameFilter] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const flash = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setTab(getInitialTab(location.search));
  }, [location.search]);

  useEffect(() => {
    async function loadData() {
      if (!Number.isFinite(supplierId) || supplierId <= 0) return;
      setLoading(true);
      try {
        setDocuments(await listAdminSupplierDocuments(supplierId, tab));
      } catch {
        flash("Veriler yüklenemedi", "error");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [supplierId, tab]);

  const filteredDocuments = useMemo(
    () => documents.filter((d) => !fileNameFilter.trim() || d.original_filename.toLowerCase().includes(fileNameFilter.trim().toLowerCase())),
    [documents, fileNameFilter],
  );

  const changeTab = (next: WorkspaceTab) => {
    navigate(`/admin/suppliers/${supplierId}/workspace?tab=${next}`);
  };

  const openDocument = async (doc: AdminSupplierDocumentItem) => {
    const token = getToken();
    if (!token) {
      flash("Oturum bulunamadı", "error");
      return;
    }
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    const safe = encodeURIComponent(doc.stored_filename || "");
    const url = `${apiBase}/api/v1/suppliers/${supplierId}/documents/file/${safe}?category=${encodeURIComponent(doc.category)}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      flash("Doküman açılamadı", "error");
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!window.confirm("Bu dokümanı silmek istediğinize emin misiniz?")) return;
    try {
      await deleteAdminSupplierDocument(supplierId, documentId);
      flash("Doküman silindi", "success");
      setDocuments(await listAdminSupplierDocuments(supplierId, tab));
    } catch {
      flash("Doküman silinemedi", "error");
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadAdminSupplierDocument(supplierId, tab, file);
      flash("Evrak yüklendi", "success");
      setDocuments(await listAdminSupplierDocuments(supplierId, tab));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Evrak yüklenemedi";
      flash(message, "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="asw-page">
      <div className="asw-topbar">
        <h1 className="asw-topbar__title">Evrak ve Dokümanlar</h1>
        <button type="button" className="asw-topbar__back" onClick={() => navigate(`/admin/suppliers/${supplierId}`)}>
          ← Tedarikçi Detayına Dön
        </button>
      </div>

      <div className="asw-body">
        <div className="asw-card">
          <div className="asw-tabs">
            {(["certificates", "company_docs", "personnel_docs", "guarantee_docs"] as WorkspaceTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`asw-tab-btn${tab === t ? " asw-tab-btn--active" : ""}`}
                onClick={() => changeTab(t)}
              >
                {t === "certificates" && "Sertifikalar"}
                {t === "company_docs" && "Şirket Evrakları"}
                {t === "personnel_docs" && "Personel Evrakları"}
                {t === "guarantee_docs" && "Alınan Teminatlar"}
              </button>
            ))}
          </div>

          {loading && <div className="asw-loading">Yükleniyor...</div>}

          {!loading && (
            <>
              <div className="asw-action-row">
                <input
                  className="asw-input"
                  aria-label="Dosya adına göre filtrele"
                  value={fileNameFilter}
                  onChange={(e) => setFileNameFilter(e.target.value)}
                  placeholder="Dosya adına göre filtrele"
                />
                <button
                  type="button"
                  className="asw-upload-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "⏳ Yükleniyor..." : "+ Evrak Yükle"}
                </button>
              </div>

              <input
                ref={fileRef}
                type="file"
                aria-label="Evrak yükle"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="asw-hidden"
                onChange={handleUpload}
              />

              <div className="asw-list">
                {filteredDocuments.length === 0 && (
                  <div className="asw-row asw-row--empty">Kayıt bulunamadı</div>
                )}
                {filteredDocuments.map((doc) => (
                  <div className="asw-row" key={doc.id}>
                    <div>
                      <div className="asw-row__filename">{doc.original_filename}</div>
                      <div className="asw-row__date">
                        {doc.created_at ? new Date(doc.created_at).toLocaleString("tr-TR") : ""}
                      </div>
                    </div>
                    <div className="asw-row__actions">
                      <button type="button" className="asw-action-btn" onClick={() => openDocument(doc)}>
                        Görüntüle
                      </button>
                      <button type="button" className="asw-action-btn asw-action-btn--danger" onClick={() => void handleDelete(doc.id)}>
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className={`asw-toast asw-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
