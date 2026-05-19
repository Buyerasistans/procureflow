// pages/PersonnelDetailPage.tsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { canAccessAdminSurface, getRoleLabel, isPlatformStaffUser, isSuperAdminUser } from "../auth/permissions";
import {
  getTenantUsers,
  updateTenantUser,
  getDepartments,
  getCompanies,
  getRoles,
  getUserCompanyAssignments,
  addUserCompanyAssignment,
  updateUserCompanyAssignment,
  removeUserCompanyAssignment,
  adminResetPassword,
  type TenantUser,
  type Department,
  type Company,
  type Role,
  type CompanyAssignment,
} from "../services/admin.service";

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
  const userId = parseInt(id!);

  // ── state ──
  const [personnel, setPersonnel] = useState<TenantUser | null>(null);
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // basic info edit
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "",
    department_id: undefined as number | undefined,
  });

  // company assignment add form
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [newAssign, setNewAssign] = useState({ company_id: "", role_id: "", department_id: "" });

  // inline edit
  const [editingAssignId, setEditingAssignId] = useState<number | null>(null);
  const [editAssign, setEditAssign] = useState({ role_id: "", department_id: "" });

  // password reset
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<{ temp_password: string } | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      return await getUserCompanyAssignments(userId);
    } catch (err) {
      const maybeAxios = err as { response?: { status?: number } };
      // Endpoint is optional during rollout; keep page usable instead of hard-failing.
      if (maybeAxios.response?.status === 404) {
        return [];
      }
      throw err;
    }
  }, [userId]);

  // ── load ──
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
      const person = allPersonnel.find((p) => p.id === userId);
      if (!person) { setError("Kullanici bulunamadi"); return; }
      setPersonnel(person);
        setForm({ email: person.email, full_name: person.full_name, role: person.role, department_id: person.department_id });
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  const handleSave = async () => {
    try {
      await updateTenantUser(userId, { email: form.email, full_name: form.full_name, role: form.role as TenantUser["role"], department_id: form.department_id });
      setIsEditing(false);
      flash("Bilgiler güncellendi");
      await fetchAll();
    } catch (err) { setError(err instanceof Error ? err.message : "Güncelleme hatası"); }
  };

  const handleAddAssignment = async () => {
    if (!newAssign.company_id || !newAssign.role_id) { setError("Firma ve rol zorunludur"); return; }
    try {
      await addUserCompanyAssignment(userId, { company_id: parseInt(newAssign.company_id), role_id: parseInt(newAssign.role_id), department_id: newAssign.department_id ? parseInt(newAssign.department_id) : null });
      setShowAddAssignment(false);
      setNewAssign({ company_id: "", role_id: "", department_id: "" });
      flash("Firma ataması eklendi");
      setAssignments(await loadAssignments());
    } catch (err) { setError(err instanceof Error ? err.message : "Atama eklenemedi"); }
  };

  const handleUpdateAssignment = async (assignId: number) => {
    try {
      await updateUserCompanyAssignment(userId, assignId, { role_id: editAssign.role_id ? parseInt(editAssign.role_id) : undefined, department_id: editAssign.department_id ? parseInt(editAssign.department_id) : null });
      setEditingAssignId(null);
      flash("Atama güncellendi");
      setAssignments(await loadAssignments());
    } catch (err) { setError(err instanceof Error ? err.message : "Güncelleme hatası"); }
  };

  const handleRemoveAssignment = async (assignId: number) => {
    if (!window.confirm("Bu firma atamasını kaldırmak istediğinize emin misiniz?")) return;
    try {
      await removeUserCompanyAssignment(userId, assignId);
      flash("Firma ataması kaldırıldı");
      setAssignments(await loadAssignments());
    } catch (err) { setError(err instanceof Error ? err.message : "Kaldırma hatası"); }
  };

  const handlePasswordReset = async () => {
    try {
      const res = await adminResetPassword(userId);
      setResetConfirm(false);
      setResetResult({ temp_password: res.temp_password });
    } catch (err) { setError(err instanceof Error ? err.message : "Şifre sıfırlama hatası"); }
  };

  if (loading) return <div style={{ padding: 24 }}>Yükleniyor...</div>;
  if (!personnel) return <div style={{ padding: 24, color: "red" }}>❌ {error ?? "Kullanici bulunamadi"}</div>;

  const isSuperAdmin = isSuperAdminUser(authUser);
  const isPlatformStaff = isPlatformStaffUser(authUser);
  const isAdminManagedTarget = ["super_admin", "tenant_admin", "tenant_owner"].includes(String(personnel.system_role || "").toLowerCase())
    || String(personnel.role || "").toLowerCase() === "admin";
  const canManagePersonnel = canAccessAdminSurface(authUser) && !isPlatformStaff && (isSuperAdmin || !isAdminManagedTarget);
  const assignedCompanyIds = new Set(assignments.map((a) => a.company_id));
  const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13, boxSizing: "border-box" as const };
  const lbl = { display: "block", fontSize: 12, color: "#374151", marginBottom: 4 };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <button onClick={() => navigate("/admin?tab=personnel")}
        style={{ marginBottom: 20, padding: "6px 14px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
        ← Kullanici Listesine Don
      </button>

      {successMsg && <div style={{ padding: "10px 16px", background: "#d1fae5", color: "#065f46", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>✅ {successMsg}</div>}
      {error && (
        <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontSize: 12 }}>Kapat</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>👤 {personnel.full_name}</h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>{personnel.email}</p>
          {!canManagePersonnel && canAccessAdminSurface(authUser) && !isSuperAdmin && (
            <p style={{ margin: "6px 0 0", color: "#92400e", fontSize: 12 }}>
              Bu kayit yalnizca goruntulenebilir.
            </p>
          )}
        </div>
        {isSuperAdmin && (
          <button onClick={() => setResetConfirm(true)}
            style={{ padding: "8px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            🔑 Şifreyi Sıfırla
          </button>
        )}
      </div>

      {/* ── Basic Info ── */}
      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Temel Bilgiler</h2>
          {!isEditing && canManagePersonnel && (
            <button onClick={() => setIsEditing(true)}
              style={{ padding: "5px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>Düzenle</button>
          )}
        </div>
        {!isEditing ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", fontSize: 14 }}>
            <div><span style={{ color: "#6b7280" }}>Email: </span>{personnel.email}</div>
            <div><span style={{ color: "#6b7280" }}>Operasyonel Rol: </span>{getRoleLabel(personnel.role)}</div>
            <div><span style={{ color: "#6b7280" }}>Sistem Rolü: </span>{personnel.system_role ? getRoleLabel(personnel.system_role) : "Tenant Üyesi / Varsayılan"}</div>
            <div><span style={{ color: "#6b7280" }}>Durum: </span>{personnel.is_active ? "✅ Aktif" : "🚫 Pasif"}</div>
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 16 }}>
              <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Ad Soyad</label><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inp} /></div>
              <div>
                <label style={lbl}>Operasyonel Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inp}>
                  {EDITABLE_ROLE_OPTIONS.map((value) => <option key={value} value={value}>{getRoleLabel(value)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Varsayılan Departman</label>
                <select value={form.department_id || ""} onChange={(e) => setForm({ ...form, department_id: e.target.value ? parseInt(e.target.value) : undefined })} style={inp}>
                  <option value="">Seçiniz...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSave} style={{ padding: "7px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Kaydet</button>
              <button onClick={() => setIsEditing(false)} style={{ padding: "7px 14px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", fontSize: 13 }}>İptal</button>
            </div>
          </div>
        )}
      </section>

      {/* ── Firma Atamaları ── */}
      <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Firma Atamaları</h2>
          {canManagePersonnel && (
            <button onClick={() => { setShowAddAssignment(!showAddAssignment); setError(null); }}
              style={{ padding: "5px 12px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>
              {showAddAssignment ? "✕ İptal" : "+ Firma Ekle"}
            </button>
          )}
        </div>

        {showAddAssignment && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Firma *</label>
                <select value={newAssign.company_id} onChange={(e) => setNewAssign({ ...newAssign, company_id: e.target.value })} style={inp}>
                  <option value="">Seçiniz...</option>
                  {companies.filter((c) => !assignedCompanyIds.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Rol *</label>
                <select value={newAssign.role_id} onChange={(e) => setNewAssign({ ...newAssign, role_id: e.target.value })} style={inp}>
                  <option value="">Seçiniz...</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Departman</label>
                <select value={newAssign.department_id} onChange={(e) => setNewAssign({ ...newAssign, department_id: e.target.value })} style={inp}>
                  <option value="">Seçiniz...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleAddAssignment} style={{ padding: "7px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Ataması Kaydet
            </button>
          </div>
        )}

        {assignments.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Bu kullaniciya henuz firma atamasi yapilmamis.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Firma</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Rol</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Departman</th>
                {isSuperAdmin && <th style={{ padding: "8px 10px", textAlign: "center" }}>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  {editingAssignId === a.id ? (
                    <>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ background: a.company?.color ?? "#3b82f6", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{a.company?.name ?? `#${a.company_id}`}</span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <select value={editAssign.role_id} onChange={(e) => setEditAssign({ ...editAssign, role_id: e.target.value })} style={{ padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12 }}>
                          <option value="">Seçiniz...</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <select value={editAssign.department_id} onChange={(e) => setEditAssign({ ...editAssign, department_id: e.target.value })} style={{ padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12 }}>
                          <option value="">—</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <button onClick={() => handleUpdateAssignment(a.id)} style={{ padding: "4px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>Kaydet</button>
                        <button onClick={() => setEditingAssignId(null)} style={{ padding: "4px 8px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>İptal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ background: a.company?.color ?? "#3b82f6", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{a.company?.name ?? `#${a.company_id}`}</span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>{a.role?.name ?? `Rol #${a.role_id}`}</td>
                      <td style={{ padding: "8px 10px", color: "#6b7280" }}>{a.department?.name ?? "—"}</td>
                      {isSuperAdmin && (
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <button onClick={() => { setEditingAssignId(a.id); setEditAssign({ role_id: String(a.role_id), department_id: a.department_id ? String(a.department_id) : "" }); }}
                            style={{ padding: "3px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>Düzenle</button>
                          <button onClick={() => handleRemoveAssignment(a.id)}
                            style={{ padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Kaldır</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {assignments.length > 0 && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#eff6ff", borderRadius: 6, fontSize: 12 }}>
            <strong style={{ color: "#1d4ed8" }}>Bu kullanici su firmalardaki rollerden izin alir:</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#374151" }}>
              {assignments.map((a) => (
                <li key={a.id}>
                  <strong>{a.company?.name}</strong> — Rol: <em>{a.role?.name}</em>
                  {a.department && <>, Dept: <em>{a.department.name}</em></>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Password Reset Confirm Dialog */}
      {resetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>🔑 Şifre Sıfırla</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>
              <strong>{personnel.full_name}</strong> sifresi gecici sifre ile sifirlanacak. Kullanici bir sonraki giriste Profil sayfasindan degistirmelidir.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handlePasswordReset} style={{ flex: 1, padding: "9px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Evet, Sıfırla</button>
              <button onClick={() => setResetConfirm(false)} style={{ padding: "9px 16px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Result Dialog */}
      {resetResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>✅ Şifre Sıfırlandı</h3>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>Geçici şifre:</p>
            <div style={{ padding: "10px 14px", background: "#f3f4f6", borderRadius: 6, fontFamily: "monospace", fontSize: 16, fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>
              {resetResult.temp_password}
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "#6b7280" }}>Bu sifreyi kullaniciya iletiniz. Kullanici giris yaptiktan sonra Profil sayfasindan degistirmelidir.</p>
            <button onClick={() => setResetResult(null)} style={{ width: "100%", padding: "9px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

