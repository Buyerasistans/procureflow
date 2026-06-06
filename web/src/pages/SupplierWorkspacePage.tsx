import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSupplierAccessToken } from "../lib/session";
import {
  getSupplierProfile,
  listSupplierContracts,
  listSupplierDocuments,
  listSupplierGuarantees,
  uploadSupplierDocument,
  type SupplierContractItem,
  type SupplierDocCategory,
  type SupplierDocumentItem,
  type SupplierGuaranteeItem,
  type SupplierProfileResponse,
} from "../services/supplier-profile.service";
import { SupplierResponsePortal } from "../components/SupplierResponsePortal";
import "./SupplierWorkspacePage.css";

type WorkspaceTab = "profile" | "offers" | "contracts" | "guarantees" | SupplierDocCategory;

const DOC_TABS: SupplierDocCategory[] = ["certificates", "company_docs", "personnel_docs", "guarantee_docs"];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  profile: "Profilim",
  offers: "Tekliflerim",
  contracts: "Sözleşmelerim",
  guarantees: "Teminatlarım",
  certificates: "Sertifikalar",
  company_docs: "Şirket Evrakları",
  personnel_docs: "Personel Evrakları",
  guarantee_docs: "Alınan Teminatlar",
};

function isDocTab(tab: WorkspaceTab): tab is SupplierDocCategory {
  return DOC_TABS.includes(tab as SupplierDocCategory);
}

function getInitialTab(search: string): WorkspaceTab {
  const value = new URLSearchParams(search).get("tab");
  const validTabs: WorkspaceTab[] = ["profile", "offers", "contracts", "guarantees", ...DOC_TABS];
  if (value && validTabs.includes(value as WorkspaceTab)) {
    return value as WorkspaceTab;
  }
  return "profile";
}

