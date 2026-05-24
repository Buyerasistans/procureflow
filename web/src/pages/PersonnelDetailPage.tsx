import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { canAccessAdminSurface, getRoleLabel, isPlatformStaffUser, isSuperAdminUser } from "../auth/permissions";
import {
  addUserCompanyAssignment,
  adminResetPassword,
  getCompanies,
  getDepartments,
  getRoles,
  getTenantUsers,
  getUserCompanyAssignments,
  removeUserCompanyAssignment,
  updateTenantUser,
  updateUserCompanyAssignment,
  type Company,
  type CompanyAssignment,
  type Department,
  type Role,
  type TenantUser,
} from "../services/admin.service";
import "./PersonnelDetailPage.css";

const EDITABLE_ROLE_OPTIONS = [
  "satinalmaci",
  "satinalma_uzmani",
  "satinalma_yoneticisi",
  "satinalma_direktoru",
  "super_admin",
] as const;

export default function PersonnelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const userId = Number.parseInt(id ?? "", 10);

  const [personnel, setPersonnel] = useState<TenantUser | null>(null);
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "",
    department_id: undefined as number | undefined,
  });

  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [newAssign, setNewAssign] = useState({ company_id: "", role_id: "", department_id: "" });

  const [editingAssignId, setEditingAssignId] = useState<number | null>(null);
  const [editAssign, setEditAssign] = useState({ role_id: "", department_id: "" });

  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<{ temp_password: string } | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      return await getUserCompanyAssignments(userId);
    } catch (err) {
      const maybeAxios = err as { response?: { status?: number } };
      if (maybeAxios.response?.status === 404) {
        return [];
      }
      throw err;
    }
  }, [userId]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [allPersonnel, depts, comps, roleList, asgn] = await Promise.all([
        getTenantUsers(),
        getDepartments(),
        getCompanies(),
        getRoles(),
        loadAssignments(),
      ]);

      const person = allPersonnel.find((item) => item.id === userId);
      if (!person) {
        setError("Kullanici bulunamadi");
        return;
      }

      setPersonnel(person);
      setForm({
        email: person.email,
        full_name: person.full_name,
        role: person.role,
        department_id: person.department_id,
      });
      setDepartments(depts);
      setCompanies(comps);
      setRoles(roleList);
      setAssignments(asgn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }, [loadAssignments, userId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  const handleSave = async () => {
    try {
      await updateTenantUser(userId, {
        email: form.email,
        full_name: form.full_name,
        role: form.role as TenantUser["role"],
        department_id: form.department_id,
      });
      setIsEditing(false);
      flash("Bilgiler güncellendi");
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme hatası");
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssign.company_id || !newAssign.role_id) {
      setError("Firma ve rol zorunludur");
      return;
    }

    try {
      await addUserCompanyAssignment(userId, {
        company_id: Number.parseInt(newAssign.company_id, 10),
        role_id: Number.parseInt(newAssign.role_id, 10),
        department_id: newAssign.department_id ? Number.parseInt(newAssign.department_id, 10) : null,
      });
      setShowAddAssignment(false);
      setNewAssign({ company_id: "", role_id: "", department_id: "" });
      flash("Firma ataması eklendi");
      setAssignments(await loadAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Atama eklenemedi");
    }
  };

  const handleUpdateAssignment = async (assignId: number) => {
    try {
      await updateUserCompanyAssignment(userId, assignId, {
        role_id: editAssign.role_id ? Number.parseInt(editAssign.role_id, 10) : undefined,
        department_id: editAssign.department_id ? Number.parseInt(editAssign.department_id, 10) : null,
      });
      setEditingAssignId(null);
      flash("Atama güncellendi");
      setAssignments(await loadAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme hatası");
    }
  };

  const handleRemoveAssignment = async (assignId: number) => {
    if (!window.confirm("Bu firma atamasını kaldırmak istediğinize emin misiniz?")) return;
    try {
      await removeUserCompanyAssignment(userId, assignId);
      flash("Firma ataması kaldırıldı");
      setAssignments(await loadAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaldırma hatası");
    }
  };

  const handlePasswordReset = async () => {
    try {
      const response = await adminResetPassword(userId);
      setResetConfirm(false);
      setResetResult({ temp_password: response.temp_password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Şifre sıfırlama hatası");
    }
  };

  if (loading) {
    return (
      <div className="personnel-detail-page__status personnel-detail-page__status--loading">
        Yükleniyor...
      </div>
    );
  }

  if (!personnel) {
    return (
      <div className="personnel-detail-page__status personnel-detail-page__status--error">
        ❌ {error ?? "Kullanici bulunamadi"}
      </div>
    );
  }

  const isSuperAdmin = isSuperAdminUser(authUser);
  const isPlatformStaff = isPlatformStaffUser(authUser);
  const isAdminManagedTarget =
    ["super_admin", "tenant_admin", "tenant_owner"].includes(String(personnel.system_role || "").toLowerCase()) ||
    String(personnel.role || "").toLowerCase() === "admin";
  const canManagePersonnel =
    canAccessAdminSurface(authUser) && !isPlatformStaff && (isSuperAdmin || !isAdminManagedTarget);
  const assignedCompanyIds = new Set(assignments.map((item) => item.company_id));

  return (
    <div className="personnel-detail-page">
      <div className="personnel-detail-page__shell">
        <button
          type="button"
          onClick={() => navigate("/admin?tab=personnel")}
          className="personnel-detail-page__back-button"
        >
          ← Kullanici Listesine Don
        </button>

        {successMsg ? (
          <div className="personnel-detail-page__alert personnel-detail-page__alert--success" role="status">
            ✅ {successMsg}
          </div>
        ) : null}

        {error ? (
          <div className="personnel-detail-page__alert personnel-detail-page__alert--error" role="alert">
            <span>❌ {error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="personnel-detail-page__dismiss-button"
              aria-label="Hata mesajını kapat"
              title="Hata mesajını kapat"
            >
              Kapat
            </button>
          </div>
        ) : null}

        <header className="personnel-detail-page__header">
          <div className="personnel-detail-page__header-copy">
            <h1 className="personnel-detail-page__title">👤 {personnel.full_name}</h1>
            <p className="personnel-detail-page__subtitle">{personnel.email}</p>
            {!canManagePersonnel && canAccessAdminSurface(authUser) && !isSuperAdmin ? (
              <p className="personnel-detail-page__readonly-note">Bu kayit yalnizca goruntulenebilir.</p>
            ) : null}
          </div>

          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setResetConfirm(true)}
              className="personnel-detail-page__button personnel-detail-page__button--warning"
            >
              🔑 Şifreyi Sıfırla
            </button>
          ) : null}
        </header>

        <section className="personnel-detail-page__section">
          <div className="personnel-detail-page__section-header">
            <h2 className="personnel-detail-page__section-title">Temel Bilgiler</h2>
            {!isEditing && canManagePersonnel ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="personnel-detail-page__button personnel-detail-page__button--primary"
              >
                Düzenle
              </button>
            ) : null}
          </div>

          {!isEditing ? (
            <div className="personnel-detail-page__info-grid">
              <div>
                <span className="personnel-detail-page__label-text">Email: </span>
                {personnel.email}
              </div>
              <div>
                <span className="personnel-detail-page__label-text">Operasyonel Rol: </span>
                {getRoleLabel(personnel.role)}
              </div>
              <div>
                <span className="personnel-detail-page__label-text">Sistem Rolü: </span>
                {personnel.system_role ? getRoleLabel(personnel.system_role) : "Tenant Üyesi / Varsayılan"}
              </div>
              <div>
                <span className="personnel-detail-page__label-text">Durum: </span>
                {personnel.is_active ? "✅ Aktif" : "🚫 Pasif"}
              </div>
            </div>
          ) : (
            <div className="personnel-detail-page__stack">
              <div className="personnel-detail-page__edit-grid">
                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Email"
                    title="Email"
                  />
                </label>

                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Ad Soyad</span>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Ad Soyad"
                    title="Ad Soyad"
                  />
                </label>

                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Operasyonel Rol</span>
                  <select
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Operasyonel Rol"
                    title="Operasyonel Rol"
                  >
                    {EDITABLE_ROLE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {getRoleLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Varsayılan Departman</span>
                  <select
                    value={form.department_id ?? ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        department_id: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                      })
                    }
                    className="personnel-detail-page__control"
                    aria-label="Varsayılan Departman"
                    title="Varsayılan Departman"
                  >
                    <option value="">Seçiniz...</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="personnel-detail-page__actions-row">
                <button
                  type="button"
                  onClick={handleSave}
                  className="personnel-detail-page__button personnel-detail-page__button--success"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="personnel-detail-page__button personnel-detail-page__button--secondary"
                >
                  İptal
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="personnel-detail-page__section">
          <div className="personnel-detail-page__section-header">
            <h2 className="personnel-detail-page__section-title">Firma Atamaları</h2>
            {canManagePersonnel ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddAssignment((current) => !current);
                  setError(null);
                }}
                className="personnel-detail-page__button personnel-detail-page__button--success"
              >
                {showAddAssignment ? "✕ İptal" : "+ Firma Ekle"}
              </button>
            ) : null}
          </div>

          {showAddAssignment ? (
            <div className="personnel-detail-page__subsection">
              <div className="personnel-detail-page__assignment-grid">
                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Firma *</span>
                  <select
                    value={newAssign.company_id}
                    onChange={(event) => setNewAssign({ ...newAssign, company_id: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Firma seçimi"
                    title="Firma seçimi"
                  >
                    <option value="">Seçiniz...</option>
                    {companies
                      .filter((company) => !assignedCompanyIds.has(company.id))
                      .map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Rol *</span>
                  <select
                    value={newAssign.role_id}
                    onChange={(event) => setNewAssign({ ...newAssign, role_id: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Rol seçimi"
                    title="Rol seçimi"
                  >
                    <option value="">Seçiniz...</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="personnel-detail-page__field">
                  <span className="personnel-detail-page__field-label">Departman</span>
                  <select
                    value={newAssign.department_id}
                    onChange={(event) => setNewAssign({ ...newAssign, department_id: event.target.value })}
                    className="personnel-detail-page__control"
                    aria-label="Departman seçimi"
                    title="Departman seçimi"
                  >
                    <option value="">Seçiniz...</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddAssignment}
                className="personnel-detail-page__button personnel-detail-page__button--success"
              >
                Ataması Kaydet
              </button>
            </div>
          ) : null}

          {assignments.length === 0 ? (
            <p className="personnel-detail-page__empty-state">
              Bu kullaniciya henuz firma atamasi yapilmamis.
            </p>
          ) : (
            <div className="personnel-detail-page__table-wrap">
              <table className="personnel-detail-page__table">
                <thead>
                  <tr>
                    <th>Firma</th>
                    <th>Rol</th>
                    <th>Departman</th>
                    {isSuperAdmin ? <th className="personnel-detail-page__table-actions-col">İşlem</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      {editingAssignId === assignment.id ? (
                        <>
                          <td>
                            <span className="personnel-detail-page__company-pill">
                              {assignment.company?.name ?? `#${assignment.company_id}`}
                            </span>
                          </td>
                          <td>
                            <select
                              value={editAssign.role_id}
                              onChange={(event) =>
                                setEditAssign({ ...editAssign, role_id: event.target.value })
                              }
                              className="personnel-detail-page__control personnel-detail-page__control--compact"
                              aria-label="Atama rolü"
                              title="Atama rolü"
                            >
                              <option value="">Seçiniz...</option>
                              {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={editAssign.department_id}
                              onChange={(event) =>
                                setEditAssign({ ...editAssign, department_id: event.target.value })
                              }
                              className="personnel-detail-page__control personnel-detail-page__control--compact"
                              aria-label="Atama departmanı"
                              title="Atama departmanı"
                            >
                              <option value="">—</option>
                              {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="personnel-detail-page__table-actions">
                            <button
                              type="button"
                              onClick={() => handleUpdateAssignment(assignment.id)}
                              className="personnel-detail-page__button personnel-detail-page__button--success personnel-detail-page__button--small"
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAssignId(null)}
                              className="personnel-detail-page__button personnel-detail-page__button--secondary personnel-detail-page__button--small"
                            >
                              İptal
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span className="personnel-detail-page__company-pill">
                              {assignment.company?.name ?? `#${assignment.company_id}`}
                            </span>
                          </td>
                          <td>{assignment.role?.name ?? `Rol #${assignment.role_id}`}</td>
                          <td className="personnel-detail-page__muted">
                            {assignment.department?.name ?? "—"}
                          </td>
                          {isSuperAdmin ? (
                            <td className="personnel-detail-page__table-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAssignId(assignment.id);
                                  setEditAssign({
                                    role_id: String(assignment.role_id),
                                    department_id: assignment.department_id ? String(assignment.department_id) : "",
                                  });
                                }}
                                className="personnel-detail-page__button personnel-detail-page__button--primary personnel-detail-page__button--small"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="personnel-detail-page__button personnel-detail-page__button--danger personnel-detail-page__button--small"
                              >
                                Kaldır
                              </button>
                            </td>
                          ) : null}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {assignments.length > 0 ? (
            <div className="personnel-detail-page__assignment-summary">
              <strong className="personnel-detail-page__assignment-summary-title">
                Bu kullanici su firmalardaki rollerden izin alir:
              </strong>
              <ul className="personnel-detail-page__assignment-list">
                {assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <strong>{assignment.company?.name}</strong> — Rol: <em>{assignment.role?.name}</em>
                    {assignment.department ? (
                      <>
                        , Dept: <em>{assignment.department.name}</em>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {resetConfirm ? (
          <div className="personnel-detail-page__modal-backdrop" role="presentation">
            <div
              className="personnel-detail-page__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="personnel-reset-title"
            >
              <h3 id="personnel-reset-title" className="personnel-detail-page__modal-title">
                🔑 Şifre Sıfırla
              </h3>
              <p className="personnel-detail-page__modal-text">
                <strong>{personnel.full_name}</strong> sifresi gecici sifre ile sifirlanacak.
                Kullanici bir sonraki giriste Profil sayfasindan degistirmelidir.
              </p>
              <div className="personnel-detail-page__modal-actions">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="personnel-detail-page__button personnel-detail-page__button--warning personnel-detail-page__button--flex"
                >
                  Evet, Sıfırla
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirm(false)}
                  className="personnel-detail-page__button personnel-detail-page__button--secondary personnel-detail-page__button--flex"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resetResult ? (
          <div className="personnel-detail-page__modal-backdrop" role="presentation">
            <div
              className="personnel-detail-page__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="personnel-reset-result-title"
            >
              <h3 id="personnel-reset-result-title" className="personnel-detail-page__modal-title">
                ✅ Şifre Sıfırlandı
              </h3>
              <p className="personnel-detail-page__modal-text">Geçici şifre:</p>
              <div className="personnel-detail-page__password-chip">{resetResult.temp_password}</div>
              <p className="personnel-detail-page__modal-note">
                Bu şifreyi kullanıcıya iletiniz. Kullanıcı giriş yaptıktan sonra Profil sayfasından
                degistirmelidir.
              </p>
              <button
                type="button"
                onClick={() => setResetResult(null)}
                className="personnel-detail-page__button personnel-detail-page__button--primary personnel-detail-page__button--full"
              >
                Kapat
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
