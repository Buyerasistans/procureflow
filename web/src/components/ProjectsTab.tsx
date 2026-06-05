// web/src/components/ProjectsTab.tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getCompanies } from "../services/admin.service";
import { getProjects, deleteProject } from "../services/project.service";
import type { Company } from "../services/admin.service";
import type { Project } from "../types/project";
import { getShortCompanyName } from "../utils/companyDisplay";
import { PageHeader, StatCard, Section } from "../pages/admin/AdminTabContent";
import { ProjectCreateModal } from "./ProjectCreateModal";
import "../pages/admin/networkHub.css";
import "./ProjectsTab.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PR_COLORS = ["#1d4ed8", "#7c3aed", "#047857", "#b45309", "#0e7490", "#6366f1", "#64748b"];

function prColor(companyId?: number): string {
  if (!companyId) return "#64748b";
  return PR_COLORS[Math.abs(companyId) % PR_COLORS.length] ?? "#64748b";
}

const PR_TYPE_META: Record<string, { label: string; cls: string }> = {
  merkez:    { label: "Merkez",    cls: "pr-type--merkez"    },
  franchise: { label: "Franchise", cls: "pr-type--franchise" },
};

function prInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function prMoney(n?: number): string {
  if (!n) return "—";
  return "₺" + Number(n).toLocaleString("tr-TR");
}

