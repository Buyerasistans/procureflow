import { useMemo, useState } from "react";
import { CompanyCreateModal } from "../../components/CompanyCreateModal";
import type { AdminSupplierListItem, Company, Tenant, TenantUser } from "../../services/admin.service";
import { deleteAdminSupplier, updateAdminSupplierManagementDetail, updateCompany } from "../../services/admin.service";
import { buildTenantScopeMap, resolveCompanyScope } from "../../utils/scopeResolver";

type CompanySegment = "portal" | "partner" | "supplier" | "channel";

interface CompaniesTabProps {
  companies: Company[];
  loadData: () => Promise<void>;
  handleDeleteCompany: (id: number) => Promise<void>;
  readOnly?: boolean;
  suppliers?: AdminSupplierListItem[];
  channelUsers?: TenantUser[];
  personnel?: TenantUser[];
  tenants?: Tenant[];
}

type EntityModalState = {
  entityType: "company" | "supplier";
  entityId: number;
  entityName: string;
  edit: boolean;
};

export function CompaniesTab({
  companies,
  loadData,
  handleDeleteCompany,
  readOnly = false,
  suppliers = [],
  channelUsers = [],
  personnel = [],
  tenants = [],
}: CompaniesTabProps) {
  const PLATFORM_SUPER_ADMIN_EMAIL = "superadmin@buyerasistans.com.tr";
  const PLATFORM_SUPER_ADMIN_LABEL = "Platform Super Admin - superadmin@buyerasistans.com.tr";
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [segment, setSegment] = useState<CompanySegment>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("procureflow.companies.segment");
      if (stored === "portal" || stored === "partner" || stored === "supplier" || stored === "channel") {
        return stored;
      }
    }
    return "portal";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [supplierTogglingId, setSupplierTogglingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [entityModal, setEntityModal] = useState<EntityModalState | null>(null);

  const changeSegment = (next: CompanySegment) => {
    setSegment(next);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("procureflow.companies.segment", next);
    }
  };

  const tenantScopeMap = useMemo(
    () => buildTenantScopeMap(tenants, [...personnel, ...channelUsers], suppliers),
    [tenants, personnel, channelUsers, suppliers],
  );

  // Classify companies into segments
  const portalCompanies = useMemo(
    () => companies.filter((c) => resolveCompanyScope(c, tenantScopeMap) === "portal"),
    [companies, tenantScopeMap],
  );
  const partnerCompanies = useMemo(
    () => companies.filter((c) => resolveCompanyScope(c, tenantScopeMap) === "partner"),
    [companies, tenantScopeMap],
  );
  const channelCompanies = useMemo(
    () => companies.filter((c) => resolveCompanyScope(c, tenantScopeMap) === "channel"),
    [companies, tenantScopeMap],
  );

  const segmentCompanies = useMemo(() => {
    if (segment === "portal") return portalCompanies;
    if (segment === "partner") return partnerCompanies;
    if (segment === "channel") return channelCompanies;
    return []; // supplier segment handled separately
  }, [segment, portalCompanies, partnerCompanies, channelCompanies]);

  const filteredCompanies = useMemo(() => {
    if (statusFilter === "active") return segmentCompanies.filter((c) => c.is_active);
    if (statusFilter === "passive") return segmentCompanies.filter((c) => !c.is_active);
    return segmentCompanies;
  }, [segmentCompanies, statusFilter]);

  const filteredSuppliers = useMemo(() => {
    if (statusFilter === "active") return suppliers.filter((s) => s.is_active !== false);
    if (statusFilter === "passive") return suppliers.filter((s) => s.is_active === false);
    return suppliers;
  }, [suppliers, statusFilter]);

  const segmentCounts = useMemo(() => ({
    portal: portalCompanies.length,
    partner: partnerCompanies.length,
    supplier: suppliers.length,
    channel: channelCompanies.length,
  }), [portalCompanies.length, partnerCompanies.length, suppliers.length, channelCompanies.length]);

  const resolveCompanyTenantLabel = (company: Company): string | null => {
    if (!company.tenant_id) return null;
    const tenant = tenants.find((t) => t.id === company.tenant_id);
    if (!tenant) return null;
    return tenant.brand_name || tenant.legal_name;
  };

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";

  const isDeletedPersonValue = (value?: string | null): boolean => {
    const normalized = String(value || "").trim().toLocaleLowerCase("tr");
    return normalized.includes("silinen personel") || normalized.includes("deleted-user-") || normalized.endsWith("@procureflow.local");
  };

  const peopleById = useMemo(() => {
    const map = new Map<number, TenantUser>();
    [...personnel, ...channelUsers].forEach((person) => {
      if (!map.has(person.id)) {
        map.set(person.id, person);
      }
    });
    return map;
  }, [personnel, channelUsers]);

  const platformSuperAdmin = useMemo(
    () => [...personnel, ...channelUsers].find((person) => String(person.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL),
    [channelUsers, personnel],
  );

  const responsibleByCompanyId = useMemo(() => {
    const map = new Map<number, { label: string; score: number }>();

    const resolveAssignmentScore = (person: TenantUser, assignment: NonNullable<TenantUser["company_assignments"]>[number]): number => {
      const systemRole = String(person.system_role || "").trim().toLowerCase();
      if (systemRole === "super_admin" || systemRole === "tenant_owner") return 0;
      if (systemRole === "tenant_admin") return 1;
      const hierarchy = typeof assignment.role?.hierarchy_level === "number" ? assignment.role.hierarchy_level : 99;
      return 10 + hierarchy;
    };

    [...personnel, ...channelUsers].forEach((person) => {
      if (!person.is_active) return;
      const personLabel = person.full_name || person.email || "-";
      if (isDeletedPersonValue(personLabel) || isDeletedPersonValue(person.email)) return;
      const assignments = person.company_assignments || [];
      assignments.forEach((assignment) => {
        if (!assignment.is_active) return;
        const score = resolveAssignmentScore(person, assignment);
        const current = map.get(assignment.company_id);
        if (!current || score < current.score || (score === current.score && personLabel.localeCompare(current.label, "tr") < 0)) {
          map.set(assignment.company_id, { label: personLabel, score });
        }
      });
    });

    return new Map<number, string>(
      Array.from(map.entries()).map(([companyId, value]) => [companyId, value.label]),
    );
  }, [personnel, channelUsers]);

  const tableHeadCellStyle = {
    padding: 10,
    textAlign: "left" as const,
    borderRight: "1px solid #d9e2ec",
  };

  const tableBodyCellStyle = {
    padding: "8px 10px",
    borderRight: "1px solid #eef2f7",
  };

  const companyNameCellStyle = {
    ...tableBodyCellStyle,
    fontWeight: 600,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const responsibleCellStyle = {
    ...tableBodyCellStyle,
    color: "#475569",
    fontSize: 13,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const roleCellStyle = {
    ...tableBodyCellStyle,
    width: 152,
    minWidth: 152,
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    fontSize: 12,
  };

  const statusCellStyle = {
    ...tableBodyCellStyle,
    width: 132,
    minWidth: 132,
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
  };

  const actionCellStyle = {
    padding: "8px 10px",
    width: 132,
    minWidth: 132,
    textAlign: "right" as const,
    verticalAlign: "middle" as const,
  };

  const tableColumnStyles = {
    logo: { ...tableHeadCellStyle, width: 72, minWidth: 72 },
    name: tableHeadCellStyle,
    responsible: { ...tableHeadCellStyle, width: 210, minWidth: 210 },
    role: { ...tableHeadCellStyle, width: 152, minWidth: 152, textAlign: "center" as const },
    status: { ...tableHeadCellStyle, width: 132, minWidth: 132, textAlign: "center" as const },
    action: { padding: "10px 10px", width: 132, minWidth: 132, textAlign: "right" as const },
  };

  const iconButtonBaseStyle = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const detailButtonStyle = {
    ...iconButtonBaseStyle,
    background: "#eff6ff",
    borderColor: "#bfdbfe",
  };

  const editButtonStyle = {
    ...iconButtonBaseStyle,
    background: "#ecfdf3",
    borderColor: "#bbf7d0",
  };

  const renderActionIcon = (path: string, color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const renderLogoCell = (logoUrl?: string | null, name?: string) => {
    const src = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${apiBase}${logoUrl}`) : null;
    return (
      <div style={{ width: 52, height: 52, borderRadius: 10, border: "1px solid #dbe3ee", background: "#f8fafc", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {src
          ? <img src={src} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} />
          : <span style={{ fontSize: 10, color: "#cbd5e1" }}>-</span>}
      </div>
    );
  };

  const resolveCompanyResponsible = (company: Company): string => {
    if (company.is_platform_primary) {
      return platformSuperAdmin?.full_name && platformSuperAdmin.full_name.trim().length > 0
        ? `${platformSuperAdmin.full_name} - ${platformSuperAdmin.email}`
        : PLATFORM_SUPER_ADMIN_LABEL;
    }
    if (responsibleByCompanyId.has(company.id)) {
      return responsibleByCompanyId.get(company.id) || "-";
    }
    if (company.owner_full_name && company.owner_full_name.trim().length > 0 && !isDeletedPersonValue(company.owner_full_name)) return company.owner_full_name;
    if (company.created_by_id && peopleById.has(company.created_by_id)) {
      const creator = peopleById.get(company.created_by_id);
      const creatorLabel = creator?.full_name || creator?.email || "";
      if (creator?.is_active && !isDeletedPersonValue(creatorLabel) && !isDeletedPersonValue(creator?.email)) {
        return creatorLabel;
      }
    }
    if (company.owner_email && company.owner_email.trim().length > 0 && !isDeletedPersonValue(company.owner_email)) return company.owner_email;
    if (company.contact_info && company.contact_info.trim().length > 0) return company.contact_info;
    return "-";
  };

  const resolveSupplierResponsible = (supplier: AdminSupplierListItem): string => {
    if (supplier.created_by_id && peopleById.has(supplier.created_by_id)) {
      const creator = peopleById.get(supplier.created_by_id);
      const creatorLabel = creator?.full_name || creator?.email || "";
      if (creator?.is_active && !isDeletedPersonValue(creatorLabel) && !isDeletedPersonValue(creator?.email)) {
        return creatorLabel;
      }
    }
    if (supplier.email && supplier.email.trim().length > 0) return supplier.email;
    if (supplier.phone && supplier.phone.trim().length > 0) return supplier.phone;
    return "-";
  };

  const renderSupplierStatusToggle = (supplier: AdminSupplierListItem) => {
    const isActive = supplier.is_active !== false;
    return (
      <button
        type="button"
        disabled={readOnly || supplierTogglingId === supplier.id}
        onClick={async () => {
          if (readOnly) return;
          setSupplierTogglingId(supplier.id);
          try {
            await updateAdminSupplierManagementDetail(supplier.id, { is_active: !isActive });
            await loadData();
            setNotice({ type: "success", text: isActive ? "Tedarikci pasife alindi." : "Tedarikci aktife alindi." });
          } catch {
            setNotice({ type: "error", text: "Tedarikci durumu degistirilemedi." });
          } finally {
            setSupplierTogglingId(null);
          }
        }}
        style={{
          padding: "4px 10px",
          border: `1px solid ${isActive ? "#10b981" : "#ef4444"}`,
          borderRadius: 8,
          background: isActive ? "#d1fae5" : "#fee2e2",
          color: isActive ? "#065f46" : "#991b1b",
          fontWeight: 700,
          fontSize: 12,
          cursor: readOnly ? "default" : "pointer",
          opacity: supplierTogglingId === supplier.id ? 0.5 : 1,
        }}
      >
        {isActive ? "✓ Aktif" : "✗ Pasif"}
      </button>
    );
  };

  const openEntityModal = (entityType: "company" | "supplier", entityId: number, entityName: string, edit: boolean) => {
    setEntityModal({ entityType, entityId, entityName, edit });
  };

  const resolveCompanyRoleLabel = (company: Company): string => {
    if (segment === "partner") return company.is_primary ? "Ana Firma" : "Alt Firma";
    if (segment === "channel") return "Is Ortagi";
    return company.is_platform_primary ? "Platform Ana" : "Portal Firma";
  };

  const renderStatusToggle = (company: Company) => {
    const isProtectedPlatformPrimary = company.is_platform_primary;
    const isActive = company.is_active;
    return (
      <button
        type="button"
        disabled={readOnly || togglingId === company.id || isProtectedPlatformPrimary}
        onClick={async () => {
          if (readOnly || isProtectedPlatformPrimary) return;
          setTogglingId(company.id);
          try {
            await updateCompany(company.id, { is_active: !isActive });
            await loadData();
            setNotice({ type: "success", text: isActive ? "Firma pasife alindi." : "Firma aktife alindi." });
          } catch {
            setNotice({ type: "error", text: "Durum degistirilemedi." });
          } finally {
            setTogglingId(null);
          }
        }}
        style={{
          padding: "4px 10px",
          border: `1px solid ${isActive ? "#10b981" : "#ef4444"}`,
          borderRadius: 8,
          background: isActive ? "#d1fae5" : "#fee2e2",
          color: isActive ? "#065f46" : "#991b1b",
          fontWeight: 700,
          fontSize: 12,
          cursor: readOnly || isProtectedPlatformPrimary ? "default" : "pointer",
          opacity: togglingId === company.id ? 0.5 : isProtectedPlatformPrimary ? 0.7 : 1,
        }}
        title={isProtectedPlatformPrimary ? "Platform ana firma pasife alinamaz" : undefined}
      >
        {isActive ? "✓ Aktif" : "✗ Pasif"}
      </button>
    );
  };

  const renderCompanyActions = (company: Company) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "nowrap" }}>
      <button
        type="button"
        onClick={() => openEntityModal("company", company.id, company.name, false)}
        title="Detay"
        aria-label={`Detay: ${company.name}`}
        style={detailButtonStyle}
      >
        {renderActionIcon("M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "#475569")}
      </button>
      {!readOnly && (
        <button
          type="button"
          onClick={() => openEntityModal("company", company.id, company.name, true)}
          title="Duzenle"
          aria-label={`Duzenle: ${company.name}`}
          style={editButtonStyle}
        >
          {renderActionIcon("M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z", "#15803d")}
        </button>
      )}
      {!readOnly && (
        <button
          type="button"
          disabled={company.is_active || company.is_platform_primary}
          onClick={() => handleDeleteCompany(company.id)}
          title={company.is_platform_primary ? "Platform ana firma silinemez" : company.is_active ? "Silmek icin once pasife alin" : "Sil"}
          aria-label={`Sil: ${company.name}`}
          style={{
            ...iconButtonBaseStyle,
            borderColor: company.is_active || company.is_platform_primary ? "#d1d5db" : "#fecaca",
            background: company.is_active || company.is_platform_primary ? "#f3f4f6" : "#fef2f2",
            cursor: company.is_active || company.is_platform_primary ? "not-allowed" : "pointer",
            opacity: company.is_active || company.is_platform_primary ? 0.6 : 1,
          }}
        >
          {renderActionIcon("M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6m3 4v8m4-8v8", company.is_active || company.is_platform_primary ? "#94a3b8" : "#dc2626")}
        </button>
      )}
    </div>
  );

  const renderSupplierActions = (supplier: AdminSupplierListItem) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "nowrap" }}>
      <button
        type="button"
        onClick={() => openEntityModal("supplier", supplier.id, supplier.company_name, false)}
        title="Detay"
        aria-label={`Detay: ${supplier.company_name}`}
        style={detailButtonStyle}
      >
        {renderActionIcon("M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "#2563eb")}
      </button>
      {!readOnly && (
        <button
          type="button"
          onClick={() => openEntityModal("supplier", supplier.id, supplier.company_name, true)}
          title="Duzenle"
          aria-label={`Duzenle: ${supplier.company_name}`}
          style={editButtonStyle}
        >
          {renderActionIcon("M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z", "#15803d")}
        </button>
      )}
      {!readOnly && (
        <button
          type="button"
          disabled={supplier.is_active !== false}
          title={supplier.is_active !== false ? "Silmek icin once tedarikciyi pasife alin" : "Sil"}
          aria-label={`Sil: ${supplier.company_name}`}
          onClick={async () => {
            if (supplier.is_active !== false) return;
            const approved = window.confirm(`Tedarikci devre disi birakilsin mi? (${supplier.company_name})`);
            if (!approved) return;
            try {
              await deleteAdminSupplier(supplier.id);
              await loadData();
              setNotice({ type: "success", text: "Tedarikci devre disi birakildi." });
            } catch {
              setNotice({ type: "error", text: "Tedarikci silinemedi." });
            }
          }}
          style={{
            ...iconButtonBaseStyle,
            borderColor: supplier.is_active !== false ? "#d1d5db" : "#fecaca",
            background: supplier.is_active !== false ? "#f3f4f6" : "#fef2f2",
            cursor: supplier.is_active !== false ? "not-allowed" : "pointer",
            opacity: supplier.is_active !== false ? 0.6 : 1,
          }}
        >
          {renderActionIcon("M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6m3 4v8m4-8v8", supplier.is_active !== false ? "#94a3b8" : "#dc2626")}
        </button>
      )}
    </div>
  );

  const segmentTabs: { key: CompanySegment; label: string }[] = [
    { key: "portal", label: `Portal Ana Firmalar (${segmentCounts.portal})` },
    { key: "partner", label: `Stratejik Partner Firmalar (${segmentCounts.partner})` },
    { key: "supplier", label: `Tedarikci Firmalar (${segmentCounts.supplier})` },
    { key: "channel", label: `Is Ortagi Firmalar (${segmentCounts.channel})` },
  ];

  const renderCompaniesTable = (rows: Company[]) => {
    if (rows.length === 0) {
      return (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Bu segmentte firma bulunamadi.
        </div>
      );
    }

    if (segment === "partner") {
      const groups = Array.from(rows.reduce((map, company) => {
        const key = company.tenant_id != null ? `tenant-${company.tenant_id}` : `company-${company.id}`;
        if (!map.has(key)) map.set(key, [] as Company[]);
        map.get(key)?.push(company);
        return map;
      }, new Map<string, Company[]>()).entries())
        .map(([key, values]) => {
          const ordered = [...values].sort((left, right) => {
            const leftScore = left.is_primary ? 0 : 1;
            const rightScore = right.is_primary ? 0 : 1;
            if (leftScore !== rightScore) return leftScore - rightScore;
            return left.name.localeCompare(right.name, "tr");
          });
          return { key, rows: ordered, primary: ordered[0] };
        })
        .sort((left, right) => left.primary.name.localeCompare(right.primary.name, "tr"));

      return (
        <div style={{ display: "grid", gap: 14 }}>
          {groups.map((group) => {
            const tenantLabel = resolveCompanyTenantLabel(group.primary);
            return (
              <div key={group.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span>{group.primary.name} ({group.rows.length})</span>
                  <span style={{ color: "#64748b", fontWeight: 600 }}>{tenantLabel || "Partner Workspace"}</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #ddd" }}>
                        <th style={tableColumnStyles.logo}>Logo</th>
                        <th style={tableColumnStyles.name}>Firma Adi</th>
                        <th style={tableColumnStyles.responsible}>Yetkili Kisi</th>
                        <th style={tableColumnStyles.role}>Rol</th>
                        <th style={tableColumnStyles.status}>Durum</th>
                        <th style={tableColumnStyles.action}>Islem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((company) => (
                        <tr key={company.id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={tableBodyCellStyle}>{renderLogoCell(company.logo_url, company.name)}</td>
                          <td style={companyNameCellStyle} title={company.name}>{company.name}</td>
                          <td style={responsibleCellStyle} title={resolveCompanyResponsible(company)}>{resolveCompanyResponsible(company)}</td>
                          <td style={roleCellStyle}>
                            <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontWeight: 700, background: company.is_primary ? "#dbeafe" : "#e2e8f0", color: company.is_primary ? "#1d4ed8" : "#334155" }}>
                              {resolveCompanyRoleLabel(company)}
                            </span>
                          </td>
                          <td style={statusCellStyle}>{renderStatusToggle(company)}</td>
                          <td style={actionCellStyle}>{renderCompanyActions(company)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #ddd" }}>
              <th style={tableColumnStyles.logo}>Logo</th>
              <th style={tableColumnStyles.name}>Firma Adi</th>
              <th style={tableColumnStyles.responsible}>Yetkili Kisi</th>
              <th style={tableColumnStyles.role}>Rol</th>
              <th style={tableColumnStyles.status}>Durum</th>
              <th style={tableColumnStyles.action}>Islem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((company) => {
              return (
                <tr key={company.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tableBodyCellStyle}>
                    {renderLogoCell(company.logo_url, company.name)}
                  </td>
                  <td style={companyNameCellStyle} title={company.name}>{company.name}</td>
                  <td style={responsibleCellStyle} title={resolveCompanyResponsible(company)}>{resolveCompanyResponsible(company)}</td>
                  <td style={roleCellStyle}>
                    <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontWeight: 700, background: "#e2e8f0", color: "#334155" }}>
                      {resolveCompanyRoleLabel(company)}
                    </span>
                  </td>
                  <td style={statusCellStyle}>{renderStatusToggle(company)}</td>
                  <td style={actionCellStyle}>{renderCompanyActions(company)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSuppliersTable = (rows: AdminSupplierListItem[]) => (
    <div style={{ overflowX: "auto" }}>
      {rows.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Bu segmentte tedarikci bulunamadi.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {Array.from(rows.reduce((map, supplier) => {
            const key = supplier.tenant_id != null
              ? `tenant-${supplier.tenant_id}`
              : "platform-network";

            const tenantPrimaryCompany = supplier.tenant_id != null
              ? companies
                .filter((company) => company.tenant_id === supplier.tenant_id)
                .sort((left, right) => {
                  const leftScore = left.is_primary ? 0 : 1;
                  const rightScore = right.is_primary ? 0 : 1;
                  if (leftScore !== rightScore) return leftScore - rightScore;
                  return left.name.localeCompare(right.name, "tr");
                })[0]
              : null;

            const groupName = supplier.tenant_id != null
              ? (supplier.inviter_company_name || tenantPrimaryCompany?.name || supplier.tenant_name || `Tenant #${supplier.tenant_id}`)
              : "Buyera Asistans Ozel Tedarikci";

            if (!map.has(key)) {
              map.set(key, { key, name: groupName, suppliers: [] as AdminSupplierListItem[] });
            }
            map.get(key)?.suppliers.push(supplier);
            return map;
          }, new Map<string, { key: string; name: string; suppliers: AdminSupplierListItem[] }>()).values()).map((group) => (
            <div key={group.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>
                {group.name} ({group.suppliers.length})
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #ddd" }}>
                    <th style={tableColumnStyles.logo}>Logo</th>
                    <th style={tableColumnStyles.name}>Firma Adi</th>
                    <th style={tableColumnStyles.responsible}>Yetkili Kullanici</th>
                    <th style={tableColumnStyles.role}>Rol</th>
                    <th style={tableColumnStyles.status}>Durum</th>
                    <th style={tableColumnStyles.action}>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {group.suppliers.map((supplier) => (
                    <tr key={supplier.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={tableBodyCellStyle}>
                        {renderLogoCell(supplier.logo_url, supplier.company_name)}
                      </td>
                      <td style={companyNameCellStyle} title={supplier.company_name}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span>{supplier.company_name}</span>
                          {supplier.special_listing_active ? (
                            <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#ede9fe", color: "#5b21b6" }}>
                              Ozel Liste Hakki
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td style={responsibleCellStyle} title={resolveSupplierResponsible(supplier)}>{resolveSupplierResponsible(supplier)}</td>
                      <td style={roleCellStyle}>
                        <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontWeight: 700, background: "#ede9fe", color: "#5b21b6" }}>
                          Tedarikci
                        </span>
                      </td>
                      <td style={statusCellStyle}>{renderSupplierStatusToggle(supplier)}</td>
                      <td style={actionCellStyle}>{renderSupplierActions(supplier)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {readOnly && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", fontSize: 13 }}>
          Platform personeli firma portfoyunu inceleyebilir; yeni firma ekleme, duzenleme ve silme aksiyonlari bu yuzeyde salt okunur moda alinmistir.
        </div>
      )}

      {notice && (
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: notice.type === "success" ? "#d1fae5" : "#fee2e2", color: notice.type === "success" ? "#065f46" : "#991b1b", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: "inherit" }}>✕</button>
        </div>
      )}

      {/* Segment tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {segmentTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => changeSegment(tab.key)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: `1px solid ${segment === tab.key ? "#3b82f6" : "#e2e8f0"}`,
              background: segment === tab.key ? "#3b82f6" : "white",
              color: segment === tab.key ? "white" : "#374151",
              fontWeight: segment === tab.key ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter + Add button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "active", "passive"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            style={{
              padding: "5px 14px",
              borderRadius: 16,
              border: `1px solid ${statusFilter === f ? "#1d4ed8" : "#e2e8f0"}`,
              background: statusFilter === f ? "#1d4ed8" : "white",
              color: statusFilter === f ? "white" : "#374151",
              fontWeight: statusFilter === f ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {f === "all" ? "Tumu" : f === "active" ? "Aktif" : "Pasif"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {segment !== "supplier" && (
          <button
            type="button"
            onClick={() => !readOnly && setShowNewCompanyModal(true)}
            disabled={readOnly}
            style={{ padding: "8px 16px", background: readOnly ? "#9ca3af" : "#10b981", color: "white", border: "none", borderRadius: 8, cursor: readOnly ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}
          >
            + Yeni Firma
          </button>
        )}
      </div>

      {/* Content */}
      {segment === "supplier"
        ? renderSuppliersTable(filteredSuppliers)
        : renderCompaniesTable(filteredCompanies)}

      <CompanyCreateModal
        isOpen={showNewCompanyModal}
        onClose={() => setShowNewCompanyModal(false)}
        onSuccess={() => {
          loadData();
          setShowNewCompanyModal(false);
        }}
      />

      {entityModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setEntityModal(null)}
        >
          <div
            style={{
              width: "min(1240px, 96vw)",
              height: "min(88vh, 900px)",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #dbe3ee",
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.34)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ display: "grid", gap: 2 }}>
                <strong style={{ color: "#0f172a", fontSize: 14 }}>
                  {entityModal.edit ? "Duzenle" : "Detay"}: {entityModal.entityName}
                </strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {entityModal.entityType === "company" ? "Firma" : "Tedarikci"} bilgisi popup icinde acildi.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEntityModal(null)}
                style={{ border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, color: "#334155", fontWeight: 700, padding: "7px 10px", cursor: "pointer" }}
              >
                Kapat
              </button>
            </div>

            <iframe
              title={`${entityModal.entityType}-${entityModal.entityId}-modal`}
              src={entityModal.entityType === "company"
                ? `/admin/companies/${entityModal.entityId}?embedded=1${entityModal.edit ? "&edit=true" : ""}`
                : `/admin/suppliers/${entityModal.entityId}?embedded=1${entityModal.edit ? "&edit=true" : ""}`}
              style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
