import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import PersonnelDetailModal from "../../components/PersonnelDetailModal";
import { PersonnelCreateModal } from "../../components/PersonnelCreateModal";
import { PageHeader, Section, StatCard } from "./AdminTabContent";
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
import { getPersonnelRolePermissionMatrix, getRoleLabel, isSuperAdminUser } from "../../auth/permissions";
import { buildTenantScopeMap, resolvePersonnelScope as resolvePersonnelScopeByMap } from "../../utils/scopeResolver";
import { http } from "../../lib/http";
import { useContext } from "react";
import { AuthContext } from "../../context/auth-context";
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

type FlatItem =
  | { kind: "tenant"; person: DecoratedPersonnel; group: string }
  | { kind: "supplier"; person: AdminSupplierUserListItem; supplierId: number; group: string };

const SEG_COLORS: Record<PersonnelSegment, string> = {
  portal:   "#1d4ed8",
  partner:  "#047857",
  channel:  "#0891b2",
  supplier: "#b45309",
};

const SEG_LABELS: Record<PersonnelSegment, string> = {
  portal:   "Portal",
  partner:  "Stratejik Partner",
  channel:  "İş Ortağı",
  supplier: "Tedarikçi",
};

function personInit(fullName: string): string {
  return fullName.replace(/\(.*?\)/g, "").trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function fmtApprovalLimit(n: number): string {
  if (!n) return "Yetkisiz";
  return "₺" + Number(n).toLocaleString("tr-TR");
}

export function PersonnelTab(props: PersonnelTabProps) {
  const { personnel, roles, companies = [], loadData, readOnly = false, isChannelUser = false, tenants = [] } = props;
  const authUser = useContext(AuthContext)?.user ?? null;
  const canOpenPanel = isSuperAdminUser(authUser);
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
    if (stored === "portal" || stored === "partner" || stored === "channel" || stored === "supplier") return stored;
    return fallback;
  });
  const [supplierGroups, setSupplierGroups] = useState<SupplierPersonnelGroup[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter>("all");
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [loadingPersonId, setLoadingPersonId] = useState<number | null>(null);
  const [supplierReloadNonce, setSupplierReloadNonce] = useState(0);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [openingPanelId, setOpeningPanelId] = useState<number | null>(null);
  const [selPersonId, setSelPersonId] = useState<number | null>(null);
  const [selSupUserKey, setSelSupUserKey] = useState<{ supplierId: number; userId: number } | null>(null);
  const [q, setQ] = useState("");

  const openPersonnelPanel = useCallback(async (person: TenantUser) => {
    setOpeningPanelId(person.id);
    try {
      const res = await http.post<{ access_token: string; user: Record<string, unknown> }>(`/auth/impersonate/${person.id}`);
      const { access_token, user } = res.data;
      const userB64 = btoa(encodeURIComponent(JSON.stringify(user)));
      const displayName = encodeURIComponent(String(user.full_name || user.email || person.email));
      window.open(`/view-as#t=${access_token}&u=${userB64}&n=${displayName}`, "_blank", "noopener,noreferrer");
    } catch {
      setNotice({ type: "error", text: "Panel açılamadı. Lütfen tekrar deneyin." });
    } finally {
      setOpeningPanelId(null);
    }
  }, []);

  const openSupplierPanel = useCallback(async (supUser: AdminSupplierUserListItem) => {
    setOpeningPanelId(supUser.id);
    try {
      const res = await http.post<{ access_token: string; user: Record<string, unknown> }>(`/auth/impersonate-supplier/${supUser.id}`);
      const { access_token } = res.data;
      window.open(`/view-as-supplier#t=${access_token}`, "_blank", "noopener,noreferrer");
    } catch {
      setNotice({ type: "error", text: "Panel açılamadı. Lütfen tekrar deneyin." });
    } finally {
      setOpeningPanelId(null);
    }
  }, []);

  const normalizeTrText = useCallback((value?: string | null): string => {
    if (!value) return "";
    const input = String(value);
    if (!/[ÃÅÄï¿½]/.test(input) && !/\?[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(input)) return input;
    let current = input;
    for (let i = 0; i < 2; i += 1) {
      try {
        const bytes = Uint8Array.from(current, (char) => char.charCodeAt(0) & 0xff);
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        if (!decoded || decoded === current) break;
        current = decoded;
      } catch { break; }
    }
    const fallbackMap: Array<[RegExp, string]> = [
      [/Ã§/g, "ç"], [/Ã‡/g, "Ç"], [/Ä±/g, "ı"], [/Ä°/g, "İ"],
      [/Ã¶/g, "ö"], [/Ã–/g, "Ö"], [/Ã¼/g, "ü"], [/Ãœ/g, "Ü"],
      [/ÅŸ/g, "ş"], [/Åž/g, "Ş"], [/ÄŸ/g, "ğ"], [/Äž/g, "Ğ"],
      [/ï¿½/g, ""], [/([a-zA-ZçğıöşüÇĞİÖŞÜ])\?([a-zA-ZçğıöşüÇĞİÖŞÜ])/g, "$1ı$2"],
    ];
    let fixed = current;
    fallbackMap.forEach(([p, r]) => { fixed = fixed.replace(p, r); });
    return fixed;
  }, []);

  const changeSegment = useCallback((next: PersonnelSegment) => {
    setSegment(next);
    setSelPersonId(null);
    setSelSupUserKey(null);
    setQ("");
    if (typeof window !== "undefined") window.sessionStorage.setItem(segmentStorageKey, next);
  }, [segmentStorageKey]);

  const stats = useMemo(() => ({
    total:   personnel.length,
    active:  personnel.filter((p) => p.is_active).length,
    passive: personnel.filter((p) => !p.is_active).length,
    pending: personnel.filter((p) => p.invitation_accepted === false).length,
  }), [personnel]);

  const filteredPersonnel = useMemo(() => {
    if (tab === "active")  return personnel.filter((p) => p.is_active);
    if (tab === "passive") return personnel.filter((p) => !p.is_active);
    return personnel;
  }, [personnel, tab]);

  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c] as const)), [companies]);

  const tenantScopeMap = useMemo(
    () => buildTenantScopeMap(tenants, personnel, []),
    [tenants, personnel],
  );

  const resolvePersonnelScope = useCallback(
    (person: TenantUser): PersonnelSegment =>
      resolvePersonnelScopeByMap(person, tenantScopeMap, companiesById) as PersonnelSegment,
    [companiesById, tenantScopeMap],
  );

  const getMembershipLabel = useCallback((person: TenantUser): string => {
    const scope = resolvePersonnelScope(person);
    if (scope === "partner")  return "Stratejik Partner Üyesi";
    if (scope === "channel")  return "İş Ortağı Üyemiz";
    if (scope === "supplier") return "Tedarikçi Üyesi";
    return "Platform Üyesi";
  }, [resolvePersonnelScope]);

  const getSystemRoleLabelForPerson = useCallback((person: TenantUser): string => {
    const sr = String(person.system_role || "").toLowerCase();
    if (sr === "tenant_member" || sr === "tenant_owner")
      return normalizeTrText(getMembershipLabel(person));
    return normalizeTrText(person.system_role ? getRoleLabel(person.system_role) : getMembershipLabel(person));
  }, [getMembershipLabel, normalizeTrText]);

  const decorateWithCompanyContext = useCallback((person: TenantUser): DecoratedPersonnel => {
    const names = (person.company_assignments || [])
      .sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER))
      .map((a) => String(a.company?.name || "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(names));
    return { ...person, primaryCompanyName: normalizeTrText(unique[0] || "Firma Ataması Yok"), secondaryCompanyNames: unique.slice(1) };
  }, [normalizeTrText]);

  const portalPrimaryCompanyName = useMemo(() => {
    const pc = companies
      .filter((c) => c.tenant_id == null || c.is_platform_primary)
      .sort((l, r) => {
        const ls = l.is_platform_primary || l.is_primary ? 0 : 1;
        const rs = r.is_platform_primary || r.is_primary ? 0 : 1;
        if (ls !== rs) return ls - rs;
        return normalizeTrText(l.name).localeCompare(normalizeTrText(r.name), "tr");
      });
    return normalizeTrText(pc[0]?.name || "Portal Ana Firma Ataması Yok");
  }, [companies, normalizeTrText]);

  const portalPersonnel = useMemo(
    () => filteredPersonnel
      .filter((p) => resolvePersonnelScope(p) === "portal")
      .sort((l, r) => {
        const ls = String(l.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
        const rs = String(r.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL ? 0 : 1;
        if (ls !== rs) return ls - rs;
        return normalizeTrText(l.full_name).localeCompare(normalizeTrText(r.full_name), "tr");
      }),
    [PLATFORM_SUPER_ADMIN_EMAIL, filteredPersonnel, normalizeTrText, resolvePersonnelScope],
  );

  const strategicPartnerPersonnel = useMemo(
    () => filteredPersonnel.filter((p) => resolvePersonnelScope(p) === "partner"),
    [filteredPersonnel, resolvePersonnelScope],
  );

  const channelPersonnel = useMemo(
    () => filteredPersonnel.filter((p) => resolvePersonnelScope(p) === "channel"),
    [filteredPersonnel, resolvePersonnelScope],
  );

  const portalCompanyGroups = useMemo<CompanyPersonnelGroup[]>(() => {
    const groups = new Map<string, CompanyPersonnelGroup>();
    portalPersonnel.forEach((person) => {
      const dec = decorateWithCompanyContext(person);
      const isPlatform = dec.tenant_id == null;
      const groupName = isPlatform ? portalPrimaryCompanyName : (dec.primaryCompanyName === "Firma Ataması Yok" ? portalPrimaryCompanyName : dec.primaryCompanyName);
      const key = `portal-${groupName}`;
      if (!groups.has(key)) groups.set(key, { key, name: groupName, users: [] });
      groups.get(key)?.users.push({ ...dec, primaryCompanyName: groupName });
    });
    return Array.from(groups.values())
      .map((g) => ({ ...g, users: [...g.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")) }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr"));
  }, [decorateWithCompanyContext, normalizeTrText, portalPersonnel, portalPrimaryCompanyName]);

  const strategicPartnerTenantGroups = useMemo<PartnerTenantGroup[]>(() => {
    const tenantMap = new Map<string, { name: string; companyMap: Map<string, CompanyPersonnelGroup> }>();
    strategicPartnerPersonnel.forEach((person) => {
      const dec = decorateWithCompanyContext(person);
      const tenantId = dec.tenant_id ?? null;
      const tenantKey = tenantId != null ? `tenant-${tenantId}` : "tenant-atamasiz";
      const matchedTenant = tenantId != null ? tenants.find((t) => t.id === tenantId) : null;
      const primaryCompany = tenantId != null ? companies.filter((c) => c.tenant_id === tenantId).sort((l, r) => (l.is_primary ? 0 : 1) - (r.is_primary ? 0 : 1))[0] : null;
      const resolvedLabel = matchedTenant ? primaryCompany?.name || matchedTenant.brand_name || matchedTenant.legal_name : tenantId != null ? `Stratejik Partner #${tenantId}` : "Stratejik Partner Ataması Yok";
      const tenantName = normalizeTrText(resolvedLabel);
      if (!tenantMap.has(tenantKey)) tenantMap.set(tenantKey, { name: tenantName, companyMap: new Map() });
      const tenantEntry = tenantMap.get(tenantKey);
      if (!tenantEntry) return;
      const companyKey = `${tenantKey}::${dec.primaryCompanyName}`;
      if (!tenantEntry.companyMap.has(companyKey)) tenantEntry.companyMap.set(companyKey, { key: companyKey, name: dec.primaryCompanyName, users: [] });
      tenantEntry.companyMap.get(companyKey)?.users.push({ ...dec });
    });
    return Array.from(tenantMap.entries())
      .map(([key, t]) => ({
        key,
        name: t.name,
        companies: Array.from(t.companyMap.values())
          .map((cg) => ({ ...cg, users: [...cg.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")) }))
          .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr")),
      }))
      .sort((a, b) => normalizeTrText(a.name).localeCompare(normalizeTrText(b.name), "tr"));
  }, [companies, decorateWithCompanyContext, normalizeTrText, strategicPartnerPersonnel, tenants]);

  const strategicPartnerGroups = useMemo<StrategicPartnerGroup[]>(() => {
    const groups = new Map<string, StrategicPartnerGroup>();
    channelPersonnel.forEach((person) => {
      const dec = decorateWithCompanyContext(person);
      const tenantId = dec.tenant_id ?? null;
      const firstCompanyName = (dec.company_assignments || []).map((a) => a.company?.name).find(Boolean);
      const key = tenantId != null ? `tenant-${tenantId}` : `company-${firstCompanyName || "atamasiz"}`;
      if (!groups.has(key)) groups.set(key, { key, name: "", users: [] });
      groups.get(key)?.users.push({ ...dec });
    });
    return Array.from(groups.values())
      .map((group) => {
        const owner = group.users.find((u) => String(u.role || "").toLowerCase() === "channel_owner");
        const primaryCompanyName = group.users.map((u) => (u as DecoratedPersonnel).primaryCompanyName).find((n) => !!n && n !== "Firma Ataması Yok");
        const workspaceLabel = normalizeTrText(primaryCompanyName || owner?.full_name || "İş Ortağı Ataması Yok");
        const groupName = isChannelUser ? `Kanal Ekibi - ${workspaceLabel}` : `İş Ortağı - ${workspaceLabel}`;
        return { ...group, name: normalizeTrText(groupName), users: [...group.users].sort((a, b) => normalizeTrText(a.full_name).localeCompare(normalizeTrText(b.full_name), "tr")) };
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
    if (segment !== "supplier") return;
    let cancelled = false;
    setSupplierLoading(true);
    setSupplierError(null);
    (async () => {
      try {
        const suppliers = await getAdminSuppliers({ filter_active: tab !== "passive" });
        const groups = await Promise.all(suppliers.map(async (supplier) => {
          try {
            const users = await getAdminSupplierUsers(supplier.id);
            const filtered = users.filter((u) => {
              if (tab === "all") return true;
              if (tab === "active") return u.is_active !== false;
              return u.is_active === false;
            });
            return { supplier, users: filtered };
          } catch { return { supplier, users: [] }; }
        }));
        if (!cancelled) setSupplierGroups(groups.sort((l, r) => l.supplier.company_name.localeCompare(r.supplier.company_name, "tr")));
      } catch (error) {
        if (!cancelled) { setSupplierError(error instanceof Error ? error.message : "Tedarikçi listesi yüklenemedi."); setSupplierGroups([]); }
      } finally {
        if (!cancelled) setSupplierLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [segment, supplierReloadNonce, tab]);

  const toStatus = useCallback((value: boolean): string => (value ? "Açık" : "Kapalı"), []);

  const exportMatrixAsCsv = useCallback(() => {
    const headers = ["operasyonel_rol","sistem_rolu","admin_yuzeyi","kullanici_yonetimi","teklif_alani","onay_inceleme","stratejik_partner_okuma","stratejik_partner_yazma","destek_akisi","tenant_kimlik_ayarlari","ortak_eposta_profilleri"];
    const lines = filteredPermissionMatrix.map((row) =>
      [row.businessRoleLabel, row.systemRoleLabel, toStatus(row.adminSurface), toStatus(row.manageUsers), toStatus(row.quoteWorkspace), toStatus(row.reviewApprovals), toStatus(row.tenantGovernanceRead), toStatus(row.tenantGovernanceWrite), row.supportWorkflow, row.tenantIdentitySettings, row.sharedEmailProfiles]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rol_yetki_matrisi_${matrixFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
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
    } finally { setLoadingPersonId(null); }
  }, []);

  const togglePersonnelActive = useCallback(async (person: TenantUser, nextActive: boolean) => {
    if (readOnly) return;
    try {
      setLoadingPersonId(person.id);
      await updateTenantUser(person.id, { is_active: nextActive });
      setNotice({ type: "success", text: `${normalizeTrText(person.full_name)} kaydı ${nextActive ? "aktif" : "pasif"} yapıldı.` });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Aktiflik güncellenemedi." });
    } finally { setLoadingPersonId(null); }
  }, [loadData, normalizeTrText, readOnly]);

  const removePersonnel = useCallback(async (person: TenantUser) => {
    if (readOnly) return;
    if (person.is_active) { setNotice({ type: "error", text: "Aktif personel silinemez. Önce pasife alın." }); return; }
    if (!window.confirm(`${normalizeTrText(person.full_name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) return;
    try {
      setLoadingPersonId(person.id);
      await deleteTenantUser(person.id);
      setNotice({ type: "success", text: `${normalizeTrText(person.full_name)} kaydı silindi.` });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Silme işlemi başarısız." });
    } finally { setLoadingPersonId(null); }
  }, [loadData, normalizeTrText, readOnly]);

  const toggleSupplierUserActive = useCallback(async (supplierId: number, userItem: AdminSupplierUserListItem, nextActive: boolean) => {
    if (readOnly) return;
    try {
      setLoadingPersonId(userItem.id);
      await updateAdminSupplierUser(supplierId, userItem.id, { name: userItem.name, email: userItem.email, phone: userItem.phone || undefined, is_active: nextActive });
      setNotice({ type: "success", text: `${normalizeTrText(userItem.name)} kaydı ${nextActive ? "aktif" : "pasif"} yapıldı.` });
      setSupplierReloadNonce((n) => n + 1);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı aktifliği güncellenemedi." });
    } finally { setLoadingPersonId(null); }
  }, [normalizeTrText, readOnly]);

  const editSupplierUser = useCallback(async (supplierId: number, userItem: AdminSupplierUserListItem) => {
    if (readOnly) return;
    const nextName = window.prompt("Kullanıcı adını güncelleyin", userItem.name);
    if (nextName == null) return;
    const trimmed = nextName.trim();
    if (!trimmed) { setNotice({ type: "error", text: "Kullanıcı adı boş olamaz." }); return; }
    try {
      setLoadingPersonId(userItem.id);
      await updateAdminSupplierUser(supplierId, userItem.id, { name: trimmed, email: userItem.email, phone: userItem.phone || undefined });
      setNotice({ type: "success", text: `${userItem.name} kaydı güncellendi.` });
      setSupplierReloadNonce((n) => n + 1);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı güncellenemedi." });
    } finally { setLoadingPersonId(null); }
  }, [readOnly]);

  const removeSupplierUser = useCallback(async (supplierId: number, userItem: AdminSupplierUserListItem) => {
    if (readOnly) return;
    if (userItem.is_active !== false) { setNotice({ type: "error", text: "Aktif tedarikçi kullanıcısı silinemez. Önce pasife alın." }); return; }
    if (!window.confirm(`${normalizeTrText(userItem.name)} kaydını kalıcı olarak silmek istiyor musunuz?`)) return;
    try {
      setLoadingPersonId(userItem.id);
      await deleteAdminSupplierUser(supplierId, userItem.id);
      setNotice({ type: "success", text: `${userItem.name} kaydı silindi.` });
      setSupplierReloadNonce((n) => n + 1);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Tedarikçi kullanıcı silinemedi." });
    } finally { setLoadingPersonId(null); }
  }, [normalizeTrText, readOnly]);

  // ── Flat list computation ──────────────────────────────────────────────────
  const flatList = useMemo((): FlatItem[] => {
    if (segment === "supplier") {
      return supplierGroups.flatMap((g) =>
        g.users.map((u) => ({ kind: "supplier" as const, person: u, supplierId: g.supplier.id, group: normalizeTrText(g.supplier.company_name) })),
      );
    }
    if (segment === "partner") {
      return strategicPartnerTenantGroups.flatMap((tg) =>
        tg.companies.flatMap((cg) =>
          cg.users.map((u) => ({
            kind: "tenant" as const,
            person: u,
            group: cg.name !== "Firma Ataması Yok" ? `${tg.name} · ${cg.name}` : tg.name,
          })),
        ),
      );
    }
    if (segment === "channel" || isChannelUser) {
      return strategicPartnerGroups.flatMap((g) =>
        g.users.map((u) => ({ kind: "tenant" as const, person: u, group: g.name })),
      );
    }
    return portalCompanyGroups.flatMap((g) =>
      g.users.map((u) => ({ kind: "tenant" as const, person: u, group: g.name })),
    );
  }, [segment, isChannelUser, supplierGroups, strategicPartnerTenantGroups, strategicPartnerGroups, portalCompanyGroups, normalizeTrText]);

  const ql = q.trim().toLowerCase();
  const visibleList = useMemo((): FlatItem[] => {
    if (!ql) return flatList;
    return flatList.filter((item) => {
      const name = item.kind === "tenant" ? item.person.full_name : item.person.name;
      return (name + " " + (item.person.email ?? "")).toLowerCase().includes(ql);
    });
  }, [flatList, ql]);

  // Auto-select first visible item
  useEffect(() => {
    if (segment === "supplier") {
      if (selSupUserKey !== null) return;
      const first = visibleList[0];
      if (first?.kind === "supplier") setSelSupUserKey({ supplierId: first.supplierId, userId: first.person.id });
    } else {
      if (selPersonId !== null) return;
      const first = visibleList[0];
      if (first?.kind === "tenant") setSelPersonId(first.person.id);
    }
  }, [segment, visibleList, selPersonId, selSupUserKey]);

  const selTenantPerson = useMemo(
    () => segment !== "supplier"
      ? (flatList.find((item): item is Extract<FlatItem, { kind: "tenant" }> => item.kind === "tenant" && item.person.id === selPersonId)?.person ?? null)
      : null,
    [segment, flatList, selPersonId],
  );

  const selSupGroup = selSupUserKey ? supplierGroups.find((g) => g.supplier.id === selSupUserKey.supplierId) : null;
  const selSupUser = selSupGroup ? (selSupGroup.users.find((u) => u.id === selSupUserKey?.userId) ?? null) : null;

  // ── Detail pane renderers ──────────────────────────────────────────────────
  function tenantPersonDetail(person: DecoratedPersonnel) {
    const fullName = normalizeTrText(person.full_name);
    const roleLabel = normalizeTrText(getRoleLabel(person.role) || roles.find((r) => r.name === person.role)?.name || person.role || "-");
    const sysRoleLabel = getSystemRoleLabelForPerson(person);
    const isActive = person.is_active !== false;
    const pendingInvite = person.invitation_accepted === false;
    const color = (person.company_assignments ?? [])[0]?.company?.color ?? SEG_COLORS[segment];
    const companyName = person.primaryCompanyName !== "Firma Ataması Yok" ? person.primaryCompanyName : null;

    return (
      <>
        <div className="pe-detail__hd">
          <span className="pe-av pe-av--lg" style={{ "--pe-color": color } as CSSProperties}>{personInit(fullName)}</span>
          <div className="pe-detail__info">
            <h3 className="pe-detail__title">
              {fullName}
              {" "}
              <span className="pe-srole-badge">{sysRoleLabel}</span>
              <span className="pe-type-pill" style={{ "--pill-bg": SEG_COLORS[segment] + "1f", "--pill-fg": SEG_COLORS[segment] } as CSSProperties}>
                {SEG_LABELS[segment]}
              </span>
              {!isActive && <span className="pe-badge pe-badge--off">Pasif</span>}
              {pendingInvite && <span className="pe-badge pe-badge--inv">Davet bekliyor</span>}
            </h3>
            <div className="pe-detail__meta">
              <span>{roleLabel}</span>
              {companyName && <><span className="pe-sep">·</span><span>{companyName}</span></>}
            </div>
          </div>
          <div className="pe-detail__acts">
            <button
              type="button"
              disabled={readOnly || loadingPersonId === person.id}
              className={"pe-status-btn" + (isActive ? " pe-status-btn--active" : " pe-status-btn--passive")}
              onClick={() => { void togglePersonnelActive(person, !isActive); }}
            >
              {loadingPersonId === person.id ? "…" : isActive ? "✓ Aktif" : "✗ Pasif"}
            </button>
            {canOpenPanel && (
              <button
                type="button"
                className="pe-act-btn pe-act-btn--teal"
                disabled={openingPanelId === person.id}
                onClick={() => { void openPersonnelPanel(person); }}
              >
                {openingPanelId === person.id ? "Açılıyor…" : "Paneli Aç ↗"}
              </button>
            )}
          </div>
        </div>

        {pendingInvite && (
          <div className="pe-invite-note">
            📧 Davet henüz kabul edilmedi.
          </div>
        )}

        <div className="split-1-1">
          <Section title="İletişim" sub="kişisel & kurumsal">
            <div className="pe-facts">
              <div className="pe-fact"><span>E-posta</span><b>{person.email}</b></div>
              {person.work_email && <div className="pe-fact"><span>İş e-postası</span><b>{person.work_email}</b></div>}
              {person.personal_phone && <div className="pe-fact"><span>Kişisel tel</span><b>{person.personal_phone}</b></div>}
              {person.company_phone && <div className="pe-fact"><span>Kurumsal tel</span><b>{person.company_phone}</b></div>}
            </div>
          </Section>
          <Section title="Yetki & Onay" sub="rol profili">
            <div className="pe-facts">
              <div className="pe-fact"><span>Sistem rolü</span><b>{sysRoleLabel}</b></div>
              {person.business_role && <div className="pe-fact"><span>İş rolü</span><b>{person.business_role}</b></div>}
              <div className="pe-fact">
                <span>Onay limiti</span>
                <b>{fmtApprovalLimit(person.approval_limit)}</b>
              </div>
              {companyName && <div className="pe-fact"><span>Birincil firma</span><b>{companyName}</b></div>}
            </div>
          </Section>
        </div>

        {person.secondaryCompanyNames.length > 0 && (
          <Section title="Ayrıca yetkili" sub="diğer firma atamaları">
            <div className="pe-chips">
              {person.secondaryCompanyNames.map((n) => (
                <span key={n} className="pe-chip">{n}</span>
              ))}
            </div>
          </Section>
        )}
      </>
    );
  }

  function supplierUserDetail(supUser: AdminSupplierUserListItem, supplier: AdminSupplierListItem) {
    const name = normalizeTrText(supUser.name);
    const isActive = supUser.is_active !== false;
    return (
      <>
        <div className="pe-detail__hd">
          <span className="pe-av pe-av--lg pe-av--supplier">{personInit(name)}</span>
          <div className="pe-detail__info">
            <h3 className="pe-detail__title">
              {name}
              {" "}
              <span className="pe-srole-badge">Tedarikçi Kullanıcısı</span>
              <span className="pe-type-pill pe-type-pill--supplier">Tedarikçi</span>
              {!isActive && <span className="pe-badge pe-badge--off">Pasif</span>}
            </h3>
            <div className="pe-detail__meta">
              <span>{supplier.company_name}</span>
            </div>
          </div>
          <div className="pe-detail__acts">
            <button
              type="button"
              disabled={readOnly || loadingPersonId === supUser.id}
              className={"pe-status-btn" + (isActive ? " pe-status-btn--active" : " pe-status-btn--passive")}
              onClick={() => { void toggleSupplierUserActive(supplier.id, supUser, !isActive); }}
            >
              {loadingPersonId === supUser.id ? "…" : isActive ? "✓ Aktif" : "✗ Pasif"}
            </button>
            <button
              type="button"
              className="pe-act-btn"
              disabled={loadingPersonId === supUser.id}
              onClick={() => {
                setDetailPersonnel({
                  id: supUser.id,
                  email: supUser.email,
                  full_name: supUser.name,
                  role: "satinalmaci",
                  approval_limit: 0,
                  is_active: supUser.is_active !== false,
                  personal_phone: supUser.phone ?? null,
                });
              }}
            >
              Detay
            </button>
            {canOpenPanel && (
              <button
                type="button"
                className="pe-act-btn pe-act-btn--teal"
                disabled={openingPanelId === supUser.id}
                onClick={() => { void openSupplierPanel(supUser); }}
              >
                {openingPanelId === supUser.id ? "Açılıyor…" : "Paneli Aç ↗"}
              </button>
            )}
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="pe-act-btn pe-act-btn--edit"
                  disabled={loadingPersonId === supUser.id}
                  onClick={() => { void editSupplierUser(supplier.id, supUser); }}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  className={"pe-act-btn" + (isActive ? " pe-act-btn--del-disabled" : " pe-act-btn--del")}
                  disabled={isActive || loadingPersonId === supUser.id}
                  title={isActive ? "Silmek için önce pasife alın" : "Sil"}
                  onClick={() => { void removeSupplierUser(supplier.id, supUser); }}
                >
                  Sil
                </button>
              </>
            )}
          </div>
        </div>

        <div className="split-1-1">
          <Section title="İletişim" sub="tedarikçi kullanıcısı">
            <div className="pe-facts">
              <div className="pe-fact"><span>E-posta</span><b>{supUser.email}</b></div>
              {supUser.phone && <div className="pe-fact"><span>Telefon</span><b>{supUser.phone}</b></div>}
              <div className="pe-fact"><span>Firma</span><b>{supplier.company_name}</b></div>
              {supplier.city && <div className="pe-fact"><span>Şehir</span><b>{supplier.city}</b></div>}
            </div>
          </Section>
          <Section title="Firma bilgisi" sub="tedarikçi profili">
            <div className="pe-facts">
              {supplier.category && <div className="pe-fact"><span>Kategori</span><b>{supplier.category}</b></div>}
              {supplier.tenant_name && <div className="pe-fact"><span>Tenant</span><b>{supplier.tenant_name}</b></div>}
              <div className="pe-fact">
                <span>Özel liste</span>
                <b>{supplier.special_listing_active ? "Aktif" : "Pasif"}</b>
              </div>
            </div>
          </Section>
        </div>
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-tab">
      <PageHeader
        eyebrow="Yönetişim · Ekip"
        title="Ekip Üyeleri"
        sub="Ekosistemdeki tüm ekipler — stratejik partner personeli, tedarikçi yetkilileri, iş ortağı ekipleri ve kariyer/İK; rol, yetki ve davet durumuyla."
        actions={
          <button
            type="button"
            className="pe-add-btn"
            disabled={readOnly}
            onClick={() => setShowNewPersonnelModal(true)}
          >
            + Yeni Kullanici
          </button>
        }
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Toplam üye" value={stats.total} sub="4 ekip tipi" />
        <StatCard label="Aktif" value={stats.active} sub={`${stats.passive} pasif`} accent="green" />
        <StatCard label="Davet bekleyen" value={stats.pending} sub="kabul edilmedi" accent="warn" />
        <StatCard label="Rol sayısı" value={roles.length} sub="tanımlı katalog" accent="blue" />
      </div>

      {notice && (
        <div className={`pe-notice pe-notice--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" className="pe-notice__dismiss" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {readOnly && (
        <div className="pe-readonly-bar">
          Platform personeli bu alanda kullanici listesini inceleyebilir; oluşturma, düzenleme, aktiflik değiştirme ve silme aksiyonları yalnızca tenant yönetim yetkisi olan hesaplarda açılır.
        </div>
      )}

      {canOpenPanel && (
        <div className="pe-seg-tabs">
          {(isChannelUser
            ? [{ key: "channel" as PersonnelSegment, label: `Kanal Ekibi (${channelPersonnel.length})` }]
            : [
                { key: "portal" as PersonnelSegment,   label: `Portal (${portalPersonnel.length})` },
                { key: "partner" as PersonnelSegment,  label: `Stratejik Partner (${strategicPartnerPersonnel.length})` },
                { key: "channel" as PersonnelSegment,  label: `İş Ortağı (${channelPersonnel.length})` },
                { key: "supplier" as PersonnelSegment, label: `Tedarikçi (${supplierGroups.reduce((s, g) => s + g.users.length, 0)})` },
              ]
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              className={"pe-seg-btn" + (segment === item.key ? " pe-seg-btn--active" : "")}
              onClick={() => changeSegment(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="pe-toolbar">
        {(["all", "active", "passive"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={"pe-filter-btn" + (tab === f ? " pe-filter-btn--active" : "")}
            onClick={() => setTab(f)}
          >
            {f === "all" ? "Tümü" : f === "active" ? "Aktif" : "Pasif"}
          </button>
        ))}
        <div className="pe-search">
          <span className="pe-search__icon">⌕</span>
          <input
            className="pe-search__input"
            placeholder="İsim veya e-posta ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="pe-split">
        {/* ── List pane ── */}
        <aside className="pe-pool">
          <div className="pe-pool__hd">
            Ekip <span>{visibleList.length}</span>
          </div>
          <div className="pe-pool__list">
            {segment === "supplier" && supplierLoading ? (
              <div className="pe-state">Yükleniyor…</div>
            ) : segment === "supplier" && supplierError ? (
              <div className="pe-state pe-state--error">{supplierError}</div>
            ) : visibleList.length === 0 ? (
              <div className="pe-state">Eşleşen üye yok.</div>
            ) : (
              visibleList.map((item, idx) => {
                const prevGroup = idx > 0 ? visibleList[idx - 1].group : null;
                const showHeader = item.group !== prevGroup;
                const isSelected = item.kind === "tenant"
                  ? item.person.id === selPersonId
                  : selSupUserKey?.supplierId === item.supplierId && selSupUserKey?.userId === item.person.id;
                const isActive = item.person.is_active !== false;
                const name = item.kind === "tenant" ? normalizeTrText(item.person.full_name) : normalizeTrText(item.person.name);
                const email = item.person.email ?? "";
                const color = item.kind === "tenant"
                  ? ((item.person.company_assignments ?? [])[0]?.company?.color ?? SEG_COLORS[segment])
                  : SEG_COLORS.supplier;
                const pendingInvite = item.kind === "tenant" && item.person.invitation_accepted === false;
                const sysRoleLabel = item.kind === "tenant" ? getSystemRoleLabelForPerson(item.person) : "Tedarikçi";
                const itemKey = item.kind === "tenant" ? `t-${item.person.id}` : `s-${item.supplierId}-${item.person.id}`;

                return (
                  <div key={itemKey}>
                    {showHeader && (
                      <div className="pe-grouphd" style={{ "--pe-color": SEG_COLORS[segment] } as CSSProperties}>
                        <span />
                        {item.group}
                      </div>
                    )}
                    <div className="pe-row-wrap">
                      <button
                        type="button"
                        className={"pe-row" + (isSelected ? " on" : "") + (!isActive ? " pe-row--off" : "")}
                        style={{ "--pe-color": color } as CSSProperties}
                        onClick={() => {
                          if (item.kind === "tenant") { setSelPersonId(item.person.id); setSelSupUserKey(null); }
                          else { setSelSupUserKey({ supplierId: item.supplierId, userId: item.person.id }); setSelPersonId(null); }
                        }}
                      >
                        <span className="pe-row__bar" />
                        <span className="pe-av">{personInit(name)}</span>
                        <span className="pe-row__meta">
                          <b>
                            {name}
                            {pendingInvite && <span className="pe-tag pe-tag--inv">davet</span>}
                            {!isActive && <span className="pe-tag pe-tag--off">Pasif</span>}
                          </b>
                          <i>{email}</i>
                        </span>
                        <span className="pe-srole-sm">{sysRoleLabel}</span>
                      </button>
                      {item.kind === "tenant" && (
                        <div className="pe-row__inlineacts">
                          <button
                            type="button"
                            aria-label={`${name} Durum Kutusu`}
                            disabled={readOnly || loadingPersonId === item.person.id}
                            className={"pe-status-btn" + (isActive ? " pe-status-btn--active" : " pe-status-btn--passive")}
                            onClick={() => { void togglePersonnelActive(item.person, !isActive); }}
                          >
                            {loadingPersonId === item.person.id ? "…" : isActive ? "✓ Aktif" : "✗ Pasif"}
                          </button>
                          <button
                            type="button"
                            className="pe-act-btn"
                            disabled={loadingPersonId === item.person.id}
                            onClick={() => { void hydratePersonnel(item.person).then((h) => setDetailPersonnel(h)); }}
                          >
                            Detay
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                className="pe-act-btn pe-act-btn--edit"
                                disabled={loadingPersonId === item.person.id}
                                onClick={() => { void hydratePersonnel(item.person).then((h) => setEditPersonnel(h)); }}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                className={"pe-act-btn" + (isActive ? " pe-act-btn--del-disabled" : " pe-act-btn--del")}
                                disabled={isActive || loadingPersonId === item.person.id}
                                onClick={() => { void removePersonnel(item.person); }}
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Detail pane ── */}
        <div className="pe-detail">
          {segment !== "supplier" ? (
            selTenantPerson
              ? tenantPersonDetail(selTenantPerson)
              : <div className="pe-state pe-state--pad">Listeden bir üye seçin.</div>
          ) : (
            selSupUser && selSupGroup
              ? supplierUserDetail(selSupUser, selSupGroup.supplier)
              : <div className="pe-state pe-state--pad">Listeden bir tedarikçi kullanıcısı seçin.</div>
          )}
        </div>
      </div>

      {/* ── Role permission matrix ── */}
      {!isChannelUser && (
        <section className="pe-matrix-panel">
          <div className="pe-matrix-header">
            <div className="pe-matrix-header__row">
              <div>
                <div className="pe-matrix-title">Rol Yetki Matrisi</div>
                <div className="pe-matrix-desc">Güncel yetki modeline göre rol kombinasyonlarında açılan kritik yüzeylerin özet görünümü.</div>
              </div>
              <div className="pe-matrix-actions">
                <button type="button" className="pe-matrix-btn" onClick={() => setIsMatrixOpen((p) => !p)}>
                  {isMatrixOpen ? "Matrisi Gizle" : "Matrisi Aç"}
                </button>
                <select
                  value={matrixFilter}
                  onChange={(e) => setMatrixFilter(e.target.value as MatrixFilter)}
                  aria-label="Rol yetki matrisi filtre seçimi"
                  className="pe-matrix-sel"
                >
                  <option value="all">Tüm Roller</option>
                  <option value="platform">Platform Grubu</option>
                  <option value="portal">Portal / Satın Alma</option>
                  <option value="channel">Kanal / İş Ortağı</option>
                  <option value="supplier">Tedarikçi</option>
                </select>
                <button type="button" onClick={exportMatrixAsCsv} disabled={!isMatrixOpen} className="pe-matrix-btn pe-matrix-btn--primary">
                  CSV Dışa Aktar
                </button>
              </div>
            </div>
          </div>

          {isMatrixOpen && (
            <div className="pe-matrix-scroll">
              <table className="pe-matrix-table">
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
                    <th data-align="center">Destek Akışı</th>
                    <th data-align="center">Tenant Kimlik</th>
                    <th data-align="center">Ortak E-Posta</th>
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
                        <tr key={`group-${row.group}`} className="pe-matrix-group-row">
                          <td colSpan={11} className="pe-matrix-group-cell">
                            {groupLabels[row.group] ?? row.group}
                          </td>
                        </tr>
                      ) : null;
                      lastGroup = row.group;
                      return [
                        headerRow,
                        <tr key={`${row.businessRole}-${row.systemRole}`} className="pe-matrix-row">
                          <td className="pe-matrix-cell pe-matrix-cell--title">{row.businessRoleLabel}</td>
                          <td className="pe-matrix-cell pe-matrix-cell--value">{row.systemRoleLabel}</td>
                          {([row.adminSurface, row.manageUsers, row.quoteWorkspace, row.reviewApprovals, row.tenantGovernanceRead, row.tenantGovernanceWrite] as boolean[]).map((val, i) => (
                            <td key={i} className={`pe-matrix-cell ${val ? "pe-matrix-cell--yes" : "pe-matrix-cell--no"}`} data-align="center">
                              {toStatus(val)}
                            </td>
                          ))}
                          <td className={`pe-matrix-cell ${row.supportWorkflow ? "pe-matrix-cell--yes" : "pe-matrix-cell--no"}`} data-align="center">{toStatus(row.supportWorkflow)}</td>
                          <td className={`pe-matrix-cell ${row.tenantIdentitySettings ? "pe-matrix-cell--yes" : "pe-matrix-cell--no"}`} data-align="center">{toStatus(row.tenantIdentitySettings)}</td>
                          <td className={`pe-matrix-cell ${row.sharedEmailProfiles ? "pe-matrix-cell--yes" : "pe-matrix-cell--no"}`} data-align="center">{toStatus(row.sharedEmailProfiles)}</td>
                        </tr>,
                      ];
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <PersonnelCreateModal
        isOpen={showNewPersonnelModal}
        onClose={() => setShowNewPersonnelModal(false)}
        contextScope={isChannelUser ? "channel" : segment === "partner" ? "partner" : segment === "channel" ? "channel" : "portal"}
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
        onSuccess={() => { setEditPersonnel(null); setNotice({ type: "success", text: "Kullanıcı bilgileri güncellendi." }); loadData(); }}
        editData={editPersonnel}
      />

      {detailPersonnel && (
        <PersonnelDetailModal
          personnel={detailPersonnel}
          onClose={() => setDetailPersonnel(null)}
          onResetPassword={
            readOnly ? undefined : async (id: number) => {
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
      )}
    </div>
  );
}