// Mock bid data — TODO(data): replace with real quote/bid API
interface MockBid {
  supplier: string; amount: number; delivery: string;
  status: "Kazandı" | "Değerlendirme" | "Revize" | "Elendi";
}
const BID_STATUS_CLS: Record<string, string> = {
  "Kazandı": "ok", "Değerlendirme": "wait", "Revize": "info", "Elendi": "off",
};
function getMockBids(projectId: number): MockBid[] {
  const all: MockBid[][] = [
    [{ supplier: "Anadolu Ambalaj",      amount: 96000,  delivery: "30 gün", status: "Kazandı"       }, { supplier: "Demir Nakliyat",         amount: 112000, delivery: "25 gün", status: "Değerlendirme" }],
    [{ supplier: "Mavi Çelik Endüstri",  amount: 512000, delivery: "45 gün", status: "Değerlendirme" }, { supplier: "Akdeniz İnşaat Malz.",    amount: 540000, delivery: "40 gün", status: "Değerlendirme" }],
    [{ supplier: "Trakya Tarım Ürünleri",amount: 128000, delivery: "15 gün", status: "Kazandı"       }, { supplier: "Star Gıda Toptan",        amount: 141000, delivery: "20 gün", status: "Elendi"         }],
    [],
  ];
  return all[(projectId - 1) % all.length] ?? [];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectsTabProps {
  readOnly?: boolean;
  initialSearchTerm?: string;
}

// ---------------------------------------------------------------------------
// BidModal
// ---------------------------------------------------------------------------

interface BidModalProps {
  bid: MockBid | null;
  project: Project | null;
  onClose: () => void;
}

function BidModal({ bid, project, onClose }: BidModalProps) {
  if (!bid || !project) return null;
  const color = prColor(project.company_id);
  const score = { "Kazandı": 92, "Değerlendirme": 80, "Revize": 74, "Elendi": 58 }[bid.status] ?? 75;
  const pay = ["Peşin ödeme", "30 gün vade", "45 gün vade", "60 gün vade"][bid.amount % 4];
  const war = ["12 ay garanti", "24 ay garanti", "36 ay garanti"][bid.amount % 3];
  return (
    <div className="pr-modal__backdrop" onClick={onClose}>
      <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pr-modal__hd">
          <div>
            <b>{bid.supplier}</b>
            <span>{project.name} · {project.code}</span>
          </div>
          <button type="button" className="nh-act" onClick={onClose}>Kapat</button>
        </div>
        <div className="pr-modal__bd">
          <div className="pr-modal__meta">
            <span className={"nh-badge " + (BID_STATUS_CLS[bid.status] ?? "info")}>
              {bid.status === "Kazandı" ? "★ Kazandı" : bid.status}
            </span>
            <span className="pr-score" style={{ "--pr-score-bg": color + "1f", "--pr-score-fg": color } as CSSProperties}>
              Teklif puanı: {score}/100
            </span>
          </div>
          <div className="pr-modal__grid">
            <div className="pr-tile"><b>{prMoney(bid.amount)}</b><span>toplam tutar</span></div>
            <div className="pr-tile"><b>{bid.delivery}</b><span>teslim süresi</span></div>
            <div className="pr-tile"><b>{pay}</b><span>ödeme koşulu</span></div>
            <div className="pr-tile"><b>{war}</b><span>garanti</span></div>
            <div className="pr-tile"><b>15 gün</b><span>teklif geçerliliği</span></div>
            <div className="pr-tile"><b>%{score}</b><span>değerlendirme</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectsTab
// ---------------------------------------------------------------------------

export function ProjectsTab({ readOnly = false, initialSearchTerm = "" }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selId, setSelId] = useState<number | null>(null);
  const [companyFilter, setCompanyFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [activeBid, setActiveBid] = useState<MockBid | null>(null);

  useEffect(() => { void loadData(); }, []);
  useEffect(() => { setSearchTerm(initialSearchTerm); }, [initialSearchTerm]);

  async function loadData() {
    try {
      setLoading(true);
      const [pd, cd] = await Promise.all([getProjects(), getCompanies()]);
      setProjects(pd);
      setCompanies(cd);
      if (pd.length > 0 && pd[0]) setSelId(pd[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Projeyi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteProject(id);
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (selId === id) setSelId(next[0]?.id ?? null);
        return next;
      });
    } catch { /* ignore */ }
  }

  // Filtered list
  const ql = searchTerm.trim().toLowerCase();
  const list = projects.filter((p) => {
    if (companyFilter !== "all" && p.company_id !== companyFilter) return false;
    if (statusFilter === "active" && !p.is_active) return false;
    if (ql && !(p.name + " " + p.code + " " + (p.description ?? "")).toLowerCase().includes(ql)) return false;
    return true;
  });

  const sel = projects.find((p) => p.id === selId) ?? list[0] ?? null;
  const selBids = sel ? getMockBids(sel.id) : [];
  const selColor = prColor(sel?.company_id);
  const selTypeMeta = PR_TYPE_META[sel?.project_type ?? "merkez"] ?? PR_TYPE_META.merkez!;

  const totalBudget = list.reduce((a, p) => a + (p.budget ?? 0), 0);
  const activeCount = list.filter((p) => p.is_active).length;

  const getCompanyName = (companyId?: number) => {
    if (!companyId) return "Firma yok";
    return getShortCompanyName(companies.find((c) => c.id === companyId) ?? { id: 0, name: "Firma yok" } as Company);
  };

  if (loading) {
    return (
      <div className="pr-tab">
        <PageHeader eyebrow="Yönetişim · Projeler" title="Projeler" sub="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="pr-tab">
      <PageHeader
        eyebrow="Yönetişim · Projeler"
        title="Projeler"
        sub="Stratejik partner projeleri — sahibi firma, saha yetkilisi, satınalma ekibi ve gelen teklifler."
        actions={
          !readOnly ? (
            <button type="button" className="pr-btn--primary" onClick={() => setShowCreateModal(true)}>
              + Yeni Proje
            </button>
          ) : undefined
        }
      />

      {readOnly && (
        <div className="pr-readonly-bar">
          Platform personeli proje portföyünü inceleyebilir; yeni proje ekleme ve silme bu yüzeyde kapalıdır.
        </div>
      )}

      {/* Tenant / company filter bar */}
      <div className="pr-tenantbar">
        <div className="pr-tenantbar__l">
          <span className="pr-tenantbar__lbl">Firma</span>
          <select
            className="pr-sel"
            aria-label="Firma filtresi"
            value={companyFilter === "all" ? "all" : companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value === "all" ? "all" : Number(e.target.value));
              setSelId(null);
            }}
          >
            <option value="all">Tüm firmalar</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{getShortCompanyName(c)}</option>
            ))}
          </select>
        </div>
        <span className="pr-tenantbar__hint">
          {list.length} proje · {prMoney(totalBudget)} bütçe
        </span>
      </div>

      {/* KPI stats */}
      <div className="nh-stats">
        <StatCard label="Toplam proje"    value={list.length}      sub={`${activeCount} aktif`} />
        <StatCard label="Toplam bütçe"    value={prMoney(totalBudget)} sub="planlanan" accent="blue" />
        <StatCard label="Firma"           value={companies.length} sub="proje sahibi" accent="violet" />
        <StatCard label="Atanan personel" value={projects.reduce((a, p) => a + (p.personnel?.length ?? 0), 0)} sub="proje-yetkili" accent="green" />
      </div>

      {/* Search + filter toolbar */}
      <div className="pr-toolbar">
        <div className="pr-search">
          <span className="pr-search__icon">⌕</span>
          <input
            type="text"
            className="pr-search__input"
            placeholder="Proje adı veya kod ara…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="pr-segs">
          {(["all", "active"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={statusFilter === v ? "on" : ""}
              onClick={() => setStatusFilter(v)}
            >
              {v === "all" ? "Tümü" : "Aktif"}
            </button>
          ))}
        </div>
      </div>

      {/* Two-pane split */}
      <div className="nh-split">
        {/* Left: project list */}
        <aside className="nh-list pr-pool">
          <div className="nh-list__hd">Projeler <span>{list.length}</span></div>
          <div className="nh-list__scroll">
            {list.length === 0 ? (
              <div className="nh-list-empty">Eşleşen proje yok.</div>
            ) : list.map((p) => {
              const col = prColor(p.company_id);
              const tm = PR_TYPE_META[p.project_type] ?? PR_TYPE_META.merkez!;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={"pr-row" + (p.id === selId ? " on" : "") + (p.is_active ? "" : " off")}
                  style={{ "--pr-color": col, "--pr-color-bg": col + "1f" } as CSSProperties}
                  onClick={() => setSelId(p.id)}
                >
                  <span className="pr-row__bar" />
                  <span className="pr-row__ico">📁</span>
                  <span className="pr-row__meta">
                    <b>
                      {p.name}
                      <span className={tm.cls}>{tm.label}</span>
                    </b>
                    <span>
                      <span className="pr-firm">
                        {getCompanyName(p.company_id)}
                      </span>
                      <span className="pr-code">{p.code}</span>
                    </span>
                  </span>
                  <span className="pr-row__bud">
                    {prMoney(p.budget)}
                    <span>{(p.personnel?.length ?? 0)} yetkili</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: detail pane */}
        <div className="nh-detail" style={sel ? { "--pr-color": selColor, "--pr-color-bg": selColor + "1f" } as CSSProperties : undefined}>
          {!sel ? (
            <div className="nh-mut">Bir proje seçin.</div>
          ) : (
            <>
              <div className="nh-detail__hd">
                <div className="pr-detail__hd-l">
                  <span className="pr-logo">📁</span>
                  <div>
                    <h3>
                      {sel.name}
                      <span className={selTypeMeta.cls}>{selTypeMeta.label}</span>
                      {!sel.is_active && <span className="nh-badge off">Pasif</span>}
                    </h3>
                    <p>{sel.description ?? "—"}</p>
                    <div className="pr-owner">
                      <span className="pr-firm pr-firm--lg">
                        {getCompanyName(sel.company_id)}
                      </span>
                      <span className="pr-owner__sep">·</span>
                      <code className="nh-mono">{sel.code}</code>
                    </div>
                  </div>
                </div>
                <div className="pr-detail__acts">
                  <Link to={`/admin/projects/${sel.id}`} className="pr-btn--link">
                    Detay →
                  </Link>
                  {!readOnly && (
                    <button
                      type="button"
                      className="pr-btn--danger"
                      onClick={() => void handleDelete(sel.id)}
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>

              <Section title="Künye & bütçe" sub="proje bilgileri">
                <div className="pr-facts">
                  <div className="pr-fact"><span>Proje kodu</span><b className="nh-mono">{sel.code}</b></div>
                  <div className="pr-fact"><span>Tip</span><b>{selTypeMeta.label}</b></div>
                  <div className="pr-fact"><span>Bütçe</span><b>{prMoney(sel.budget)}</b></div>
                  <div className="pr-fact"><span>Sahibi firma</span><b>{getCompanyName(sel.company_id)}</b></div>
                  <div className="pr-fact"><span>Durum</span><b>{sel.is_active ? "Aktif" : "Pasif"}</b></div>
                  <div className="pr-fact"><span>Dosyalar</span><b>{sel.project_files?.length ?? 0} belge</b></div>
                </div>
              </Section>

              <Section title="Saha yetkilisi" sub="proje yöneticisi (sahada)">
                {sel.manager_name ? (
                  <div className="pr-contact">
                    <span className="nh-av pr-av pr-av--lg">
                      {prInitials(sel.manager_name)}
                    </span>
                    <div className="pr-contact__b">
                      <b>{sel.manager_name}</b>
                      <span>Saha / Proje Yöneticisi</span>
                      {sel.manager_phone && (
                        <a href={`tel:${sel.manager_phone}`}>{sel.manager_phone}</a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="nh-mut">Yetkili atanmamış.</p>
                )}
              </Section>

              <Section title="Satınalma yetkilileri" sub="proje yetkili ekibi">
                {!sel.personnel || sel.personnel.length === 0 ? (
                  <p className="nh-mut">Yetkili atanmamış.</p>
                ) : (
                  <table className="nh-table">
                    <thead>
                      <tr><th>Yetkili</th><th>Rol</th><th>E-posta</th></tr>
                    </thead>
                    <tbody>
                      {sel.personnel.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div className="nh-tname">
                              <span className="nh-av sm pr-av">
                                {prInitials(m.full_name)}
                              </span>
                              <div><b>{m.full_name}</b></div>
                            </div>
                          </td>
                          <td className="nh-mut">{m.role}</td>
                          <td className="nh-mut">{m.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section title="Gelen teklifler" sub="teklif özeti">
                {selBids.length === 0 ? (
                  <p className="nh-mut">Henüz teklif gelmedi.{/* TODO(data): wire to real quote/bid API */}</p>
                ) : (
                  <table className="nh-table">
                    <thead>
                      <tr>
                        <th>Tedarikçi firma</th><th>Teklif tutarı</th>
                        <th>Teslim</th><th>Durum</th><th>Eylem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selBids].sort((a) => a.status === "Kazandı" ? -1 : 0).map((b, i) => (
                        <tr key={i} className={b.status === "Kazandı" ? "pr-bidwin" : ""}>
                          <td><b>{b.supplier}</b></td>
                          <td className="nh-mono">{prMoney(b.amount)}</td>
                          <td className="nh-mut">{b.delivery}</td>
                          <td>
                            <span className={"nh-badge " + (BID_STATUS_CLS[b.status] ?? "info")}>
                              {b.status === "Kazandı" ? "★ Kazandı" : b.status}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="nh-act" onClick={() => setActiveBid(b)}>
                              Detay
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              {sel.address && (
                <Section title="Konum & adres" sub="proje sahası">
                  <div className="pr-location">
                    <span className="pr-pin">📍</span>
                    <div>
                      <b>{sel.address}</b>
                      {sel.latitude && sel.longitude && (
                        <span className="nh-mut"> · {sel.latitude.toFixed(4)}, {sel.longitude.toFixed(4)}</span>
                      )}
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      <BidModal bid={activeBid} project={sel} onClose={() => setActiveBid(null)} />

      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => { void loadData(); setShowCreateModal(false); }}
      />
    </div>
  );
}
