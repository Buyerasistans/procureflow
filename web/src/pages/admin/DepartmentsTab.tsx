import { useMemo, useState } from "react";
import { DepartmentCreateModal } from "../../components/DepartmentCreateModal";
import { deleteDepartment, updateDepartment } from "../../services/admin.service";
import type { CatalogRequest, Department } from "../../services/admin.service";
import { PageHeader, StatCard } from "./AdminTabContent";
import "./DepartmentsTab.css";

interface DepartmentsTabProps {
  departments: Department[];
  loadData: () => Promise<void>;
  readOnly?: boolean;
  catalogRequests?: CatalogRequest[];
  requestBusyId?: number | null;
  onCreateDepartmentRequest?: (payload: { name: string; description?: string }) => Promise<void>;
  onReviewRequest?: (requestId: number, decision: "approved" | "rejected") => Promise<void>;
}

export function DepartmentsTab({
  departments,
  loadData,
  readOnly = false,
  catalogRequests = [],
  requestBusyId = null,
  onCreateDepartmentRequest,
  onReviewRequest,
}: DepartmentsTabProps) {
  const [showNewDeptForm, setShowNewDeptForm] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "passive">("active");
  const [requestName, setRequestName] = useState("");
  const [requestDescription, setRequestDescription] = useState("");

  const handleDeleteDepartment = async (id: number) => {
    if (!confirm("Departmanı silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDepartment(id);
      await loadData();
    } catch (err) {
      alert("Silme hatası: " + String(err));
    }
  };

  const filteredDepartments = departments.filter((dept) => {
    if (filter === "all") return true;
    if (filter === "active") return dept.is_active;
    if (filter === "passive") return !dept.is_active;
    return true;
  });

  const stats = useMemo(() => ({
    total: departments.length,
    active: departments.filter((dept) => dept.is_active).length,
    passive: departments.filter((dept) => !dept.is_active).length,
  }), [departments]);

  const departmentRequests = useMemo(
    () => catalogRequests.filter((item) => item.entity_type === "department"),
    [catalogRequests],
  );

  const pendingDepartmentRequests = departmentRequests.filter((item) => item.review_status === "pending_review");

  const handleSubmitDepartmentRequest = async () => {
    if (!onCreateDepartmentRequest || !requestName.trim()) return;
    await onCreateDepartmentRequest({
      name: requestName.trim(),
      description: requestDescription.trim() || undefined,
    });
    setRequestName("");
    setRequestDescription("");
  };

  return (
    <div className="dpt-tab">
      <PageHeader
        eyebrow="Yönetişim"
        title="Departmanlar"
        sub="Organizasyon yapısı — departman kataloğu ve onay akışı"
      />
      <div className="kpi-grid kpi-grid--2">
        <StatCard label="Toplam Departman" value={departments.length} accent="blue" sub="Katalogdaki aktif departmanlar" />
        <StatCard label="Bekleyen Talep" value={catalogRequests?.filter((r) => r.review_status === "pending_review").length ?? 0} accent="warn" sub="Onay kuyruğundaki yeni departman talepleri" />
      </div>

      {onCreateDepartmentRequest && !readOnly && (
        <section className="dpt-request-section">
          <div>
            <div className="dpt-request-eyebrow">Onayli Katalog Akisi</div>
            <div className="dpt-request-title">Yeni departman talebi ac</div>
            <div className="dpt-request-sub">Dogrudan katalog yazmak yerine once onay kuyruğuna dusen bir talep acabilirsiniz.</div>
          </div>
          <div className="dpt-request-form">
            <input
              type="text"
              value={requestName}
              onChange={(event) => setRequestName(event.target.value)}
              placeholder="Or: Saha Satin Alma"
              className="dpt-input"
            />
            <textarea
              value={requestDescription}
              onChange={(event) => setRequestDescription(event.target.value)}
              placeholder="Bu departman neden gerekli?"
              rows={2}
              className="dpt-textarea"
            />
            <button
              type="button"
              onClick={() => { void handleSubmitDepartmentRequest(); }}
              disabled={!requestName.trim()}
              className="dpt-btn--submit"
            >
              Talep Ac
            </button>
          </div>
        </section>
      )}

      {departmentRequests.length > 0 && (
        <section className="dpt-queue-section">
          <div className="dpt-queue-head">
            <div>
              <div className="dpt-queue-eyebrow">Departman Talep Kuyrugu</div>
              <div className="dpt-queue-title">{pendingDepartmentRequests.length} bekleyen talep</div>
            </div>
          </div>
          <div className="dpt-queue-list">
            {departmentRequests.slice(0, 6).map((request) => (
              <div key={request.id} className="dpt-request-card">
                <div className="dpt-request-card__info">
                  <div className="dpt-request-card__name">{request.proposed_name}</div>
                  <div className="dpt-request-card__desc">{request.proposed_description || "Açıklama girilmedi"}</div>
                  <div className="dpt-request-card__status">Durum: {request.review_status}</div>
                </div>
                {request.review_status === "pending_review" && onReviewRequest ? (
                  <div className="dpt-request-card__actions">
                    <button
                      type="button"
                      disabled={requestBusyId === request.id}
                      onClick={() => { void onReviewRequest(request.id, "approved"); }}
                      className="dpt-btn dpt-btn--approve"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      disabled={requestBusyId === request.id}
                      onClick={() => { void onReviewRequest(request.id, "rejected"); }}
                      className="dpt-btn dpt-btn--reject"
                    >
                      Reddet
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {readOnly && (
        <div className="dpt-readonly-bar">
          Platform personeli departman listesini inceleyebilir; olusturma, guncelleme, aktiflik degistirme ve silme aksiyonlari bu yuzeyde kapatildi.
        </div>
      )}

      <div className="dpt-hero">
        <div>
          <div className="dpt-hero__eyebrow">Departman Yönetimi</div>
          <div className="dpt-hero__title">Alt açılımları yönetin</div>
          <div className="dpt-hero__sub">Her departmanın altında birden fazla iş/hizmet veya alt açılım tanımlayabilirsiniz.</div>
        </div>
        <button
          type="button"
          onClick={() => setShowNewDeptForm(true)}
          disabled={readOnly}
          className="dpt-hero__btn"
        >
          + Yeni Departman
        </button>
      </div>

      <div className="dpt-filter-cards">
        {([
          { key: "all",     label: "Tümü",  value: stats.total,   sel: "all-sel"     },
          { key: "active",  label: "Aktif",  value: stats.active,  sel: "active-sel"  },
          { key: "passive", label: "Pasif",  value: stats.passive, sel: "passive-sel" },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`dpt-filter-card${filter === item.key ? ` dpt-filter-card--${item.sel}` : ""}`}
          >
            <div className="dpt-filter-card__label">{item.label}</div>
            <div className={`dpt-filter-card__value dpt-filter-card__value--${item.key}`}>{item.value}</div>
          </button>
        ))}
      </div>

      <div className="dpt-content-card">
        <div className="dpt-filter-bar">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`dpt-filter-bar__btn${filter === "all" ? " dpt-filter-bar__btn--all-active" : ""}`}
          >Tümü</button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`dpt-filter-bar__btn${filter === "active" ? " dpt-filter-bar__btn--active-active" : ""}`}
          >Aktif</button>
          <button
            type="button"
            onClick={() => setFilter("passive")}
            className={`dpt-filter-bar__btn${filter === "passive" ? " dpt-filter-bar__btn--passive-active" : ""}`}
          >Pasif</button>
        </div>

        <DepartmentCreateModal
          isOpen={showNewDeptForm}
          onClose={() => setShowNewDeptForm(false)}
          onSuccess={async () => {
            setShowNewDeptForm(false);
            await loadData();
          }}
          onRequestSubmit={onCreateDepartmentRequest}
        />
        <DepartmentCreateModal
          isOpen={!!editDepartment}
          onClose={() => setEditDepartment(null)}
          onSuccess={async () => {
            setEditDepartment(null);
            await loadData();
          }}
          editData={editDepartment}
        />

        <div className="dpt-table-wrap">
          <table className="dpt-table">
            <thead>
              <tr>
                <th>Departman Adı</th>
                <th>Açıklama</th>
                <th>Alt Açılımlar</th>
                <th className="dpt-table__th--center">Aktif</th>
                <th className="dpt-table__th--center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((dept) => (
                <tr key={dept.id}>
                  <td>{dept.name}</td>
                  <td>{(dept.description || "-").split("\n").find((line) => line.trim() && !line.trim().startsWith("İş/Hizmetler:") && !line.trim().startsWith("- ")) || "-"}</td>
                  <td>
                    <div className="dpt-sub-items">
                      {(dept.sub_items || []).length === 0 ? (
                        <span className="dpt-empty-sub">Alt açılım yok</span>
                      ) : (
                        (dept.sub_items || []).map((subItem) => (
                          <span key={subItem.id} className="dpt-sub-item-tag">{subItem.name}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="dpt-table__td--center">
                    <input
                      type="checkbox"
                      checked={dept.is_active}
                      disabled={readOnly}
                      onChange={async (e) => {
                        try {
                          await updateDepartment(dept.id, { is_active: e.target.checked });
                          await loadData();
                        } catch (err) {
                          alert("Güncelleme hatası: " + String(err));
                        }
                      }}
                      className="dpt-checkbox"
                      title={dept.is_active ? "Aktif" : "Pasif"}
                    />
                  </td>
                  <td className="dpt-table__td--center">
                    {!readOnly && (
                      <div className="dpt-actions-cell">
                        <button
                          type="button"
                          onClick={() => setEditDepartment(dept)}
                          className="dpt-btn--edit"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="dpt-btn--delete"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
