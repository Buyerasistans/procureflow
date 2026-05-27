import { useCallback, useEffect, useMemo, useState } from "react";
import PersonnelDetailModal from "../../components/PersonnelDetailModal";
import { PersonnelCreateModal } from "../../components/PersonnelCreateModal";
import type { Company, Role, Tenant, TenantUser } from "../../services/admin.service";
import type { TenantUsersQueryParams } from "../../services/admin.service";
import {
  deleteAdminSupplierUser,
  deleteTenantUser,
  getAdminSupplierUsers,
  getAdminSuppliers,
  getUserCompanyAssignments,
  updateAdminSupplierUser,
  updateTenantUser,
  type AdminSupplierListItem,
  type AdminSupplierUserListItem,
} from "../../services/admin.service";
import { getPersonnelRolePermissionMatrix, getRoleLabel } from "../../auth/permissions";
import { buildTenantScopeMap, resolvePersonnelScope as resolvePersonnelScopeByMap } from "../../utils/scopeResolver";
import "./PersonnelTab.css";

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
type MatrixFilter = "all" | "platform" | "portal" | "channel" | "supplier";
type NoticeState = { type: "success" | "error"; text: string } | null;

type DecoratedPersonnel = TenantUser & { primaryCompanyName: string; secondaryCompanyNames: string[] };

type StrategicPartnerGroup = {
  key: string;
  name: string;
  users: DecoratedPersonnel[];
};

