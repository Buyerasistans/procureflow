import { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelDetailModal from "../../components/PersonnelDetailModal";
import type { Company, Role, Tenant, TenantUser } from "../../services/admin.service";
import type { TenantUsersQueryParams } from "../../services/admin.service";
import { PersonnelCreateModal } from "../../components/PersonnelCreateModal";
import {
  getAdminSupplierUsers,
  getAdminSuppliers,
  getUserCompanyAssignments,
  updateTenantUser,
  deleteTenantUser,
  updateAdminSupplierUser,
  deleteAdminSupplierUser,
  type AdminSupplierListItem,
  type AdminSupplierUserListItem,
} from "../../services/admin.service";
import { getPersonnelRolePermissionMatrix, getRoleLabel } from "../../auth/permissions";
import { buildTenantScopeMap, resolvePersonnelScope as resolvePersonnelScopeByMap } from "../../utils/scopeResolver";


interface PersonnelTabProps {
  personnel: TenantUser[];
  roles: Role[];
  companies?: Company[];
  loadData: () => Promise<void>;
  readOnly?: boolean;
  isChannelUser?: boolean;
  tenants?: Tenant[];
  reloadPersonnel?: (params?: TenantUsersQueryParams) => Promise<void>;
}

type PersonnelSegment = "portal" | "partner" | "channel" | "supplier";

type StrategicPartnerGroup = {
  key: string;
  name: string;
  users: Array<TenantUser & { primaryCompanyName: string; secondaryCompanyNames: string[] }>;
};

type CompanyPersonnelGroup = {
  key: string;
  name: string;
  users: Array<TenantUser & { primaryCompanyName: string; secondaryCompanyNames: string[] }>;
};

type PartnerTenantGroup = {
  key: string;
  name: string;
  companies: CompanyPersonnelGroup[];
};

type SupplierPersonnelGroup = {
  supplier: AdminSupplierListItem;
  users: AdminSupplierUserListItem[];
};

export function PersonnelTab(props: PersonnelTabProps) {
  const { personnel, roles, companies = [], loadData, readOnly = false, isChannelUser = false, tenants = [] } = props;
  const PLATFORM_SUPER_ADMIN_EMAIL = 'superadmin@buyerasistans.com.tr';
  const segmentStorageKey = isChannelUser
    ? 'procureflow.personnel.segment.channel'
    : 'procureflow.personnel.segment.admin';

  const [showNewPersonnelModal, setShowNewPersonnelModal] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<TenantUser | null>(null);
  const [detailPersonnel, setDetailPersonnel] = useState<TenantUser | null>(null);
  const [tab, setTab] = useState<'all' | 'active' | 'passive'>('all');
  const [segment, setSegment] = useState<PersonnelSegment>(() => {
    const fallback: PersonnelSegment = isChannelUser ? 'channel' : 'portal';
    if (typeof window === 'undefined') return fallback;
    const stored = window.sessionStorage.getItem(segmentStorageKey);
    if (stored === 'portal' || stored === 'partner' || stored === 'channel' || stored === 'supplier') {
      return stored;
    }
    return fallback;
  });
  const [supplierGroups, setSupplierGroups] = useState<SupplierPersonnelGroup[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [expandedPartnerGroups, setExpandedPartnerGroups] = useState<Record<string, boolean>>({});
  const [expandedPartnerCompanyGroups, setExpandedPartnerCompanyGroups] = useState<Record<string, boolean>>({});
  const [expandedSupplierGroups, setExpandedSupplierGroups] = useState<Record<number, boolean>>({});
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'platform' | 'portal' | 'channel' | 'supplier'>('all');
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [loadingPersonId, setLoadingPersonId] = useState<number | null>(null);
  const [supplierReloadNonce, setSupplierReloadNonce] = useState(0);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const normalizeTrText = useCallback((value?: string | null): string => {
    if (!value) return '';
    const input = String(value);

    // If text already looks fine Turkish/ASCII, don't touch it.
    if (!/[ÃÅÄ�ï¿½]/.test(input) && !/\?[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(input)) {
      return input;
    }

    // Try to recover common mojibake (UTF-8 bytes interpreted as Latin-1/CP1252).
    let current = input;
    for (let i = 0; i < 2; i += 1) {
      try {
        const bytes = Uint8Array.from(current, (char) => char.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (!decoded || decoded === current) break;
        current = decoded;
      } catch {
        break;
      }
    }

    const fallbackMap: Array<[RegExp, string]> = [
      [/Ã§/g, "ç"], [/Ã‡/g, "Ç"],
      [/Ä±/g, "ı"], [/Ä°/g, "İ"],
      [/Ã¶/g, "ö"], [/Ã–/g, "Ö"],
      [/Ã¼/g, "ü"], [/Ãœ/g, "Ü"],
      [/ÅŸ/g, "ş"], [/Åž/g, "Ş"],
      [/ÄŸ/g, "ğ"], [/Äž/g, "Ğ"],
      [/ï¿½/g, ""],
      [/([a-zA-ZçğıöşüÇĞİÖŞÜ])\?([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, "$1ı$2"],
    ];
    let fixed = current;
    fallbackMap.forEach(([pattern, replacement]) => {
      fixed = fixed.replace(pattern, replacement);
    });
    return fixed;
  }, []);

  const changeSegment = useCallback((next: PersonnelSegment) => {
    setSegment(next);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(segmentStorageKey, next);
    }
  }, [segmentStorageKey]);

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

  const companiesById = useMemo(
    () => new Map(companies.map((company) => [company.id, company] as const)),
    [companies],
  );

  const tenantScopeMap = useMemo(
    () => buildTenantScopeMap(tenants, personnel, []),
    [tenants, personnel],
  );

  const resolvePersonnelScope = useCallback((person: TenantUser): PersonnelSegment => {
    return resolvePersonnelScopeByMap(person, tenantScopeMap, companiesById) as PersonnelSegment;
  }, [companiesById, tenantScopeMap]);

  const getMembershipLabel = (person: TenantUser): string => {
    const scope = resolvePersonnelScope(person);
    if (scope === 'partner') return 'Stratejik Partner Üyesi';
    if (scope === 'channel') return 'İş Ortağı Üyemiz';
    if (scope === 'supplier') return 'Tedarikçi Üyesi';
    return 'Platform Üyesi';
  };

  const getSystemRoleLabelForPerson = (person: TenantUser): string => {
    const normalizedSystemRole = String(person.system_role || '').toLowerCase();
    if (normalizedSystemRole === 'tenant_member' || normalizedSystemRole === 'tenant_owner') {
      return normalizeTrText(getMembershipLabel(person));
    }
    return normalizeTrText(person.system_role ? getRoleLabel(person.system_role) : getMembershipLabel(person));
  };

  const portalPersonnel = useMemo(
    () => filteredPersonnel
      .filter((person) => resolvePersonnelScope(person) === 'portal')
      .sort((left, right) => {
        const leftIsSuperAdmin = String(left.email || '').trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
        const rightIsSuperAdmin = String(right.email || '').trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
        if (leftIsSuperAdmin !== rightIsSuperAdmin) return leftIsSuperAdmin - rightIsSuperAdmin;
        return normalizeTrText(left.full_name).localeCompare(normalizeTrText(right.full_name), 'tr');
      }),
    [filteredPersonnel, normalizeTrText],
  );

  const portalPrimaryCompanyName = useMemo(() => {
    const portalCompanies = companies
      .filter((company) => company.tenant_id == null || company.is_platform_primary)
      .sort((left, right) => {
        const leftScore = left.is_platform_primary || left.is_primary ? 0 : 1;
        const rightScore = right.is_platform_primary || right.is_primary ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return normalizeTrText(left.name).localeCompare(normalizeTrText(right.name), 'tr');
      });
    return normalizeTrText(portalCompanies[0]?.name || 'Portal Ana Firma Ataması Yok');
  }, [companies, normalizeTrText]);

  const strategicPartnerPersonnel = useMemo(
    () => filteredPersonnel.filter((person) => resolvePersonnelScope(person) === 'partner'),
    [filteredPersonnel],
  );

  const channelPersonnel = useMemo(
    () => filteredPersonnel.filter((person) => resolvePersonnelScope(person) === 'channel'),
    [filteredPersonnel],
  );

  const decorateWithCompanyContext = useCallback((
    person: TenantUser,
  ): TenantUser & { primaryCompanyName: string; secondaryCompanyNames: string[] } => {
    const assignmentNames = (person.company_assignments || [])
      .sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))
      .map((assignment) => String(assignment.company?.name || '').trim())
      .filter(Boolean);

    const uniqueCompanyNames = Array.from(new Set(assignmentNames));
    const primaryCompanyName = normalizeTrText(uniqueCompanyNames[0] || 'Firma Ataması Yok');
    const secondaryCompanyNames = uniqueCompanyNames.slice(1);

    return {
      ...person,
      primaryCompanyName,
      secondaryCompanyNames,
    };
  }, [normalizeTrText]);

  const portalCompanyGroups = useMemo<CompanyPersonnelGroup[]>(() => {
    const groups = new Map<string, CompanyPersonnelGroup>();
    portalPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      const groupName = decorated.primaryCompanyName === 'Firma Ataması Yok'
        ? portalPrimaryCompanyName
        : decorated.primaryCompanyName;
      const key = `portal-${groupName}`;
      if (!groups.has(key)) {
        groups.set(key, { key, name: groupName, users: [] });
      }
      groups.get(key)?.users.push({ ...decorated, primaryCompanyName: groupName });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        users: [...group.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), 'tr')),
      }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), 'tr'));
  }, [decorateWithCompanyContext, normalizeTrText, portalPersonnel, portalPrimaryCompanyName]);

  const strategicPartnerTenantGroups = useMemo<PartnerTenantGroup[]>(() => {
    const tenantMap = new Map<string, { name: string; companyMap: Map<string, CompanyPersonnelGroup> }>();

    strategicPartnerPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      const tenantId = decorated.tenant_id ?? null;
      const tenantKey = tenantId != null ? `tenant-${tenantId}` : 'tenant-atamasiz';
      // Resolve tenant display name from tenants list
      const matchedTenant = tenantId != null ? tenants.find((t) => t.id === tenantId) : null;
      const primaryCompany = tenantId != null
        ? companies
          .filter((company) => company.tenant_id === tenantId)
          .sort((left, right) => {
            const leftScore = left.is_primary ? 0 : 1;
            const rightScore = right.is_primary ? 0 : 1;
            if (leftScore !== rightScore) return leftScore - rightScore;
            return normalizeTrText(left.name).localeCompare(normalizeTrText(right.name), 'tr');
          })[0]
        : null;
      const resolvedTenantLabel = matchedTenant
        ? (primaryCompany?.name || matchedTenant.brand_name || matchedTenant.legal_name)
        : (tenantId != null ? `Stratejik Partner #${tenantId}` : 'Stratejik Partner Ataması Yok');
      const tenantName = normalizeTrText(resolvedTenantLabel);

      if (!tenantMap.has(tenantKey)) {
        tenantMap.set(tenantKey, { name: tenantName, companyMap: new Map<string, CompanyPersonnelGroup>() });
      }
      const tenantEntry = tenantMap.get(tenantKey);
      if (!tenantEntry) return;

      const companyKey = `${tenantKey}::${decorated.primaryCompanyName}`;
      if (!tenantEntry.companyMap.has(companyKey)) {
        tenantEntry.companyMap.set(companyKey, {
          key: companyKey,
          name: decorated.primaryCompanyName,
          users: [],
        });
      }
      tenantEntry.companyMap.get(companyKey)?.users.push({ ...decorated, secondaryCompanyNames: decorated.secondaryCompanyNames });
    });

    return Array.from(tenantMap.entries())
      .map(([key, tenant]) => ({
        key,
        name: tenant.name,
        companies: Array.from(tenant.companyMap.values())
          .map((company) => ({
            ...company,
            users: [...company.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), 'tr')),
          }))
          .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), 'tr')),
      }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), 'tr'));
  }, [companies, strategicPartnerPersonnel, tenants, normalizeTrText, decorateWithCompanyContext]);

  const strategicPartnerGroups = useMemo<StrategicPartnerGroup[]>(() => {
    const groups = new Map<string, StrategicPartnerGroup>();
    channelPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      const tenantId = decorated.tenant_id ?? null;
      const firstCompanyName = (decorated.company_assignments || [])
        .map((assignment) => assignment.company?.name)
        .find(Boolean);
      const key = tenantId != null ? `tenant-${tenantId}` : `company-${firstCompanyName || 'atamasiz'}`;

      if (!groups.has(key)) {
        groups.set(key, { key, name: '', users: [] });
      }
      groups.get(key)?.users.push({ ...decorated, secondaryCompanyNames: decorated.secondaryCompanyNames });
    });

    return Array.from(groups.values())
      .map((group) => {
        const owner = group.users.find((user) => String(user.role || '').toLowerCase() === 'channel_owner');
        const primaryCompanyName = group.users
          .map((user) => (user as TenantUser & { primaryCompanyName?: string }).primaryCompanyName)
          .find((name) => !!name && name !== 'Firma Ataması Yok');
        const workspaceLabel = normalizeTrText(primaryCompanyName || owner?.full_name || 'İş Ortağı Ataması Yok');
        const groupName = isChannelUser ? `Kanal Ekibi - ${workspaceLabel}` : `İş Ortağı - ${workspaceLabel}`;
        return {
          ...group,
          name: normalizeTrText(groupName),
          users: [...group.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), 'tr')),
        };
      })
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), 'tr'));
  }, [channelPersonnel, isChannelUser, normalizeTrText, decorateWithCompanyContext]);

  useEffect(() => {
    if (!isChannelUser) return;
    changeSegment('channel');
    setMatrixFilter('channel');
  }, [changeSegment, isChannelUser]);

  useEffect(() => {
    if (strategicPartnerGroups.length === 0) return;
    setExpandedPartnerGroups((prev) => ({
      ...prev,
      ...Object.fromEntries(strategicPartnerGroups.map((g) => [g.key, true])),
    }));
  }, [strategicPartnerGroups]);

  useEffect(() => {
    if (strategicPartnerTenantGroups.length === 0) return;
    setExpandedPartnerGroups((prev) => ({
      ...prev,
      ...Object.fromEntries(strategicPartnerTenantGroups.map((g) => [g.key, true])),
    }));
  }, [strategicPartnerTenantGroups]);

  useEffect(() => {
    if (strategicPartnerTenantGroups.length === 0) return;
    const nextCompanyGroups: Record<string, boolean> = {};
    strategicPartnerTenantGroups.forEach((tenantGroup) => {
      tenantGroup.companies.forEach((companyGroup) => {
        nextCompanyGroups[companyGroup.key] = true;
      });
    });
    setExpandedPartnerCompanyGroups(nextCompanyGroups);
  }, [strategicPartnerTenantGroups]);

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
          setSupplierError(error instanceof Error ? error.message : 'Tedarikçi listesi yüklenemedi.');
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
  }, [segment, supplierReloadNonce, tab]);

  function toStatus(value: boolean): string {
    return value ? 'Açık' : 'Kapalı';
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

  async function togglePersonnelActive(person: TenantUser, nextActive: boolean) {
    if (readOnly) return;
    try {
      setLoadingPersonId(person.id);
      await updateTenantUser(person.id, { is_active: nextActive });
      setNotice({ type: 'success', text: `${normalizeTrText(person.full_name)} kaydı ${nextActive ? 'aktif' : 'pasif'} yapıldı.` });
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Aktiflik güncellenemedi.' });
    } finally {
      setLoadingPersonId(null);
    }
  }

  async function removePersonnel(person: TenantUser) {
    if (readOnly) return;
    if (person.is_active) {
      setNotice({ type: 'error', text: 'Aktif personel silinemez. Once tik kutusundan pasife alin.' });
      return;
    }
    if (!window.confirm(`${normalizeTrText(person.full_name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) {
      return;
    }
    try {
      setLoadingPersonId(person.id);
      await deleteTenantUser(person.id);
      setNotice({ type: 'success', text: `${normalizeTrText(person.full_name)} kaydı silindi.` });
      await loadData();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Silme işlemi başarısız.' });
    } finally {
      setLoadingPersonId(null);
    }
  }

  async function toggleSupplierUserActive(supplierId: number, userItem: AdminSupplierUserListItem, nextActive: boolean) {
    if (readOnly) return;
    try {
      setLoadingPersonId(userItem.id);
      await updateAdminSupplierUser(supplierId, userItem.id, {
        name: userItem.name,
        email: userItem.email,
        phone: userItem.phone || undefined,
        is_active: nextActive,
      });
      setNotice({ type: 'success', text: `${normalizeTrText(userItem.name)} kaydı ${nextActive ? 'aktif' : 'pasif'} yapıldı.` });
      setSupplierReloadNonce((prev) => prev + 1);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Tedarikçi kullanıcı aktifliği güncellenemedi.' });
    } finally {
      setLoadingPersonId(null);
    }
  }

  async function editSupplierUser(supplierId: number, userItem: AdminSupplierUserListItem) {
    if (readOnly) return;
    const nextName = window.prompt('Kullanıcı adını güncelleyin', userItem.name);
    if (nextName == null) return;
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      setNotice({ type: 'error', text: 'Kullanıcı adı boş olamaz.' });
      return;
    }

    try {
      setLoadingPersonId(userItem.id);
      await updateAdminSupplierUser(supplierId, userItem.id, {
        name: trimmedName,
        email: userItem.email,
        phone: userItem.phone || undefined,
      });
      setNotice({ type: 'success', text: `${userItem.name} kaydı güncellendi.` });
      setSupplierReloadNonce((prev) => prev + 1);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Tedarikçi kullanıcı güncellenemedi.' });
    } finally {
      setLoadingPersonId(null);
    }
  }

  async function removeSupplierUser(supplierId: number, userItem: AdminSupplierUserListItem) {
    if (readOnly) return;
    if (userItem.is_active !== false) {
      setNotice({ type: 'error', text: 'Aktif tedarikçi kullanıcısı silinemez. Önce pasife alın.' });
      return;
    }
    if (!window.confirm(`${normalizeTrText(userItem.name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) {
      return;
    }

    try {
      setLoadingPersonId(userItem.id);
      await deleteAdminSupplierUser(supplierId, userItem.id);
      setNotice({ type: 'success', text: `${userItem.name} kaydı silindi.` });
      setSupplierReloadNonce((prev) => prev + 1);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Tedarikçi kullanıcı silinemedi.' });
    } finally {
      setLoadingPersonId(null);
    }
  }

  function renderStatusToggle(params: { active: boolean; label: string; disabled?: boolean; onClick: () => void }) {
    const { active, label, disabled = false, onClick } = params;
    return (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          border: 'none',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          fontWeight: 700,
          color: active ? '#15803d' : '#b91c1c',
        }}
      >
        <span style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${active ? '#16a34a' : '#dc2626'}`, background: active ? '#dcfce7' : '#fee2e2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
          {active ? '✓' : ''}
        </span>
        {active ? 'Aktif' : 'Pasif'}
      </button>
    );
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
          Platform personeli bu alanda kullanıcı listesini inceleyebilir; oluşturma, düzenleme, aktiflik değiştirme ve silme aksiyonları sadece tenant yönetim yetkisi olan hesaplarda açılır.
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
            {isChannelUser ? "Kanal Ekibi" : "Kullanıcı Yönetimi"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginTop: 6 }}>
            {isChannelUser ? "Kendi ekip ve atama görünümü" : "Ekip, atama ve iletişim bilgileri"}
          </div>
          <div style={{ marginTop: 10, color: "#475569" }}>
            {isChannelUser
              ? "Bu sekmede yalnızca kendi kanal ekibinizi görürsünüz. Diğer tenant veya kapsam kullanıcıları listelenmez."
              : "Tümü sekmesi artık aktif ve pasif tüm kayıtları gösterir. Sekmeleri durum bazlı filtrelemek için kullanabilirsiniz."}
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
          + Yeni Kullanıcı
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
        {(isChannelUser
          ? [
              { key: 'channel', label: `Kanal Ekibi (${channelPersonnel.length})`, color: '#0f766e' },
            ]
          : [
          { key: 'portal', label: `Portal Personelleri (${portalPersonnel.length})`, color: '#1d4ed8' },
          { key: 'partner', label: `Stratejik Partner Personeli (${strategicPartnerPersonnel.length})`, color: '#0f766e' },
          { key: 'channel', label: `İş Ortağı Personeli (${channelPersonnel.length})`, color: '#0e7490' },
          { key: 'supplier', label: `Tedarikçi Personeli (${supplierGroups.reduce((sum, group) => sum + group.users.length, 0)})`, color: '#b45309' },
          ]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => changeSegment(item.key as PersonnelSegment)}
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

      {!isChannelUser && (
      <div style={{ borderRadius: 20, border: "1px solid #fde68a", background: "#fffbeb", overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #fef3c7", display: "grid", gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#92400e", textTransform: "uppercase" }}>Rol Yetki Matrisi</div>
              <div style={{ color: "#78350f", fontSize: 13 }}>Güncel yetki modeline göre rol kombinasyonlarında açılan kritik yüzeylerin özet görünümü.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsMatrixOpen((prev) => !prev)}
                style={{ border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 12px', background: '#fff', color: '#78350f', fontWeight: 700, cursor: 'pointer' }}
              >
                {isMatrixOpen ? 'Matrisi Gizle' : 'Matrisi Aç'}
              </button>
              <select
                value={matrixFilter}
                onChange={(event) => setMatrixFilter(event.target.value as typeof matrixFilter)}
                aria-label="Rol yetki matrisi filtre seçimi"
                title="Rol yetki matrisi filtre seçimi"
                style={{ border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 10px', background: '#fff', color: '#78350f', fontWeight: 600 }}
              >
                <option value="all">Tüm Roller</option>
                <option value="platform">Platform Grubu</option>
                <option value="portal">Portal / Satın Alma</option>
                <option value="channel">Kanal / İş Ortağı</option>
                <option value="supplier">Tedarikçi</option>
              </select>
              <button
                type="button"
                onClick={exportMatrixAsCsv}
                disabled={!isMatrixOpen}
                style={{ border: 'none', borderRadius: 10, padding: '8px 12px', background: '#d97706', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                CSV Disa Aktar
              </button>
            </div>
          </div>
        </div>
        {isMatrixOpen && (
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
                <th style={{ padding: 10, textAlign: "center" }}>SP Yönetim Oku</th>
                <th style={{ padding: 10, textAlign: "center" }}>SP Yönetim Yaz</th>
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
        )}
      </div>
      )}

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
        contextScope={isChannelUser ? 'channel' : 'portal'}
        onSuccess={(result) => {
          setShowNewPersonnelModal(false);
          setNotice(result?.invitationEmailSent
            ? { type: 'success', text: `${result.email || 'Kullanıcı'} oluşturuldu ve davet e-postası gönderildi.` }
            : { type: 'error', text: `${result?.email || 'Kullanıcı'} oluşturuldu ancak davet e-postası gönderilemedi. SMTP ayarlarını kontrol edin.` });
          loadData();
        }}
      />
      {/* Düzenle modalı */}
      <PersonnelCreateModal
        isOpen={!!editPersonnel}
        onClose={() => setEditPersonnel(null)}
        contextScope={isChannelUser ? 'channel' : 'portal'}
        onSuccess={() => {
          setEditPersonnel(null);
          setNotice({ type: 'success', text: 'Kullanıcı bilgileri güncellendi.' });
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
      {!isChannelUser && segment === 'portal' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {portalCompanyGroups.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              Portal personeli bulunamadı.
            </div>
          ) : portalCompanyGroups.map((group) => (
            <div key={group.key} style={{ border: '1px solid #dbeafe', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <div style={{ background: '#eff6ff', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 800, color: '#1d4ed8' }}>{group.name}</span>
                <span style={{ color: '#334155', fontWeight: 700, whiteSpace: 'nowrap' }}>{group.users.length} personel</span>
              </div>
              <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                {group.users.map((person) => (
                  <div key={person.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 240, flex: '1 1 360px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{normalizeTrText(person.full_name)}</div>
                      <div style={{ fontSize: 12, color: '#64748b', overflowWrap: 'anywhere' }}>{person.email}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                        {normalizeTrText(getRoleLabel(person.role) || roles.find(r => r.name === person.role)?.name || person.role || "-")} · {getSystemRoleLabelForPerson(person)}
                      </div>
                      {person.secondaryCompanyNames.length > 0 && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                          Ayrıca yetkili olduğu firmalar: {person.secondaryCompanyNames.join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {renderStatusToggle({
                        active: !!person.is_active,
                        label: `${normalizeTrText(person.full_name)} durum kutusu`,
                        disabled: readOnly || loadingPersonId === person.id,
                        onClick: () => togglePersonnelActive(person, !person.is_active),
                      })}
                      <button
                        style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                        onClick={async () => setDetailPersonnel(await hydratePersonnel(person))}
                        disabled={loadingPersonId === person.id}
                      >{loadingPersonId === person.id ? 'Yükleniyor...' : 'Detay'}</button>
                      {!readOnly && (
                        <>
                          <button
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                            onClick={async () => setEditPersonnel(await hydratePersonnel(person))}
                            disabled={loadingPersonId === person.id}
                          >Düzenle</button>
                          <button
                            style={{ background: person.is_active ? '#cbd5e1' : '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: person.is_active ? 'not-allowed' : 'pointer' }}
                            disabled={person.is_active || loadingPersonId === person.id}
                            onClick={() => removePersonnel(person)}
                          >Sil</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(isChannelUser || segment === 'channel') && (
        <div style={{ display: 'grid', gap: 10 }}>
          {strategicPartnerGroups.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              İş ortağı personeli bulunamadı.
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
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{normalizeTrText(person.full_name)}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{person.email}</div>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          {normalizeTrText(getRoleLabel(person.role))} · {getSystemRoleLabelForPerson(person)}
                        </div>
                        {person.secondaryCompanyNames.length > 0 && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            Ayrica yetkili oldugu firmalar: {person.secondaryCompanyNames.join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {renderStatusToggle({
                          active: !!person.is_active,
                          label: `${normalizeTrText(person.full_name)} durum kutusu`,
                          disabled: readOnly || loadingPersonId === person.id,
                          onClick: () => togglePersonnelActive(person, !person.is_active),
                        })}
                        <button
                          style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                          onClick={async () => setDetailPersonnel(await hydratePersonnel(person))}
                          disabled={loadingPersonId === person.id}
                        >Detay</button>
                        {!readOnly && (
                          <>
                            <button
                              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                              onClick={async () => setEditPersonnel(await hydratePersonnel(person))}
                              disabled={loadingPersonId === person.id}
                            >Düzenle</button>
                            <button
                              style={{ background: person.is_active ? '#cbd5e1' : '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: person.is_active ? 'not-allowed' : 'pointer' }}
                              disabled={person.is_active || loadingPersonId === person.id}
                              onClick={() => removePersonnel(person)}
                            >Sil</button>
                          </>
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

      {!isChannelUser && segment === 'partner' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {strategicPartnerTenantGroups.length === 0 ? (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              Stratejik partner personeli bulunamadı.
            </div>
          ) : strategicPartnerTenantGroups.map((tenantGroup) => (
            <div key={tenantGroup.key} style={{ border: '1px solid #d1fae5', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setExpandedPartnerGroups((prev) => ({ ...prev, [tenantGroup.key]: !prev[tenantGroup.key] }))}
                style={{ width: '100%', border: 'none', background: '#ecfeff', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 800, color: '#155e75' }}>{tenantGroup.name}</span>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>{tenantGroup.companies.reduce((sum, company) => sum + company.users.length, 0)} personel</span>
              </button>
              {expandedPartnerGroups[tenantGroup.key] && (
                <div style={{ display: 'grid', gap: 10, padding: 12 }}>
                  {tenantGroup.companies.map((companyGroup) => (
                    <div key={companyGroup.key} style={{ border: '1px solid #dbeafe', borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setExpandedPartnerCompanyGroups((prev) => ({ ...prev, [companyGroup.key]: !prev[companyGroup.key] }))}
                        style={{ width: '100%', border: 'none', background: '#eff6ff', padding: '10px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{companyGroup.name}</span>
                        <span style={{ color: '#334155', fontWeight: 600 }}>{companyGroup.users.length} personel</span>
                      </button>
                      {expandedPartnerCompanyGroups[companyGroup.key] && (
                        <div style={{ display: 'grid', gap: 8, padding: 10 }}>
                          {companyGroup.users.map((person) => (
                            <div key={person.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{normalizeTrText(person.full_name)}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{person.email}</div>
                                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                  {normalizeTrText(getRoleLabel(person.role))} · {getSystemRoleLabelForPerson(person)}
                                </div>
                                {person.secondaryCompanyNames.length > 0 && (
                                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                    Ayrica yetkili oldugu firmalar: {person.secondaryCompanyNames.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {renderStatusToggle({
                                  active: !!person.is_active,
                                  label: `${normalizeTrText(person.full_name)} durum kutusu`,
                                  disabled: readOnly || loadingPersonId === person.id,
                                  onClick: () => togglePersonnelActive(person, !person.is_active),
                                })}
                                <button
                                  style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                                  onClick={async () => setDetailPersonnel(await hydratePersonnel(person))}
                                  disabled={loadingPersonId === person.id}
                                >Detay</button>
                                {!readOnly && (
                                  <>
                                    <button
                                      style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                                      onClick={async () => setEditPersonnel(await hydratePersonnel(person))}
                                      disabled={loadingPersonId === person.id}
                                    >Düzenle</button>
                                    <button
                                      style={{ background: person.is_active ? '#cbd5e1' : '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: person.is_active ? 'not-allowed' : 'pointer' }}
                                      disabled={person.is_active || loadingPersonId === person.id}
                                      onClick={() => removePersonnel(person)}
                                    >Sil</button>
                                  </>
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
            </div>
          ))}
        </div>
      )}

      {!isChannelUser && segment === 'supplier' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {supplierLoading && <div style={{ color: '#64748b' }}>Tedarikçi personelleri yükleniyor...</div>}
          {supplierError && <div style={{ color: '#b91c1c' }}>{supplierError}</div>}
          {!supplierLoading && !supplierError && supplierGroups.length === 0 && (
            <div style={{ padding: 20, border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b' }}>
              Tedarikçi personeli bulunamadı.
            </div>
          )}
          {!supplierLoading && !supplierError && supplierGroups.map((group) => (
            <div key={group.supplier.id} style={{ border: '1px solid #fed7aa', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
              <button
                type="button"
                onClick={() => setExpandedSupplierGroups((prev) => ({ ...prev, [group.supplier.id]: !prev[group.supplier.id] }))}
                style={{ width: '100%', border: 'none', background: '#fffbeb', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontWeight: 800, color: '#92400e' }}>{normalizeTrText(group.supplier.company_name)}</span>
                <span style={{ color: '#b45309', fontWeight: 700 }}>{group.users.length} personel</span>
              </button>
              {expandedSupplierGroups[group.supplier.id] && (
                <div style={{ display: 'grid', gap: 8, padding: 12 }}>
                  {group.users.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Kayıtlı tedarikçi personeli yok.</div>
                  ) : group.users.map((userItem) => {
                    const isActive = userItem.is_active !== false;
                    return (
                      <div key={userItem.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{normalizeTrText(userItem.name)}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{userItem.email}</div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{userItem.phone || 'Telefon bilgisi yok'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {renderStatusToggle({
                            active: isActive,
                            label: `${normalizeTrText(userItem.name)} durum kutusu`,
                            disabled: readOnly || loadingPersonId === userItem.id,
                            onClick: () => toggleSupplierUserActive(group.supplier.id, userItem, !isActive),
                          })}
                          <button
                            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                            onClick={() => setNotice({ type: 'success', text: `${normalizeTrText(userItem.name)} · ${userItem.email}${userItem.phone ? ` · ${userItem.phone}` : ''}` })}
                          >Detay</button>
                          {!readOnly && (
                            <>
                              <button
                                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
                                onClick={() => editSupplierUser(group.supplier.id, userItem)}
                                disabled={loadingPersonId === userItem.id}
                              >Düzenle</button>
                              <button
                                style={{ background: isActive ? '#cbd5e1' : '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: isActive ? 'not-allowed' : 'pointer' }}
                                disabled={isActive || loadingPersonId === userItem.id}
                                onClick={() => removeSupplierUser(group.supplier.id, userItem)}
                              >Sil</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