export default function SupplierWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<WorkspaceTab>(() => getInitialTab(location.search));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [profile, setProfile] = useState<SupplierProfileResponse | null>(null);
  const [documents, setDocuments] = useState<SupplierDocumentItem[]>([]);
  const [contracts, setContracts] = useState<SupplierContractItem[]>([]);
  const [guarantees, setGuarantees] = useState<SupplierGuaranteeItem[]>([]);

  const [fileNameFilter, setFileNameFilter] = useState("");
  const [docFromDate, setDocFromDate] = useState("");
  const [docToDate, setDocToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const flash = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!getSupplierAccessToken()) {
      navigate("/supplier/login", { replace: true });
      return;
    }
    setTab(getInitialTab(location.search));
  }, [location.search, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (tab === "profile") {
          setProfile(await getSupplierProfile());
        } else if (isDocTab(tab)) {
          setDocuments(await listSupplierDocuments(tab));
        } else if (tab === "contracts") {
          setContracts(await listSupplierContracts());
        } else if (tab === "guarantees") {
          setGuarantees(await listSupplierGuarantees());
        }
      } catch {
        flash("Veriler yüklenemedi", "error");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [tab]);

  const changeTab = (next: WorkspaceTab) => {
    navigate(`/supplier/workspace?tab=${next}`);
  };

  const inDateRange = (value: string | undefined, fromDate: string, toDate: string) => {
    if (!fromDate && !toDate) return true;
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  };

  const filteredDocuments = useMemo(
    () => documents.filter((d) => {
      const nameOk = !fileNameFilter.trim() || d.original_filename.toLowerCase().includes(fileNameFilter.trim().toLowerCase());
      const dateOk = inDateRange(d.created_at, docFromDate, docToDate);
      return nameOk && dateOk;
    }),
    [documents, fileNameFilter, docFromDate, docToDate]
  );

  const filteredContracts = useMemo(
    () => contracts.filter((c) => statusFilter === "all" || c.status === statusFilter),
    [contracts, statusFilter]
  );

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isDocTab(tab)) return;
    try {
      setUploading(true);
      await uploadSupplierDocument(tab, file);
      setDocuments(await listSupplierDocuments(tab));
      flash("Evrak yüklendi", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Evrak yüklenemedi";
      flash(msg, "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const openDocument = async (doc: SupplierDocumentItem) => {
    const token = getSupplierAccessToken();
    if (!token) { flash("Oturum bulunamadı", "error"); return; }
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    try {
      const response = await fetch(`${apiBase}${doc.file_url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      flash("Doküman açılamadı", "error");
    }
  };

  return (
    <div className="swp-wrap">
      <div className="swp-topbar">
        <h1 className="swp-topbar__title">Tedarikçi Workspace</h1>
        <button type="button" className="swp-topbar__back" onClick={() => navigate("/supplier/dashboard")}>← Panele Dön</button>
      </div>

      <div className="swp-body">
        <div className="swp-card">
          <div className="swp-tabs">
            {(["profile", "offers", "contracts", "guarantees", ...DOC_TABS] as WorkspaceTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`swp-tab-btn${tab === t ? " swp-tab-btn--active" : ""}`}
                onClick={() => changeTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {loading && <div className="swp-loading">Yükleniyor...</div>}

          {!loading && tab === "profile" && (
            <div className="swp-list">
              {profile ? (
                <>
                  <div className="swp-profile-grid">
                    <div><div className="swp-profile-grid__label">Firma</div><div className="swp-profile-grid__value">{profile.supplier.company_name || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Kategori</div><div className="swp-profile-grid__value">{profile.supplier.category || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Email</div><div className="swp-profile-grid__value">{profile.supplier.email || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Telefon</div><div className="swp-profile-grid__value">{profile.supplier.phone || "-"}</div></div>
                  </div>
                  <div className="swp-profile-actions">
                    <button type="button" className="swp-upload-btn" onClick={() => navigate("/supplier/profile")}>Profili Düzenle</button>
                    <button type="button" className="swp-upload-btn swp-upload-btn--dark" onClick={() => navigate("/supplier/finance")}>Finans Modülü</button>
                  </div>
                </>
              ) : (
                <div className="swp-loading">Profil bilgileri bulunamadı.</div>
              )}
            </div>
          )}

          {!loading && tab === "offers" && (
            <div className="swp-offers-wrap">
              <SupplierResponsePortal
                apiUrl={(import.meta.env.VITE_API_URL as string | undefined) || ""}
                authToken={getSupplierAccessToken() || ""}
              />
            </div>
          )}

          {!loading && tab === "contracts" && (
            <>
              <div className="swp-filter-row">
                <select
                  className="swp-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Sözleşme durumu filtresi"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="draft">Taslak</option>
                  <option value="generated">Oluşturuldu</option>
                  <option value="sent">Gönderildi</option>
                  <option value="signed">İmzalı</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
              <div className="swp-list">
                {filteredContracts.length === 0 && <div className="swp-loading">Sözleşme bulunmuyor.</div>}
                {filteredContracts.map((c) => (
                  <div key={c.id} className="swp-row">
                    <div>
                      <strong className="swp-row__title">{c.contract_number}</strong>
                      <div className="swp-row__meta">
                        <span>Teklif: {c.quote_id}</span>
                        <span>{c.final_amount ? `${c.final_amount.toLocaleString("tr-TR")} TL` : "-"}</span>
                      </div>
                    </div>
                    <span className="swp-row__status">{c.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && tab === "guarantees" && (
            <div className="swp-list">
              {guarantees.length === 0 && <div className="swp-loading">Teminat kaydı bulunmuyor.</div>}
              {guarantees.map((g) => (
                <div key={g.id} className="swp-row">
                  <div>
                    <strong className="swp-row__title">{g.title}</strong>
                    <div className="swp-row__sub">{g.amount ? `${g.amount.toLocaleString("tr-TR")} ${g.currency}` : "Tutar yok"}</div>
                  </div>
                  <span className="swp-row__status">{g.status}</span>
                </div>
              ))}
            </div>
          )}

          {!loading && isDocTab(tab) && (
            <>
              <div className="swp-filter-row">
                <input
                  className="swp-input"
                  value={fileNameFilter}
                  onChange={(e) => setFileNameFilter(e.target.value)}
                  placeholder="Dosya adına göre filtrele"
                  aria-label="Dosya adına göre filtrele"
                />
                <input
                  type="date"
                  className="swp-input"
                  value={docFromDate}
                  onChange={(e) => setDocFromDate(e.target.value)}
                  aria-label="Başlangıç tarihi"
                />
                <input
                  type="date"
                  className="swp-input"
                  value={docToDate}
                  onChange={(e) => setDocToDate(e.target.value)}
                  aria-label="Bitiş tarihi"
                />
                <button type="button" className="swp-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? "⏳ Yükleniyor..." : "+ Evrak Yükle"}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="swp-hidden"
                onChange={handleUpload}
                aria-label="Evrak dosyası seç"
              />
              <div className="swp-list">
                {filteredDocuments.length === 0 && <div className="swp-loading">Filtreye uygun evrak yok.</div>}
                {filteredDocuments.map((d) => (
                  <div key={d.id} className="swp-row">
                    <div>
                      <div className="swp-row__filename">{d.original_filename}</div>
                      <div className="swp-row__date">{d.created_at ? new Date(d.created_at).toLocaleString("tr-TR") : "Tarih bilgisi yok"}</div>
                    </div>
                    <a href="#" className="swp-row__link" onClick={(e) => { e.preventDefault(); void openDocument(d); }}>Aç</a>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className={`swp-toast swp-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