type CompanyPersonnelGroup = {
  key: string;
  name: string;
  users: DecoratedPersonnel[];
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
  const PLATFORM_SUPER_ADMIN_EMAIL = "superadmin@buyerasistans.com.tr";
  const segmentStorageKey = isChannelUser ? "procureflow.personnel.segment.channel" : "procureflow.personnel.segment.admin";

  const [showNewPersonnelModal, setShowNewPersonnelModal] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<TenantUser | null>(null);
  const [detailPersonnel, setDetailPersonnel] = useState<TenantUser | null>(null);
  const [tab, setTab] = useState<"all" | "active" | "passive">("all");
  const [segment, setSegment] = useState<PersonnelSegment>(() => {
    const fallback: PersonnelSegment = isChannelUser ? "channel" : "portal";
    if (typeof window === "undefined") return fallback;
    const stored = window.sessionStorage.getItem(segmentStorageKey);
    if (stored === "portal" || stored === "partner" || stored === "channel" || stored === "supplier") {
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
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>("all");
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [loadingPersonId, setLoadingPersonId] = useState<number | null>(null);
  const [supplierReloadNonce, setSupplierReloadNonce] = useState(0);
  const [notice, setNotice] = useState<NoticeState>(null);

  const normalizeTrText = useCallback((value?: string | null): string => {
    if (!value) return "";
    const input = String(value);

    if (!/[ÃÅÄï¿½]/.test(input) && !/\?[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(input)) {
      return input;
    }

    let current = input;
    for (let i = 0; i < 2; i += 1) {
      try {
        const bytes = Uint8Array.from(current, (char) => char.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        if (!decoded || decoded === current) break;
        current = decoded;
      } catch {
        break;
      }
    }

    const fallbackMap: Array<[RegExp, string]> = [
      [/Ã§/g, "ç"],
      [/Ã‡/g, "Ç"],
      [/Ä±/g, "ı"],
      [/Ä°/g, "İ"],
      [/Ã¶/g, "ö"],
      [/Ã–/g, "Ö"],
      [/Ã¼/g, "ü"],
      [/Ãœ/g, "Ü"],
      [/ÅŸ/g, "ş"],
      [/Åž/g, "Ş"],
      [/ÄŸ/g, "ğ"],
      [/Äž/g, "Ğ"],
      [/ï¿½/g, ""],
      [/([a-zA-ZçğıöşüÇĞİÖŞÜ])\?([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, "$1ı$2"],
    ];

    let fixed = current;
    fallbackMap.forEach(([pattern, replacement]) => {
      fixed = fixed.replace(pattern, replacement);
    });
    return fixed;
  }, []);

  const changeSegment = useCallback(
    (next: PersonnelSegment) => {
      setSegment(next);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(segmentStorageKey, next);
      }
    },
    [segmentStorageKey],
  );

  const stats = useMemo(
    () => ({
      total: personnel.length,
      active: personnel.filter((person) => person.is_active).length,
      passive: personnel.filter((person) => !person.is_active).length,
    }),
    [personnel],
  );

  const filteredPersonnel = useMemo(() => {
    if (tab === "active") return personnel.filter((person) => person.is_active);
    if (tab === "passive") return personnel.filter((person) => !person.is_active);
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

  const resolvePersonnelScope = useCallback(
    (person: TenantUser): PersonnelSegment => resolvePersonnelScopeByMap(person, tenantScopeMap, companiesById) as PersonnelSegment,
    [companiesById, tenantScopeMap],
  );

  const getMembershipLabel = useCallback(
    (person: TenantUser): string => {
      const scope = resolvePersonnelScope(person);
      if (scope === "partner") return "Stratejik Partner Üyesi";
      if (scope === "channel") return "İş Ortağı Üyemiz";
      if (scope === "supplier") return "Tedarikçi Üyesi";
      return "Platform Üyesi";
    },
    [resolvePersonnelScope],
  );

  const getSystemRoleLabelForPerson = useCallback(
    (person: TenantUser): string => {
      const normalizedSystemRole = String(person.system_role || "").toLowerCase();
      if (normalizedSystemRole === "tenant_member" || normalizedSystemRole === "tenant_owner") {
        return normalizeTrText(getMembershipLabel(person));
      }
      return normalizeTrText(person.system_role ? getRoleLabel(person.system_role) : getMembershipLabel(person));
    },
    [getMembershipLabel, normalizeTrText],
  );

  const decorateWithCompanyContext = useCallback(
    (person: TenantUser): DecoratedPersonnel => {
      const assignmentNames = (person.company_assignments || [])
        .sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))
        .map((assignment) => String(assignment.company?.name || "").trim())
        .filter(Boolean);

      const uniqueCompanyNames = Array.from(new Set(assignmentNames));
      return {
        ...person,
        primaryCompanyName: normalizeTrText(uniqueCompanyNames[0] || "Firma Ataması Yok"),
        secondaryCompanyNames: uniqueCompanyNames.slice(1),
      };
    },
    [normalizeTrText],
  );

  const portalPrimaryCompanyName = useMemo(() => {
    const portalCompanies = companies
      .filter((company) => company.tenant_id == null || company.is_platform_primary)
      .sort((left, right) => {
        const leftScore = left.is_platform_primary || left.is_primary ? 0 : 1;
        const rightScore = right.is_platform_primary || right.is_primary ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return normalizeTrText(left.name).localeCompare(normalizeTrText(right.name), "tr");
      });

    return normalizeTrText(portalCompanies[0]?.name || "Portal Ana Firma Ataması Yok");
  }, [companies, normalizeTrText]);

  const portalPersonnel = useMemo(
    () =>
      filteredPersonnel
        .filter((person) => resolvePersonnelScope(person) === "portal")
        .sort((left, right) => {
          const leftIsSuperAdmin = String(left.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
          const rightIsSuperAdmin = String(right.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
          if (leftIsSuperAdmin !== rightIsSuperAdmin) return leftIsSuperAdmin - rightIsSuperAdmin;
          return normalizeTrText(left.full_name).localeCompare(normalizeTrText(right.full_name), "tr");
        }),
    [PLATFORM_SUPER_ADMIN_EMAIL, filteredPersonnel, normalizeTrText, resolvePersonnelScope],
  );

  const strategicPartnerPersonnel = useMemo(
    () => filteredPersonnel.filter((person) => resolvePersonnelScope(person) === "partner"),
    [filteredPersonnel, resolvePersonnelScope],
  );

  const channelPersonnel = useMemo(
    () => filteredPersonnel.filter((person) => resolvePersonnelScope(person) === "channel"),
    [filteredPersonnel, resolvePersonnelScope],
  );

  const portalCompanyGroups = useMemo<CompanyPersonnelGroup[]>(() => {
    const groups = new Map<string, CompanyPersonnelGroup>();
    portalPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      // Platform kullanıcıları (tenant yok) daima platform ana firması altında grupla
      const isPlatformUser = decorated.tenant_id == null;
      const groupName = isPlatformUser
        ? portalPrimaryCompanyName
        : (decorated.primaryCompanyName === "Firma Ataması Yok" ? portalPrimaryCompanyName : decorated.primaryCompanyName);
      const key = `portal-${groupName}`;
      if (!groups.has(key)) {
        groups.set(key, { key, name: groupName, users: [] });
      }
      groups.get(key)?.users.push({ ...decorated, primaryCompanyName: groupName });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        users: [...group.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")),
      }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr"));
  }, [decorateWithCompanyContext, normalizeTrText, portalPersonnel, portalPrimaryCompanyName]);

  const strategicPartnerTenantGroups = useMemo<PartnerTenantGroup[]>(() => {
    const tenantMap = new Map<string, { name: string; companyMap: Map<string, CompanyPersonnelGroup> }>();

    strategicPartnerPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      const tenantId = decorated.tenant_id ?? null;
      const tenantKey = tenantId != null ? `tenant-${tenantId}` : "tenant-atamasiz";
      const matchedTenant = tenantId != null ? tenants.find((t) => t.id === tenantId) : null;
      const primaryCompany =
        tenantId != null
          ? companies
              .filter((company) => company.tenant_id === tenantId)
              .sort((left, right) => {
                const leftScore = left.is_primary ? 0 : 1;
                const rightScore = right.is_primary ? 0 : 1;
                if (leftScore !== rightScore) return leftScore - rightScore;
                return normalizeTrText(left.name).localeCompare(normalizeTrText(right.name), "tr");
              })[0]
          : null;
      const resolvedTenantLabel = matchedTenant
        ? primaryCompany?.name || matchedTenant.brand_name || matchedTenant.legal_name
        : tenantId != null
          ? `Stratejik Partner #${tenantId}`
          : "Stratejik Partner Ataması Yok";
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
            users: [...company.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")),
          }))
          .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr")),
      }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr"));
  }, [companies, decorateWithCompanyContext, normalizeTrText, strategicPartnerPersonnel, tenants]);

  const strategicPartnerGroups = useMemo<StrategicPartnerGroup[]>(() => {
    const groups = new Map<string, StrategicPartnerGroup>();
    channelPersonnel.forEach((person) => {
      const decorated = decorateWithCompanyContext(person);
      const tenantId = decorated.tenant_id ?? null;
      const firstCompanyName = (decorated.company_assignments || []).map((assignment) => assignment.company?.name).find(Boolean);
      const key = tenantId != null ? `tenant-${tenantId}` : `company-${firstCompanyName || "atamasiz"}`;

      if (!groups.has(key)) {
        groups.set(key, { key, name: "", users: [] });
      }
      groups.get(key)?.users.push({ ...decorated, secondaryCompanyNames: decorated.secondaryCompanyNames });
    });

    return Array.from(groups.values())
      .map((group) => {
        const owner = group.users.find((user) => String(user.role || "").toLowerCase() === "channel_owner");
        const primaryCompanyName = group.users
          .map((user) => (user as TenantUser & { primaryCompanyName?: string }).primaryCompanyName)
          .find((name) => !!name && name !== "Firma Ataması Yok");
        const workspaceLabel = normalizeTrText(primaryCompanyName || owner?.full_name || "İş Ortağı Ataması Yok");
        const groupName = isChannelUser ? `Kanal Ekibi - ${workspaceLabel}` : `İş Ortağı - ${workspaceLabel}`;
        return {
          ...group,
          name: normalizeTrText(groupName),
          users: [...group.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")),
        };
      })
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr"));
  }, [channelPersonnel, decorateWithCompanyContext, isChannelUser, normalizeTrText]);

  const permissionMatrix = useMemo(() => getPersonnelRolePermissionMatrix(), []);

  const filteredPermissionMatrix = useMemo(() => {
    if (matrixFilter === "all") return permissionMatrix;
    return permissionMatrix.filter((row) => row.group === matrixFilter);
  }, [matrixFilter, permissionMatrix]);

  useEffect(() => {
    if (!isChannelUser) return;
    changeSegment("channel");
    setMatrixFilter("channel");
  }, [changeSegment, isChannelUser]);

  useEffect(() => {
    if (strategicPartnerGroups.length === 0) return;
    setExpandedPartnerGroups((prev) => ({
      ...prev,
      ...Object.fromEntries(strategicPartnerGroups.map((group) => [group.key, true])),
    }));
  }, [strategicPartnerGroups]);

  useEffect(() => {
    if (strategicPartnerTenantGroups.length === 0) return;
    setExpandedPartnerGroups((prev) => ({
      ...prev,
      ...Object.fromEntries(strategicPartnerTenantGroups.map((group) => [group.key, true])),
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

  useEffect(() => {
    if (segment !== "supplier") return;

    let cancelled = false;
    setSupplierLoading(true);
    setSupplierError(null);

    (async () => {
      try {
        const suppliers = await getAdminSuppliers({ filter_active: tab !== "passive" });
        const groups = await Promise.all(
          suppliers.map(async (supplier) => {
            try {
              const users = await getAdminSupplierUsers(supplier.id);
              const filteredUsers = users.filter((userItem) => {
                if (tab === "all") return true;
                if (tab === "active") return userItem.is_active !== false;
                return userItem.is_active === false;
              });
              return { supplier, users: filteredUsers };
            } catch {
              return { supplier, users: [] };
            }
          }),
        );

        if (!cancelled) {
          setSupplierGroups(groups.sort((left, right) => left.supplier.company_name.localeCompare(right.supplier.company_name, "tr")));
        }
      } catch (error) {
        if (!cancelled) {
          setSupplierError(error instanceof Error ? error.message : "Tedarikçi listesi yüklenemedi.");
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

  const toStatus = useCallback((value: boolean): string => (value ? "Açık" : "Kapalı"), []);

  const exportMatrixAsCsv = useCallback(() => {
    const headers = [
      "operasyonel_rol",
      "sistem_rolu",
      "admin_yuzeyi",
      "kullanici_yonetimi",
      "teklif_alani",
      "onay_inceleme",
      "stratejik_partner_okuma",
      "stratejik_partner_yazma",
      "destek_akisi",
      "tenant_kimlik_ayarlari",
      "ortak_eposta_profilleri",
    ];

    const lines = filteredPermissionMatrix.map((row) =>
      [
        row.businessRoleLabel,
        row.systemRoleLabel,
        toStatus(row.adminSurface),
        toStatus(row.manageUsers),
        toStatus(row.quoteWorkspace),
        toStatus(row.reviewApprovals),
        toStatus(row.tenantGovernanceRead),
        toStatus(row.tenantGovernanceWrite),
        row.supportWorkflow,
        row.tenantIdentitySettings,
        row.sharedEmailProfiles,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateTag = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `rol_yetki_matrisi_${matrixFilter}_${dateTag}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }, [filteredPermissionMatrix, matrixFilter, toStatus]);

  const hydratePersonnel = useCallback(async (person: TenantUser): Promise<TenantUser> => {
    setLoadingPersonId(person.id);
    try {
      const assignments = await getUserCompanyAssignments(person.id);
      return { ...person, company_assignments: assignments };
    } finally {
      setLoadingPersonId(null);
    }
  }, []);

  const togglePersonnelActive = useCallback(
    async (person: TenantUser, nextActive: boolean) => {
      if (readOnly) return;
      try {
        setLoadingPersonId(person.id);
        await updateTenantUser(person.id, { is_active: nextActive });
        setNotice({ type: "success", text: `${normalizeTrText(person.full_name)} kaydı ${nextActive ? "aktif" : "pasif"} yapıldı.` });
        await loadData();
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Aktiflik güncellenemedi." });
      } finally {
        setLoadingPersonId(null);
      }
    },
    [loadData, normalizeTrText, readOnly],
  );

  const removePersonnel = useCallback(
    async (person: TenantUser) => {
      if (readOnly) return;
      if (person.is_active) {
        setNotice({ type: "error", text: "Aktif personel silinemez. Once tik kutusundan pasife alin." });
        return;
      }
      if (!window.confirm(`${normalizeTrText(person.full_name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) {
        return;
      }

      try {
        setLoadingPersonId(person.id);
        await deleteTenantUser(person.id);
        setNotice({ type: "success", text: `${normalizeTrText(person.full_name)} kaydı silindi.` });
        await loadData();
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Silme işlemi başarısız." });
      } finally {
        setLoadingPersonId(null);
      }
    },
    [loadData, normalizeTrText, readOnly],
  );

  const toggleSupplierUserActive = useCallback(
    async (supplierId: number, userItem: AdminSupplierUserListItem, nextActive: boolean) => {
      if (readOnly) return;
      try {
        setLoadingPersonId(userItem.id);
        await updateAdminSupplierUser(supplierId, userItem.id, {
          name: userItem.name,
          email: userItem.email,
          phone: userItem.phone || undefined,
          is_active: nextActive,
        });
        setNotice({ type: "success", text: `${normalizeTrText(userItem.name)} kaydı ${nextActive ? "aktif" : "pasif"} yapıldı.` });
        setSupplierReloadNonce((prev) => prev + 1);
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı aktifliği güncellenemedi." });
      } finally {
        setLoadingPersonId(null);
      }
    },
    [normalizeTrText, readOnly],
  );

  const editSupplierUser = useCallback(
    async (supplierId: number, userItem: AdminSupplierUserListItem) => {
      if (readOnly) return;
      const nextName = window.prompt("Kullanıcı adını güncelleyin", userItem.name);
      if (nextName == null) return;
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        setNotice({ type: "error", text: "Kullanıcı adı boş olamaz." });
        return;
      }

      try {
        setLoadingPersonId(userItem.id);
        await updateAdminSupplierUser(supplierId, userItem.id, {
          name: trimmedName,
          email: userItem.email,
          phone: userItem.phone || undefined,
        });
        setNotice({ type: "success", text: `${userItem.name} kaydı güncellendi.` });
        setSupplierReloadNonce((prev) => prev + 1);
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı güncellenemedi." });
      } finally {
        setLoadingPersonId(null);
      }
    },
    [readOnly],
  );

  const removeSupplierUser = useCallback(
    async (supplierId: number, userItem: AdminSupplierUserListItem) => {
      if (readOnly) return;
      if (userItem.is_active !== false) {
        setNotice({ type: "error", text: "Aktif tedarikçi kullanıcısı silinemez. Önce pasife alın." });
        return;
      }
      if (!window.confirm(`${normalizeTrText(userItem.name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) {
        return;
      }

      try {
        setLoadingPersonId(userItem.id);
        await deleteAdminSupplierUser(supplierId, userItem.id);
        setNotice({ type: "success", text: `${userItem.name} kaydı silindi.` });
        setSupplierReloadNonce((prev) => prev + 1);
      } catch (error) {
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı silinemedi." });
      } finally {
        setLoadingPersonId(null);
      }
    },
    [normalizeTrText, readOnly],
  );

  const renderStatusToggle = useCallback(
    (params: { active: boolean; label: string; disabled?: boolean; onClick: () => void }) => {
      const { active, label, disabled = false, onClick } = params;
      return (
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={`personnel-tab__status-toggle ${active ? "personnel-tab__status-toggle--active" : "personnel-tab__status-toggle--inactive"}`}
        >
          <span className={`personnel-tab__status-box ${active ? "personnel-tab__status-box--active" : "personnel-tab__status-box--inactive"}`}>
            {active ? "✓" : ""}
          </span>
          {active ? "Aktif" : "Pasif"}
        </button>
      );
    },
    [],
  );

  const renderPersonActionButton = useCallback(
    (
      label: string,
      variant: "indigo" | "blue" | "red" | "gray",
      onClick: () => void,
      disabled?: boolean,
    ) => (
      <button type="button" onClick={onClick} disabled={disabled} className={`personnel-tab__person-button personnel-tab__person-button--${variant}`}>
        {label}
      </button>
    ),
    [],
  );

  const renderGroupHeader = useCallback(
    (title: string, count: number, theme: "blue" | "teal" | "amber") => (
      <>
        <span className={`personnel-tab__group-title personnel-tab__group-title--${theme}`}>{title}</span>
        <span className={`personnel-tab__group-count personnel-tab__group-count--${theme}`}>{count} personel</span>
      </>
    ),
    [],
  );

  const renderTenantPersonCard = useCallback(
    (tenantPerson: TenantUser | DecoratedPersonnel) => {
      const fullName = normalizeTrText(tenantPerson.full_name);
      const roleLabel = normalizeTrText(getRoleLabel(tenantPerson.role) || roles.find((role) => role.name === tenantPerson.role)?.name || tenantPerson.role || "-");
      const systemRoleLabel = getSystemRoleLabelForPerson(tenantPerson);
      const isActive = tenantPerson.is_active !== false;
      const isDecorated = "primaryCompanyName" in tenantPerson;
      const secondaryCompanyNames = isDecorated ? tenantPerson.secondaryCompanyNames : [];

      return (
        <div className="personnel-tab__person-card">
          <div className="personnel-tab__person-card-content">
            <div className="personnel-tab__person-name">{fullName}</div>
            <div className="personnel-tab__person-email">{tenantPerson.email}</div>
            <div className="personnel-tab__person-role">
              {roleLabel} · {systemRoleLabel}
            </div>
            {isDecorated && secondaryCompanyNames.length > 0 ? (
              <div className="personnel-tab__person-secondary">Ayrıca yetkili olduğu firmalar: {secondaryCompanyNames.join(", ")}</div>
            ) : null}
            {isDecorated && tenantPerson.primaryCompanyName && tenantPerson.primaryCompanyName !== "Firma Ataması Yok" ? (
              <div className="personnel-tab__person-secondary">{tenantPerson.primaryCompanyName}</div>
            ) : null}
          </div>

          <div className="personnel-tab__person-actions">
            {renderStatusToggle({
              active: isActive,
              label: `${fullName} durum kutusu`,
              disabled: readOnly || loadingPersonId === tenantPerson.id,
              onClick: () => {
                void togglePersonnelActive(tenantPerson, !isActive);
              },
            })}

            {renderPersonActionButton(
              loadingPersonId === tenantPerson.id ? "Yükleniyor..." : "Detay",
              "indigo",
              () => {
                void hydratePersonnel(tenantPerson).then((hydrated) => setDetailPersonnel(hydrated));
              },
              loadingPersonId === tenantPerson.id,
            )}

            {!readOnly ? (
              <>
                {renderPersonActionButton(
                  "Düzenle",
                  "blue",
                  () => {
                    void hydratePersonnel(tenantPerson).then((hydrated) => setEditPersonnel(hydrated));
                  },
                  loadingPersonId === tenantPerson.id,
                )}
                {renderPersonActionButton(
                  "Sil",
                  isActive ? "gray" : "red",
                  () => void removePersonnel(tenantPerson),
                  isActive || loadingPersonId === tenantPerson.id,
                )}
              </>
            ) : null}
          </div>
        </div>
      );
    },
    [
      getSystemRoleLabelForPerson,
      loadingPersonId,
      normalizeTrText,
      readOnly,
      removePersonnel,
      renderPersonActionButton,
      renderStatusToggle,
      roles,
      togglePersonnelActive,
      hydratePersonnel,
    ],
  );

  const renderSupplierPersonCard = useCallback(
    (supplierPerson: AdminSupplierUserListItem, supplierId: number) => {
      const fullName = normalizeTrText(supplierPerson.name);
      const isActive = supplierPerson.is_active !== false;

      return (
        <div className="personnel-tab__person-card personnel-tab__person-card--supplier">
          <div className="personnel-tab__person-card-content">
            <div className="personnel-tab__person-name">{fullName}</div>
            <div className="personnel-tab__person-email">{supplierPerson.email}</div>
            <div className="personnel-tab__person-role">Tedarikçi Kullanıcısı · Tedarikçi Üyesi</div>
            <div className="personnel-tab__person-secondary">{supplierPerson.phone || "Telefon bilgisi yok"}</div>
          </div>

          <div className="personnel-tab__person-actions">
            {renderStatusToggle({
              active: isActive,
              label: `${fullName} durum kutusu`,
              disabled: readOnly || loadingPersonId === supplierPerson.id,
              onClick: () => {
                void toggleSupplierUserActive(supplierId, supplierPerson, !isActive);
              },
            })}

            {renderPersonActionButton(
              loadingPersonId === supplierPerson.id ? "Yükleniyor..." : "Detay",
              "indigo",
              () => {
                setNotice({ type: "success", text: `${normalizeTrText(supplierPerson.name)} · ${supplierPerson.email}${supplierPerson.phone ? ` · ${supplierPerson.phone}` : ""}` });
              },
              loadingPersonId === supplierPerson.id,
            )}

            {!readOnly ? (
              <>
                {renderPersonActionButton(
                  "Düzenle",
                  "blue",
                  () => void editSupplierUser(supplierId, supplierPerson),
                  loadingPersonId === supplierPerson.id,
                )}
                {renderPersonActionButton(
                  "Sil",
                  isActive ? "gray" : "red",
                  () => void removeSupplierUser(supplierId, supplierPerson),
                  isActive || loadingPersonId === supplierPerson.id,
                )}
              </>
            ) : null}
          </div>
        </div>
      );
    },
    [
      editSupplierUser,
      loadingPersonId,
      normalizeTrText,
      readOnly,
      removeSupplierUser,
      renderPersonActionButton,
      renderStatusToggle,
      toggleSupplierUserActive,
    ],
  );

  return (
    <div className="personnel-tab">
      {notice ? <div className={`personnel-tab__notice personnel-tab__notice--${notice.type}`}>{notice.text}</div> : null}

      {readOnly ? (
        <div className="personnel-tab__readonly">
          Platform personeli bu alanda kullanıcı listesini inceleyebilir; oluşturma, düzenleme, aktiflik değiştirme ve silme aksiyonları sadece tenant yönetim yetkisi olan hesaplarda açılır.
        </div>
      ) : null}

      <section className="personnel-tab__hero">
        <div className="personnel-tab__hero-copy">
          <div className="personnel-tab__eyebrow">{isChannelUser ? "Kanal Ekibi" : "Kullanıcı Yönetimi"}</div>
          <div className="personnel-tab__hero-title">{isChannelUser ? "Kendi ekip ve atama görünümü" : "Ekip, atama ve iletişim bilgileri"}</div>
          <div className="personnel-tab__hero-description">
            {isChannelUser
              ? "Bu sekmede yalnızca kendi kanal ekibinizi görürsünüz. Diğer tenant veya kapsam kullanıcıları listelenmez."
              : "Tümü sekmesi artık aktif ve pasif tüm kayıtları gösterir. Sekmeleri durum bazlı filtrelemek için kullanabilirsiniz."}
          </div>
        </div>

        <button type="button" onClick={() => setShowNewPersonnelModal(true)} disabled={readOnly} className="personnel-tab__cta-button">
          + Yeni Kullanıcı
        </button>
      </section>

      <div className="personnel-tab__stats-grid">
        {[
          { key: "all", label: "Tümü", value: stats.total, colorClass: "personnel-tab__stat-value--blue" },
          { key: "active", label: "Aktif", value: stats.active, colorClass: "personnel-tab__stat-value--green" },
          { key: "passive", label: "Pasif", value: stats.passive, colorClass: "personnel-tab__stat-value--red" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`personnel-tab__stat-card ${tab === item.key ? "personnel-tab__stat-card--active" : ""}`}
          >
            <div className="personnel-tab__stat-label">{item.label}</div>
            <div className={`personnel-tab__stat-value ${item.colorClass}`}>{item.value}</div>
          </button>
        ))}
      </div>

      <div className="personnel-tab__segment-bar">
        {(isChannelUser
          ? [{ key: "channel", label: `Kanal Ekibi (${channelPersonnel.length})`, color: "#0f766e" }]
          : [
              { key: "portal", label: `Portal Personelleri (${portalPersonnel.length})`, color: "#1d4ed8" },
              { key: "partner", label: `Stratejik Partner Personeli (${strategicPartnerPersonnel.length})`, color: "#0f766e" },
              { key: "channel", label: `İş Ortağı Personeli (${channelPersonnel.length})`, color: "#0e7490" },
              { key: "supplier", label: `Tedarikçi Personeli (${supplierGroups.reduce((sum, group) => sum + group.users.length, 0)})`, color: "#b45309" },
            ]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => changeSegment(item.key as PersonnelSegment)}
            className={`personnel-tab__segment-button ${segment === item.key ? "personnel-tab__segment-button--active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!isChannelUser ? (
        <section className="personnel-tab__matrix-panel">
          <div className="personnel-tab__matrix-header">
            <div className="personnel-tab__matrix-header-row">
              <div>
                <div className="personnel-tab__matrix-title">Rol Yetki Matrisi</div>
                <div className="personnel-tab__matrix-description">Güncel yetki modeline göre rol kombinasyonlarında açılan kritik yüzeylerin özet görünümü.</div>
              </div>

              <div className="personnel-tab__matrix-actions">
                <button type="button" onClick={() => setIsMatrixOpen((prev) => !prev)} className="personnel-tab__matrix-button">
                  {isMatrixOpen ? "Matrisi Gizle" : "Matrisi Aç"}
                </button>

                <select
                  value={matrixFilter}
                  onChange={(event) => setMatrixFilter(event.target.value as MatrixFilter)}
                  aria-label="Rol yetki matrisi filtre seçimi"
                  title="Rol yetki matrisi filtre seçimi"
                  className="personnel-tab__matrix-select"
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
                  className="personnel-tab__matrix-button personnel-tab__matrix-button--primary"
                >
                  CSV Dışa Aktar
                </button>
              </div>
            </div>
          </div>

          {isMatrixOpen ? (
            <div className="personnel-tab__matrix-scroll">
              <table className="personnel-tab__matrix-table">
                <thead>
                  <tr>
                    <th>Operasyonel Rol</th>
                    <th>Sistem Rolü</th>
                    <th data-align="center">Admin</th>
                    <th data-align="center">Kullanıcı</th>
                    <th data-align="center">Teklif</th>
                    <th data-align="center">Onay</th>
                    <th data-align="center">SP Yönetim Oku</th>
                    <th data-align="center">SP Yönetim Yaz</th>
                    <th data-align="center">Destek Akisi</th>
                    <th data-align="center">Tenant Kimlik</th>
                    <th data-align="center">Ortak E-Posta</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const groupLabels: Record<string, string> = {
                      platform: "🛡️ Platform Grubu",
                      portal: "🏢 Portal / Satın Alma Grubu",
                      channel: "🤝 Kanal / İş Ortağı Grubu",
                      supplier: "📦 Tedarikçi Grubu",
                    };

                    let lastGroup = "";
                    return filteredPermissionMatrix.flatMap((row) => {
                      const headerRow =
                        row.group !== lastGroup ? (
                          <tr key={`group-${row.group}`} className="personnel-tab__matrix-group-row">
                            <td colSpan={11} className="personnel-tab__matrix-group-cell">
                              {groupLabels[row.group] ?? row.group}
                            </td>
                          </tr>
                        ) : null;

                      lastGroup = row.group;
                      return [
                        headerRow,
                        <tr key={`${row.businessRole}-${row.systemRole}`} className="personnel-tab__matrix-row">
                          <td className="personnel-tab__matrix-cell personnel-tab__matrix-cell--title">{row.businessRoleLabel}</td>
                          <td className="personnel-tab__matrix-cell personnel-tab__matrix-cell--value">{row.systemRoleLabel}</td>
                          <td className={`personnel-tab__matrix-cell ${row.adminSurface ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.adminSurface)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.manageUsers ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.manageUsers)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.quoteWorkspace ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.quoteWorkspace)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.reviewApprovals ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.reviewApprovals)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.tenantGovernanceRead ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.tenantGovernanceRead)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.tenantGovernanceWrite ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.tenantGovernanceWrite)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.supportWorkflow ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.supportWorkflow)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.tenantIdentitySettings ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.tenantIdentitySettings)}
                          </td>
                          <td className={`personnel-tab__matrix-cell ${row.sharedEmailProfiles ? "personnel-tab__matrix-cell--yes" : "personnel-tab__matrix-cell--no"}`} data-align="center">
                            {toStatus(row.sharedEmailProfiles)}
                          </td>
                        </tr>,
                      ];
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="personnel-tab__details-panel">
        <div className="personnel-tab__tabs">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`personnel-tab__tab-button personnel-tab__tab-button--all ${tab === "all" ? "personnel-tab__tab-button--active" : ""}`}
          >
            Tümü
          </button>
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`personnel-tab__tab-button personnel-tab__tab-button--active ${tab === "active" ? "personnel-tab__tab-button--active-active" : ""}`}
          >
            Aktif
          </button>
          <button
            type="button"
            onClick={() => setTab("passive")}
            className={`personnel-tab__tab-button personnel-tab__tab-button--passive ${tab === "passive" ? "personnel-tab__tab-button--active" : ""}`}
          >
            Pasif
          </button>
        </div>

        <PersonnelCreateModal
          isOpen={showNewPersonnelModal}
          onClose={() => setShowNewPersonnelModal(false)}
          contextScope={
            isChannelUser
              ? "channel"
              : segment === "partner"
                ? "partner"
                : segment === "channel"
                  ? "channel"
                  : "portal"
          }
          tenantOptions={segment === "partner" ? tenants : []}
          requireTenantSelection={segment === "partner"}
          onSuccess={(result) => {
            setShowNewPersonnelModal(false);
            setNotice(
              result?.invitationEmailSent
                ? { type: "success", text: `${result.email || "Kullanıcı"} oluşturuldu ve davet e-postası gönderildi.` }
                : { type: "error", text: `${result?.email || "Kullanıcı"} oluşturuldu ancak davet e-postası gönderilemedi. SMTP ayarlarını kontrol edin.` },
            );
            loadData();
          }}
        />

        <PersonnelCreateModal
          isOpen={!!editPersonnel}
          onClose={() => setEditPersonnel(null)}
          contextScope={(() => {
            if (isChannelUser) return "channel";
            const r = String(editPersonnel?.role || "").toLowerCase();
            if (r.startsWith("kanal_") || r === "ozel_kanal_rolu") return "channel";
            if (editPersonnel?.tenant_id != null) return "partner";
            return "portal";
          })()}
          onSuccess={() => {
            setEditPersonnel(null);
            setNotice({ type: "success", text: "Kullanıcı bilgileri güncellendi." });
            loadData();
          }}
          editData={editPersonnel}
        />

        {detailPersonnel ? (
          <PersonnelDetailModal
            personnel={detailPersonnel}
            onClose={() => setDetailPersonnel(null)}
            onResetPassword={
              readOnly
                ? undefined
                : async (id: number) => {
                    try {
                      const { adminResetPassword } = await import("../../services/admin.service");
                      const res = await adminResetPassword(id);
                      alert("Şifre sıfırlandı! Magic link veya geçici şifre: " + (res.temp_password || "Gönderildi"));
                    } catch (err) {
                      alert("Şifre sıfırlanamadı: " + (err instanceof Error ? err.message : err));
                    }
                  }
            }
          />
        ) : null}

        {!isChannelUser && segment === "portal" ? (
          <div className="personnel-tab__personnel-list">
            {portalCompanyGroups.length === 0 ? (
              <div className="personnel-tab__empty-state">Portal personeli bulunamadı.</div>
            ) : (
              portalCompanyGroups.map((group) => (
                <div key={group.key} className="personnel-tab__group-card">
                  <button type="button" className="personnel-tab__group-toggle personnel-tab__group-toggle--blue">
                    {renderGroupHeader(group.name, group.users.length, "blue")}
                  </button>
                  <div className="personnel-tab__group-body">{group.users.map((person) => renderTenantPersonCard(person))}</div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {(isChannelUser || segment === "channel") ? (
          <div className="personnel-tab__personnel-list">
            {strategicPartnerGroups.length === 0 ? (
              <div className="personnel-tab__empty-state">İş ortağı personeli bulunamadı.</div>
            ) : (
              strategicPartnerGroups.map((group) => (
                <div key={group.key} className="personnel-tab__group-card personnel-tab__group-card--green">
                  <button
                    type="button"
                    onClick={() => setExpandedPartnerGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                    className="personnel-tab__group-toggle personnel-tab__group-toggle--teal"
                  >
                    {renderGroupHeader(group.name, group.users.length, "teal")}
                  </button>
                  {expandedPartnerGroups[group.key] ? (
                    <div className="personnel-tab__group-body">{group.users.map((person) => renderTenantPersonCard(person))}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {!isChannelUser && segment === "partner" ? (
          <div className="personnel-tab__personnel-list">
            {strategicPartnerTenantGroups.length === 0 ? (
              <div className="personnel-tab__empty-state">Stratejik partner personeli bulunamadı.</div>
            ) : (
              strategicPartnerTenantGroups.map((tenantGroup) => (
                <div key={tenantGroup.key} className="personnel-tab__group-card personnel-tab__group-card--green">
                  <button
                    type="button"
                    onClick={() => setExpandedPartnerGroups((prev) => ({ ...prev, [tenantGroup.key]: !prev[tenantGroup.key] }))}
                    className="personnel-tab__group-toggle personnel-tab__group-toggle--teal"
                  >
                    {renderGroupHeader(
                      tenantGroup.name,
                      tenantGroup.companies.reduce((sum, company) => sum + company.users.length, 0),
                      "teal",
                    )}
                  </button>
                  {expandedPartnerGroups[tenantGroup.key] ? (
                    <div className="personnel-tab__group-body personnel-tab__group-body--compact">
                      {tenantGroup.companies.map((companyGroup) => (
                        <div key={companyGroup.key} className="personnel-tab__group-card">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPartnerCompanyGroups((prev) => ({
                                ...prev,
                                [companyGroup.key]: !prev[companyGroup.key],
                              }))
                            }
                            className="personnel-tab__group-toggle personnel-tab__group-toggle--blue"
                          >
                            {renderGroupHeader(companyGroup.name, companyGroup.users.length, "blue")}
                          </button>
                          {expandedPartnerCompanyGroups[companyGroup.key] ? (
                            <div className="personnel-tab__group-body">{companyGroup.users.map((person) => renderTenantPersonCard(person))}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {!isChannelUser && segment === "supplier" ? (
          <div className="personnel-tab__personnel-list">
            {supplierLoading ? <div className="personnel-tab__supplier-loading">Tedarikçi personelleri yükleniyor...</div> : null}
            {supplierError ? <div className="personnel-tab__supplier-error">{supplierError}</div> : null}
            {!supplierLoading && !supplierError && supplierGroups.length === 0 ? (
              <div className="personnel-tab__empty-state">Tedarikçi personeli bulunamadı.</div>
            ) : null}
            {!supplierLoading && !supplierError
              ? supplierGroups.map((group) => (
                  <div key={group.supplier.id} className="personnel-tab__group-card personnel-tab__group-card--amber">
                    <button
                      type="button"
                      onClick={() => setExpandedSupplierGroups((prev) => ({ ...prev, [group.supplier.id]: !prev[group.supplier.id] }))}
                      className="personnel-tab__group-toggle personnel-tab__group-toggle--amber"
                    >
                      {renderGroupHeader(normalizeTrText(group.supplier.company_name), group.users.length, "amber")}
                    </button>
                    {expandedSupplierGroups[group.supplier.id] ? (
                      <div className="personnel-tab__group-body">
                        {group.users.length === 0 ? (
                          <div className="personnel-tab__supplier-loading">Kayıtlı tedarikçi personeli yok.</div>
                        ) : (
                          group.users.map((userItem) => renderSupplierPersonCard(userItem, group.supplier.id))
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
