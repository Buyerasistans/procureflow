import { useEffect, useMemo, useState } from "react";
import PersonnelDetailModal from "../../components/PersonnelDetailModal";
import type { Role, Tenant, TenantUser } from "../../services/admin.service";
import { PersonnelCreateModal } from "../../components/PersonnelCreateModal";
import {
  getAdminSupplierUsers,
  getAdminSuppliers,
  getUserCompanyAssignments,
  type AdminSupplierListItem,
  type AdminSupplierUserListItem,
} from "../../services/admin.service";
import { getPersonnelRolePermissionMatrix, getRoleLabel } from "../../auth/permissions";


interface PersonnelTabProps {
  personnel: TenantUser[];
  roles: Role[];
  tenants?: Tenant[];
  loadData: () => Promise<void>;
  readOnly?: boolean;
}

type PersonnelSegment = "portal" | "partner" | "supplier";

type StrategicPartnerGroup = {
  key: string;
  name: string;
  users: TenantUser[];
};

type SupplierPersonnelGroup = {
  supplier: AdminSupplierListItem;
  users: AdminSupplierUserListItem[];
};

export function PersonnelTab(props: PersonnelTabProps) {
  const { personnel, roles, loadData, readOnly = false } = props;

  const [showNewPersonnelModal, setShowNewPersonnelModal] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<TenantUser | null>(null);
  const [detailPersonnel, setDetailPersonnel] = useState<TenantUser | null>(null);
  const [tab, setTab] = useState<'all' | 'active' | 'passive'>('all');
  const [segment, setSegment] = useState<PersonnelSegment>('portal');
  const [supplierGroups, setSupplierGroups] = useState<SupplierPersonnelGroup[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [expandedPartnerGroups, setExpandedPartnerGroups] = useState<Record<string, boolean>>({});
  const [expandedSupplierGroups, setExpandedSupplierGroups] = useState<Record<number, boolean>>({});
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'platform' | 'portal' | 'channel' | 'supplier'>('all');
  const [loadingPersonId, setLoadingPersonId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const stats = useMemo(() => ({
    total: personnel.length,
    active: personnel.filter((person) => person.is_active).length,
    passive: personnel.filter((person) => !person.is_active).length,
  }), [personnel]);

  const filteredPersonnel = useMemo(() => {
    if (tab === 'active') return personnel.filter((person) => person.is_active);
    if (tab === 'passive') return personnel.filter((person) => !person.is_active);
    return personnel;
  }, [personnel, tab]);

  const portalPersonnel = useMemo(() => {
    return filteredPersonnel.filter((person) => {
      const systemRole = String(person.system_role || '').toLowerCase();
      const businessRole = String(person.role || '').toLowerCase();
      return systemRole === 'super_admin'
        || systemRole === 'platform_support'
        || systemRole === 'platform_operator'
        || businessRole === 'super_admin';
    });
  }, [filteredPersonnel]);

  const strategicPartnerPersonnel = useMemo(() => {
    return filteredPersonnel.filter((person) => {
      const systemRole = String(person.system_role || '').toLowerCase();
      const businessRole = String(person.role || '').toLowerCase();
      const isPortalUser = systemRole === 'super_admin'
        || systemRole === 'platform_support'
        || systemRole === 'platform_operator'
        || businessRole === 'super_admin';
      const isSupplierUser = systemRole === 'supplier_user' || businessRole === 'supplier';
      return !isPortalUser && !isSupplierUser;
    });
  }, [filteredPersonnel]);

  const strategicPartnerGroups = useMemo<StrategicPartnerGroup[]>(() => {
    const groups = new Map<string, StrategicPartnerGroup>();
    strategicPartnerPersonnel.forEach((person) => {
      const tenantId = person.tenant_id ?? null;
      const firstCompanyName = (person.company_assignments || [])
        .map((assignment) => assignment.company?.name)
        .find(Boolean);
      const key = tenantId != null ? `tenant-${tenantId}` : `company-${firstCompanyName || 'atamasiz'}`;
      const name = tenantId != null
        ? `Stratejik Partner ${firstCompanyName ? `- ${firstCompanyName}` : `#${tenantId}`}`
        : (firstCompanyName ? `Stratejik Partner - ${firstCompanyName}` : 'Stratejik Partner Atamasi Yok');

      if (!groups.has(key)) {
        groups.set(key, { key, name, users: [] });
      }
      groups.get(key)?.users.push(person);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        users: [...group.users].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [strategicPartnerPersonnel]);

  const permissionMatrix = useMemo(() => getPersonnelRolePermissionMatrix(), []);

  const filteredPermissionMatrix = useMemo(() => {
    if (matrixFilter === 'all') return permissionMatrix;
    return permissionMatrix.filter((row) => row.group === matrixFilter);
  }, [permissionMatrix, matrixFilter]);

  useEffect(() => {
    if (segment !== 'supplier') return;

    let cancelled = false;
    setSupplierLoading(true);
    setSupplierError(null);

    (async () => {
      try {
        const suppliers = await getAdminSuppliers({ filter_active: tab !== 'passive' });
        const groups = await Promise.all(
          suppliers.map(async (supplier) => {
            try {
              const users = await getAdminSupplierUsers(supplier.id);
              const filteredUsers = users.filter((userItem) => {
                if (tab === 'all') return true;
                if (tab === 'active') return userItem.is_active !== false;
                return userItem.is_active === false;
              });
              return { supplier, users: filteredUsers };
            } catch {
              return { supplier, users: [] };
            }
          }),
        );

        if (!cancelled) {
          setSupplierGroups(groups.sort((a, b) => a.supplier.company_name.localeCompare(b.supplier.company_name, 'tr')));
        }
      } catch (error) {
        if (!cancelled) {
          setSupplierError(error instanceof Error ? error.message : 'Tedarikci listesi yuklenemedi.');
          setSupplierGroups([]);
        }
      } finally {
        if (!cancelled) {
          setSupplierLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [segment, tab]);

  function toStatus(value: boolean): string {
    return value ? 'Acik' : 'Kapali';
  }

  function exportMatrixAsCsv() {
    const headers = [
      'operasyonel_rol',
      'sistem_rolu',
      'admin_yuzeyi',
      'kullanici_yonetimi',
      'teklif_alani',
      'onay_inceleme',
      'stratejik_partner_okuma',
      'stratejik_partner_yazma',
      'destek_akisi',
      'tenant_kimlik_ayarlari',
      'ortak_eposta_profilleri',
    ];

    const lines = filteredPermissionMatrix.map((row) => ([
      row.businessRoleLabel,
      row.systemRoleLabel,
      toStatus(row.adminSurface),
      toStatus(row.manageUsers),
      toStatus(row.quoteWorkspace),
      toStatus(row.reviewApprovals),
      toStatus(row.tenantGovernanceRead),
      toStatus(row.tenantGovernanceWrite),
      toStatus(row.supportWorkflow),
      toStatus(row.tenantIdentitySettings),
      toStatus(row.sharedEmailProfiles),
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')));

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `rol_yetki_matrisi_${matrixFilter}_${dateTag}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  async function hydratePersonnel(person: TenantUser): Promise<TenantUser> {
    setLoadingPersonId(person.id);
    try {
      const assignments = await getUserCompanyAssignments(person.id);
      return { ...person, company_assignments: assignments };
    } finally {
      setLoadingPersonId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {notice && (
        <div style={{ padding: 12, borderRadius: 12, background: notice.type === 'success' ? '#dcfce7' : '#fee2e2', color: notice.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${notice.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
          {notice.text}
        </div>
      )}
      {readOnly && (
        <div style={{ padding: 12, borderRadius: 12, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>
          Platform personeli bu alanda kullanici listesini inceleyebilir; olusturma, duzenleme, aktiflik degistirme ve silme aksiyonlari sadece tenant yonetim yetkisi olan hesaplarda acilir.
        </div>
      )}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        padding: 20,
        borderRadius: 20,
        background: "linear-gradient(135deg, #fffdf8 0%, #eef4ff 100%)",
        border: "1px solid #e5e7eb",
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "#92400e", textTransform: "uppercase" }}>
            Kullanici Yonetimi
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>
            Ekip, atama ve iletişim bilgileri
          </div>
          <div style={{ marginTop: 10, color: "#475569" }}>
            Tümü sekmesi artık aktif ve pasif tüm kayıtları gösterir. Sekmeleri durum bazlı filtrelemek için kullanabilirsiniz.
          </div>
        </div>
        <button
          onClick={() => setShowNewPersonnelModal(true)}
          disabled={readOnly}
          style={{
            padding: "14px 20px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
            border: "none",
            borderRadius: 14,
            cursor: readOnly ? "not-allowed" : "pointer",
            fontWeight: 800,
            boxShadow: "0 16px 32px rgba(16, 185, 129, 0.24)",
            opacity: readOnly ? 0.6 : 1,
          }}
        >
          + Yeni Kullanici
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { key: "all", label: "Tümü", value: stats.total, color: "#2563eb" },
          { key: "active", label: "Aktif", value: stats.active, color: "#059669" },
          { key: "passive", label: "Pasif", value: stats.passive, color: "#dc2626" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as typeof tab)}
            style={{
              textAlign: "left",
              border: tab === item.key ? `2px solid ${item.color}` : "1px solid #e5e7eb",
              background: "white",
              borderRadius: 16,
              padding: 16,
              cursor: "pointer",
              boxShadow: tab === item.key ? "0 12px 24px rgba(15, 23, 42, 0.08)" : "none",
            }}
          >
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: item.color, marginTop: 8 }}>{item.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[
          { key: 'portal', label: `Portal Personelleri (${portalPersonnel.length})`, color: '#1d4ed8' },
          { key: 'partner', label: `Stratejik Partner Personeli (${strategicPartnerPersonnel.length})`, color: '#0f766e' },
          { key: 'supplier', label: `Tedarikci Personeli (${supplierGroups.reduce((sum, group) => sum + group.users.length, 0)})`, color: '#b45309' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSegment(item.key as PersonnelSegment)}
            style={{
              border: segment === item.key ? `2px solid ${item.color}` : '1px solid #e5e7eb',
              background: segment === item.key ? '#f8fafc' : '#fff',
              color: segment === item.key ? item.color : '#334155',
              borderRadius: 999,
              padding: '10px 14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ borderRadius: 20, border: "1px solid #fde68a", background: "#fffbeb", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #fef3c7", display: "grid", gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#92400e", textTransform: "uppercase" }}>Rol Yetki Matrisi</div>
              <div style={{ color: "#78350f", fontSize: 13 }}>Guncel yetki modeline gore rol kombinasyonlarinda acilan kritik yuzeylerin ozet gorunumu.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={matrixFilter}
                onChange={(event) => setMatrixFilter(event.target.value as typeof matrixFilter)}
                style={{ border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 10px', background: '#fff', color: '#78350f', fontWeight: 600 }}
              >
                <option value="all">Tum Roller</option>
                <option value="platform">Platform Grubu</option>
                <option value="portal">Portal / Satin Alma</option>
                <option value="channel">Kanal / Is Ortagi</option>
                <option value="supplier">Tedarikci</option>
              </select>
              <button
                type="button"
                onClick={exportMatrixAsCsv}
                style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                CSV Disa Aktar
              </button>
            </div>
          </div>
        </div>
        <div style={{ overflowX: "auto", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Operasyonel Rol</th>
                <th style={{ padding: 10, textAlign: "left" }}>Sistem Rolü</th>
                <th style={{ padding: 10, textAlign: "center" }}>Admin</th>
                <th style={{ padding: 10, textAlign: "center" }}>Kullanıcı</th>
                <th style={{ padding: 10, textAlign: "center" }}>Teklif</th>
                <th style={{ padding: 10, textAlign: "center" }}>Onay</th>
                <th style={{ padding: 10, textAlign: "center" }}>SP Yonetim Oku</th>
                <th style={{ padding: 10, textAlign: "center" }}>SP Yonetim Yaz</th>
                <th style={{ padding: 10, textAlign: "center" }}>Destek Akisi</th>
                <th style={{ padding: 10, textAlign: "center" }}>Tenant Kimlik</th>
                <th style={{ padding: 10, textAlign: "center" }}>Ortak E-Posta</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const groupLabels: Record<string, string> = {
                  platform: "🛡️ Platform Grubu",
                  portal:   "🏢 Portal / Satın Alma Grubu",
                  channel:  "🤝 Kanal / İş Ortağı Grubu",
                  supplier: "📦 Tedarikçi Grubu",
                };
                let lastGroup = "";
                return filteredPermissionMatrix.flatMap((row) => {
                  const headerRow = row.group !== lastGroup ? (
                    <tr key={`group-${row.group}`} style={{ background: "#f1f5f9" }}>
                      <td colSpan={11} style={{ padding: "6px 10px", fontWeight: 800, fontSize: 12, color: "#334155", letterSpacing: 0.5 }}>
                        {groupLabels[row.group] ?? row.group}
                      </td>
                    </tr>
                  ) : null;
                  lastGroup = row.group;
                  return [
                    headerRow,
                    <tr key={`${row.businessRole}-${row.systemRole}`} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: 10, fontWeight: 700, color: "#0f172a" }}>{row.businessRoleLabel}</td>
                      <td style={{ padding: 10, color: "#334155" }}>{row.systemRoleLabel}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.adminSurface ? "#166534" : "#991b1b" }}>{toStatus(row.adminSurface)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.manageUsers ? "#166534" : "#991b1b" }}>{toStatus(row.manageUsers)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.quoteWorkspace ? "#166534" : "#991b1b" }}>{toStatus(row.quoteWorkspace)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.reviewApprovals ? "#166534" : "#991b1b" }}>{toStatus(row.reviewApprovals)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.tenantGovernanceRead ? "#166534" : "#991b1b" }}>{toStatus(row.tenantGovernanceRead)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.tenantGovernanceWrite ? "#166534" : "#991b1b" }}>{toStatus(row.tenantGovernanceWrite)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.supportWorkflow ? "#166534" : "#991b1b" }}>{toStatus(row.supportWorkflow)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.tenantIdentitySettings ? "#166534" : "#991b1b" }}>{toStatus(row.tenantIdentitySettings)}</td>
                      <td style={{ padding: 10, textAlign: "center", color: row.sharedEmailProfiles ? "#166534" : "#991b1b" }}>{toStatus(row.sharedEmailProfiles)}</td>
                    </tr>,
                  ];
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        background: "white",
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
      }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 0, background: '#f8fafc', padding: 16, borderBottom: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setTab('all')}
          style={{
            padding: '8px 24px',
            border: 'none',
            borderRadius: '6px 0 0 6px',
            background: tab === 'all' ? '#3b82f6' : 'transparent',
            color: tab === 'all' ? '#fff' : '#222',
            fontWeight: tab === 'all' ? 700 : 400,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >Tümü</button>
        <button
          onClick={() => setTab('active')}
          style={{
            padding: '8px 24px',
            border: 'none',
            background: tab === 'active' ? '#10b981' : 'transparent',
            color: tab === 'active' ? '#fff' : '#222',
            fontWeight: tab === 'active' ? 700 : 400,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >Aktif</button>
        <button
          onClick={() => setTab('passive')}
          style={{
            padding: '8px 24px',
            border: 'none',
            borderRadius: '0 6px 6px 0',
            background: tab === 'passive' ? '#ef4444' : 'transparent',
            color: tab === 'passive' ? '#fff' : '#222',
            fontWeight: tab === 'passive' ? 700 : 400,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >Pasif</button>
      </div>
      <PersonnelCreateModal
        isOpen={showNewPersonnelModal}
        onClose={() => setShowNewPersonnelModal(false)}
        onSuccess={(result) => {
          setShowNewPersonnelModal(false);
          setNotice(result?.invitationEmailSent
            ? { type: 'success', text: `${result.email || 'Kullanici'} olusturuldu ve davet e-postasi gonderildi.` }
            : { type: 'error', text: `${result?.email || 'Kullanici'} olusturuldu ancak davet e-postasi gonderilemedi. SMTP ayarlarini kontrol edin.` });
          loadData();
        }}
      />
      {/* Düzenle modalı */}
      <PersonnelCreateModal
        isOpen={!!editPersonnel}
        onClose={() => setEditPersonnel(null)}
        onSuccess={() => {
          setEditPersonnel(null);
          setNotice({ type: 'success', text: 'Kullanici bilgileri guncellendi.' });
          loadData();
        }}
        editData={editPersonnel}
      />
      {/* Detay modalı (gelişmiş) */}
      {detailPersonnel && (
        <PersonnelDetailModal
          personnel={detailPersonnel}
          onClose={() => setDetailPersonnel(null)}
          onResetPassword={readOnly ? undefined : async (id: number) => {
            try {
              const { adminResetPassword } = await import("../../services/admin.service");
              const res = await adminResetPassword(id);
              alert("Şifre sıfırlandı! Magic link veya geçici şifre: " + (res.temp_password || "Gönderildi"));
            } catch (err) {
              alert("Şifre sıfırlanamadı: " + (err instanceof Error ? err.message : err));
            }
          }}
        />
      )}
      {segment === 'portal' && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: 12, textAlign: "left" }}>Ad Soyad</th>
                <th style={{ padding: 12, textAlign: "left" }}>Email</th>
                <th style={{ padding: 12, textAlign: "left" }}>Operasyonel / Sistem Rolü</th>
                <th style={{ padding: 12, textAlign: "center" }}>Aktif/Pasif</th>
                <th style={{ padding: 12, textAlign: "center" }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {portalPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 20, color: "#888" }}>
                    Portal personeli bulunamadi.
                  </td>
                </tr>
              ) : (
                portalPersonnel.map((person) => (
                  <tr key={person.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 12, textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{person.full_name}</div>
                    </td>
                    <td style={{ padding: 12, textAlign: 'left' }}>{person.email}</td>
                    <td style={{ padding: 12, textAlign: 'left' }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {getRoleLabel(person.role) || roles.find(r => r.name === person.role)?.name || person.role || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Sistem rolü: {person.system_role ? getRoleLabel(person.system_role) : "Tenant Üyesi / Varsayılan"}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: 12, textAlign: "center" }}>{person.is_active ? 'Aktif' : 'Pasif'}</td>
                    <td style={{ padding: 12, textAlign: "center", minWidth: 180 }}>
                      <button
                        style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 500, cursor: 'pointer' }}
                        onClick={async () => setDetailPersonnel(await hydratePersonnel(person))}
                        disabled={loadingPersonId === person.id}
                      >{loadingPersonId === person.id ? 'Yükleniyor...' : 'Detay'}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {segment === 'partner' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {strategicPartnerGroups.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              Stratejik partner personeli bulunamadi.
            </div>
          ) : strategicPartnerGroups.map((group) => (
            <div key={group.key} style={{ border: '1px solid #d1fae5', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setExpandedPartnerGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                style={{ width: '100%', border: 'none', background: '#ecfeff', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 800, color: '#155e75' }}>{group.name}</span>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>{group.users.length} personel</span>
              </button>
              {expandedPartnerGroups[group.key] && (
                <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                  {group.users.map((person) => (
                    <div key={person.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{person.full_name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{person.email}</div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          {getRoleLabel(person.role)} · {person.system_role ? getRoleLabel(person.system_role) : 'Tenant Uyesi'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                          onClick={async () => setDetailPersonnel(await hydratePersonnel(person))}
                          disabled={loadingPersonId === person.id}
                        >Detay</button>
                        {!readOnly && (
                          <button
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                            onClick={async () => setEditPersonnel(await hydratePersonnel(person))}
                            disabled={loadingPersonId === person.id}
                          >Düzenle</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {segment === 'supplier' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {supplierLoading && <div style={{ color: '#64748b' }}>Tedarikci personelleri yukleniyor...</div>}
          {supplierError && <div style={{ color: '#b91c1c' }}>{supplierError}</div>}
          {!supplierLoading && !supplierError && supplierGroups.length === 0 && (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              Tedarikci personeli bulunamadi.
            </div>
          )}
          {!supplierLoading && !supplierError && supplierGroups.map((group) => (
            <div key={group.supplier.id} style={{ border: '1px solid #fed7aa', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setExpandedSupplierGroups((prev) => ({ ...prev, [group.supplier.id]: !prev[group.supplier.id] }))}
                style={{ width: '100%', border: 'none', background: '#fffbeb', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 800, color: '#92400e' }}>{group.supplier.company_name}</span>
                <span style={{ color: '#b45309', fontWeight: 700 }}>{group.users.length} personel</span>
              </button>
              {expandedSupplierGroups[group.supplier.id] && (
                <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                  {group.users.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Kayitli tedarikci personeli yok.</div>
                  ) : group.users.map((userItem) => (
                    <div key={userItem.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{userItem.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{userItem.email}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{userItem.phone || 'Telefon bilgisi yok'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
