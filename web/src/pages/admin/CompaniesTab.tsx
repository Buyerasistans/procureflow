import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { CompanyCreateModal } from "../../components/CompanyCreateModal";
import type {
  AdminSupplierListItem,
  Company,
  ProvisionResult,
  Tenant,
  TenantUser,
} from "../../services/admin.service";
import {
  deleteAdminSupplier,
  provisionMissingOwners,
  updateAdminSupplierManagementDetail,
  updateCompany,
} from "../../services/admin.service";
import { buildTenantScopeMap, resolveCompanyScope } from "../../utils/scopeResolver";
import { PageHeader, Section, StatCard } from "./AdminTabContent";
import "./CompaniesTab.css";

type CompanySegment = "portal" | "partner" | "supplier" | "channel" | "career";

interface CompaniesTabProps {
  companies: Company[];
  loadData: () => Promise<void>;
  handleDeleteCompany: (id: number) => Promise<void>;
  readOnly?: boolean;
  suppliers?: AdminSupplierListItem[];
  channelUsers?: TenantUser[];
  personnel?: TenantUser[];
  tenants?: Tenant[];
  visibleSegments?: CompanySegment[];
}

type EntityModalState = {
  entityType: "company" | "supplier";
  entityId: number;
  entityName: string;
  edit: boolean;
};

function coLogo(name: string): string {
  return name
    .split(" ")
    .filter((w) => /[A-Za-zÇĞİÖŞÜçğışöü0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";
}

const SEG_META: Record<CompanySegment, { label: string; color: string }> = {
  portal:   { label: "Portal",              color: "#0891b2" },
  partner:  { label: "Stratejik Partner",   color: "#1d4ed8" },
  supplier: { label: "Tedarikçi",           color: "#be123c" },
  channel:  { label: "İş Ortağı",          color: "#047857" },
  career:   { label: "Personel Arayan",     color: "#7c3aed" },
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
  visibleSegments,
}: CompaniesTabProps) {
  const PLATFORM_SUPER_ADMIN_EMAIL = "superadmin@buyerasistans.com.tr";
  const PLATFORM_SUPER_ADMIN_LABEL = "Platform Super Admin - superadmin@buyerasistans.com.tr";

  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [segment, setSegment] = useState<CompanySegment>(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("procureflow.companies.segment");
      if (stored === "portal" || stored === "partner" || stored === "supplier" || stored === "channel" || stored === "career") {
        const storedSeg = stored as CompanySegment;
        if (!visibleSegments || visibleSegments.includes(storedSeg)) return storedSeg;
      }
    }
    return visibleSegments?.[0] ?? "portal";
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "passive">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [supplierTogglingId, setSupplierTogglingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [entityModal, setEntityModal] = useState<EntityModalState | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const changeSegment = (next: CompanySegment) => {
    setSegment(next);
    setSelId(null);
    setQ("");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("procureflow.companies.segment", next);
    }
  };

  const tenantScopeMap = useMemo(
    () => buildTenantScopeMap(tenants, [...personnel, ...channelUsers], suppliers, companies),
    [tenants, personnel, channelUsers, suppliers, companies],
  );

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
  const careerCompanies = useMemo(
    () => companies.filter((c) => resolveCompanyScope(c, tenantScopeMap) === "career"),
    [companies, tenantScopeMap],
  );

  const segmentCompanies = useMemo(() => {
    if (segment === "portal")   return portalCompanies;
    if (segment === "partner")  return partnerCompanies;
    if (segment === "channel")  return channelCompanies;
    if (segment === "career")   return careerCompanies;
    return [];
  }, [segment, portalCompanies, partnerCompanies, channelCompanies, careerCompanies]);

  const ql = q.trim().toLowerCase();

  const filteredCompanies = useMemo(() => {
    let rows = segmentCompanies;
    if (statusFilter === "active")  rows = rows.filter((c) => c.is_active);
    if (statusFilter === "passive") rows = rows.filter((c) => !c.is_active);
    if (ql) rows = rows.filter((c) =>
      (c.name + " " + (c.trade_name ?? "") + " " + (c.city ?? "") + " " + (c.short_name ?? ""))
        .toLowerCase().includes(ql),
    );
    return rows;
  }, [segmentCompanies, statusFilter, ql]);

  const filteredSuppliers = useMemo(() => {
    let rows = suppliers;
    if (statusFilter === "active")  rows = rows.filter((s) => s.is_active !== false);
    if (statusFilter === "passive") rows = rows.filter((s) => s.is_active === false);
    if (ql) rows = rows.filter((s) =>
      (s.company_name + " " + (s.tenant_name ?? "") + " " + (s.inviter_company_name ?? ""))
        .toLowerCase().includes(ql),
    );
    return rows;
  }, [suppliers, statusFilter, ql]);

  const segmentCounts = useMemo(() => ({
    portal:   portalCompanies.length,
    partner:  partnerCompanies.length,
    supplier: suppliers.length,
    channel:  channelCompanies.length,
    career:   careerCompanies.length,
  }), [portalCompanies.length, partnerCompanies.length, suppliers.length, channelCompanies.length, careerCompanies.length]);

  // Reset expansion when segment changes
  useEffect(() => {
    setSelId(null);
  }, [segment]);

  const isDeletedPersonValue = (value?: string | null): boolean => {
    const normalized = String(value || "").trim().toLocaleLowerCase("tr");
    return normalized.includes("silinen personel") || normalized.includes("deleted-user-") || normalized.endsWith("@procureflow.local");
  };

  const peopleById = useMemo(() => {
    const map = new Map<number, TenantUser>();
    [...personnel, ...channelUsers].forEach((person) => {
      if (!map.has(person.id)) map.set(person.id, person);
    });
    return map;
  }, [personnel, channelUsers]);

  const platformSuperAdmin = useMemo(
    () => [...personnel, ...channelUsers].find(
      (person) => String(person.email || "").trim().toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL,
    ),
    [channelUsers, personnel],
  );

  const responsibleByCompanyId = useMemo(() => {
    const map = new Map<number, { label: string; score: number }>();
    const resolveAdminScore = (person: TenantUser): number | null => {
      const sr = String(person.system_role || "").trim().toLowerCase();
      if (sr === "super_admin" || sr === "tenant_owner") return 0;
      if (sr === "tenant_admin") return 1;
      return null; // tenant_member ve diğerleri yetkili sayılmaz
    };
    [...personnel, ...channelUsers].forEach((person) => {
      if (!person.is_active) return;
      const personLabel = person.full_name || person.email || "-";
      if (isDeletedPersonValue(personLabel) || isDeletedPersonValue(person.email)) return;
      const score = resolveAdminScore(person);
      if (score === null) return; // admin olmayan → yetkili değil
      (person.company_assignments || []).forEach((assignment) => {
        if (!assignment.is_active) return;
        const current = map.get(assignment.company_id);
        if (!current || score < current.score || (score === current.score && personLabel.localeCompare(current.label, "tr") < 0)) {
          map.set(assignment.company_id, { label: personLabel, score });
        }
      });
    });
    return new Map<number, string>(Array.from(map.entries()).map(([id, v]) => [id, v.label]));
  }, [personnel, channelUsers]);

  const resolveCompanyTenantLabel = (company: Company): string | null => {
    if (!company.tenant_id) return null;
    const tenant = tenants.find((t) => t.id === company.tenant_id);
    if (!tenant) return null;
    return tenant.brand_name || tenant.legal_name;
  };

  const resolveCompanyResponsible = (company: Company): string => {
    if (company.is_platform_primary) {
      return platformSuperAdmin?.full_name && platformSuperAdmin.full_name.trim().length > 0
        ? `${platformSuperAdmin.full_name} - ${platformSuperAdmin.email}`
        : PLATFORM_SUPER_ADMIN_LABEL;
    }
    if (responsibleByCompanyId.has(company.id)) return responsibleByCompanyId.get(company.id) || "-";
    if (company.owner_full_name && !isDeletedPersonValue(company.owner_full_name)) return company.owner_full_name;
    if (company.created_by_id && peopleById.has(company.created_by_id)) {
      const creator = peopleById.get(company.created_by_id);
      const label = creator?.full_name || creator?.email || "";
      if (creator?.is_active && !isDeletedPersonValue(label) && !isDeletedPersonValue(creator?.email)) return label;
    }
    if (company.owner_email && !isDeletedPersonValue(company.owner_email)) return company.owner_email;
    if (company.contact_info) return company.contact_info;
    return "-";
  };

  const resolveSupplierResponsible = (supplier: AdminSupplierListItem): string => {
    if (supplier.created_by_id && peopleById.has(supplier.created_by_id)) {
      const creator = peopleById.get(supplier.created_by_id);
      const label = creator?.full_name || creator?.email || "";
      if (creator?.is_active && !isDeletedPersonValue(label) && !isDeletedPersonValue(creator?.email)) return label;
    }
    if (supplier.email) return supplier.email;
    if (supplier.phone) return supplier.phone;
    return "-";
  };

  const openEntityModal = (entityType: "company" | "supplier", entityId: number, entityName: string, edit: boolean) => {
    setEntityModal({ entityType, entityId, entityName, edit });
  };

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";

  const renderLogoImg = (logoUrl?: string | null, name?: string) => {
    const src = logoUrl ? (logoUrl.startsWith("http") ? logoUrl : `${apiBase}${logoUrl}`) : null;
    if (src) {
      return <img src={src} alt={name ?? ""} className="co-logo__img" />;
    }
    return null;
  };

  const handleToggleCompanyActive = async (company: Company) => {
    if (readOnly || company.is_platform_primary) return;
    setTogglingId(company.id);
    try {
      await updateCompany(company.id, { is_active: !company.is_active });
      await loadData();
      setNotice({ type: "success", text: company.is_active ? "Firma pasife alındı." : "Firma aktife alındı." });
    } catch {
      setNotice({ type: "error", text: "Durum değiştirilemedi." });
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleSupplierActive = async (supplier: AdminSupplierListItem) => {
    if (readOnly) return;
    setSupplierTogglingId(supplier.id);
    const isActive = supplier.is_active !== false;
    try {
      await updateAdminSupplierManagementDetail(supplier.id, { is_active: !isActive });
      await loadData();
      setNotice({ type: "success", text: isActive ? "Tedarikçi pasife alındı." : "Tedarikçi aktife alındı." });
    } catch {
      setNotice({ type: "error", text: "Tedarikçi durumu değiştirilemedi." });
    } finally {
      setSupplierTogglingId(null);
    }
  };

  const handleDeleteSupplier = async (supplierId: number) => {
    if (readOnly) return;
    try {
      await deleteAdminSupplier(supplierId);
      await loadData();
      setNotice({ type: "success", text: "Tedarikçi silindi." });
    } catch {
      setNotice({ type: "error", text: "Tedarikçi silinemedi." });
    }
  };

  const segmentTabs: { key: CompanySegment; label: string }[] = ([
    { key: "portal",   label: `Portal Ana Firmalar (${segmentCounts.portal})` },
    { key: "partner",  label: `Stratejik Partner (${segmentCounts.partner})` },
    { key: "supplier", label: `Tedarikçi (${segmentCounts.supplier})` },
    { key: "channel",  label: `İş Ortağı (${segmentCounts.channel})` },
    { key: "career",   label: `Personel Arayan (${segmentCounts.career})` },
  ] as { key: CompanySegment; label: string }[]).filter(
    (t) => !visibleSegments || visibleSegments.includes(t.key)
  );

  // ── Partner list: group by tenant ──────────────────────────────────────────
  const partnerGrouped = useMemo(() => {
    if (segment !== "partner") return null;
    const map = new Map<string, Company[]>();
    filteredCompanies.forEach((c) => {
      const key = c.tenant_id != null ? `t${c.tenant_id}` : `c${c.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.values()).map((group) =>
      [...group].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)),
    );
  }, [segment, filteredCompanies]);

  const listCount = segment === "supplier" ? filteredSuppliers.length : filteredCompanies.length;

  // ── Render helpers ──────────────────────────────────────────────────────────

  function companyDetail(c: Company) {
    const segColor = SEG_META[segment].color;
    const responsible = resolveCompanyResponsible(c);
    const relatedCompanies = segment === "partner"
      ? companies.filter((x) => x.tenant_id === c.tenant_id && x.id !== c.id)
      : [];

    return (
      <>
        <div className="co-detail__hd">
          <span className="co-logo co-logo--lg" style={{ "--co-color": c.color } as CSSProperties}>
            {renderLogoImg(c.logo_url, c.name) ?? coLogo(c.name)}
          </span>
          <div className="co-detail__info">
            <h3 className="co-detail__title">
              {c.name}
              {" "}
              <span className="co-type-pill" style={{ "--pill-bg": segColor + "1f", "--pill-fg": segColor } as CSSProperties}>
                {SEG_META[segment].label}
              </span>
              {c.is_platform_primary && <span className="co-badge co-badge--platform">★ Platform Ana</span>}
              {segment === "partner" && c.is_primary && <span className="co-badge co-badge--primary">★ Ana Firma</span>}
              {segment === "partner" && !c.is_primary && <span className="co-badge co-badge--sub">Alt Firma</span>}
              {!c.is_active && <span className="co-badge co-badge--off">Pasif</span>}
            </h3>
            <div className="co-detail__meta">
              {resolveCompanyTenantLabel(c) && (
                <><span className="co-detail__tenant">{resolveCompanyTenantLabel(c)}</span><span className="co-sep">·</span></>
              )}
              {c.city && <><span>{c.city}</span><span className="co-sep">·</span></>}
              {(c.quote_count ?? 0) > 0 && <><span>{c.quote_count} proje</span><span className="co-sep">·</span></>}
              {(c.personnel_count ?? 0) > 0 && <span>{c.personnel_count} personel</span>}
            </div>
          </div>
        </div>

        <div className="split-1-1">
          <Section title="Kimlik" sub="resmi kayıt">
            <div className="co-facts">
              {c.trade_name && <div className="co-fact"><span>Ticari unvan</span><b>{c.trade_name}</b></div>}
              {c.short_name && <div className="co-fact"><span>Kısa ad</span><b>{c.short_name}</b></div>}
              <div className="co-fact">
                <span>Şehir / ilçe</span>
                <b>{[c.city, c.address_district].filter(Boolean).join(" / ") || "—"}</b>
              </div>
              {c.address && <div className="co-fact co-fact--wide"><span>Adres</span><b>{c.address}</b></div>}
              {c.tax_number && <div className="co-fact"><span>Vergi no</span><b className="co-mono">{c.tax_number}</b></div>}
              {c.tax_office && <div className="co-fact"><span>Vergi dairesi</span><b>{c.tax_office}</b></div>}
              {c.registration_number && <div className="co-fact"><span>Sicil no</span><b className="co-mono">{c.registration_number}</b></div>}
              {c.phone && <div className="co-fact"><span>Telefon</span><b>{c.phone}</b></div>}
            </div>
          </Section>

          <Section title="Yetkili & iletişim" sub="birincil kişi">
            <div className="co-contact">
              <span className="co-av" style={{ "--co-color": c.color } as CSSProperties}>
                {coLogo(c.owner_full_name ?? c.name)}
              </span>
              <div className="co-contact__b">
                <b>{c.owner_full_name || responsible || "—"}</b>
                {c.owner_email && <span>{c.owner_email}</span>}
                {c.phone && !c.owner_email && <span>{c.phone}</span>}
                {c.contact_info && <span>{c.contact_info}</span>}
              </div>
            </div>
          </Section>
        </div>

        {c.departments && c.departments.length > 0 && (
          <Section title="Departmanlar" sub={`${c.departments.length} birim`}>
            <div className="co-chips">
              {c.departments.map((d) => (
                <span key={d.id} className="co-chip">{d.name}</span>
              ))}
            </div>
          </Section>
        )}

        {segment === "partner" && relatedCompanies.length > 0 && (
          <Section
            title={c.is_primary ? "Bağlı alt firmalar" : "İlgili firmalar"}
            sub={`${relatedCompanies.length} tüzel kişilik bu tenant'a bağlı`}
          >
            <div className="co-family">
              {relatedCompanies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="co-famcard"
                  style={{ "--co-color": r.color } as CSSProperties}
                  onClick={() => setSelId(r.id)}
                >
                  <span className="co-logo co-logo--sm">
                    {coLogo(r.name)}
                  </span>
                  <div>
                    <b>{r.name}</b>
                    <span>{r.is_primary ? "Ana firma" : "Alt firma"} · {r.city ?? "—"}</span>
                  </div>
                  <span className="co-famcard__go">→</span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </>
    );
  }

  function supplierDetail(s: AdminSupplierListItem) {
    const tags = s.effective_category_tags ?? s.category_tags ?? [];
    const responsible = resolveSupplierResponsible(s);

    return (
      <>
        <div className="split-1-1">
          <Section title="Tedarik profili" sub="kategori & iletişim">
            <div className="co-facts">
              {s.category && <div className="co-fact"><span>Kategori</span><b>{s.category}</b></div>}
              {s.city && <div className="co-fact"><span>Şehir</span><b>{s.city}</b></div>}
              {s.email && <div className="co-fact"><span>E-posta</span><b>{s.email}</b></div>}
              {s.phone && <div className="co-fact"><span>Telefon</span><b>{s.phone}</b></div>}
              {s.source_type && <div className="co-fact"><span>Kaynak</span><b>{s.source_type}</b></div>}
              {s.dual_role_status && <div className="co-fact"><span>Çift rol</span><b>{s.dual_role_status}</b></div>}
            </div>
          </Section>

          <Section title="Yetkili" sub="sorumlu kullanıcı">
            <div className="co-contact">
              <span className="co-av co-av--supplier">
                {coLogo(responsible || s.company_name)}
              </span>
              <div className="co-contact__b">
                <b>{responsible}</b>
                {s.email && <span>{s.email}</span>}
              </div>
            </div>
          </Section>
        </div>

        {tags.length > 0 && (
          <Section title="Kategori etiketleri" sub={`${tags.length} etiket`}>
            <div className="co-chips">
              {tags.map((t) => <span key={t} className="co-chip">{t}</span>)}
            </div>
          </Section>
        )}
      </>
    );
  }

  function companyRow(c: Company) {
    const isAlt = segment === "partner" && !c.is_primary;
    const isExpanded = c.id === selId;
    const responsible = resolveCompanyResponsible(c);
    const responsibleIsDeleted = responsible === "-"
      || isDeletedPersonValue(responsible)
      || isDeletedPersonValue(c.owner_full_name)
      || isDeletedPersonValue(c.owner_email);

    return (
      <div key={c.id} className={"co-row-wrap" + (isExpanded ? " co-row-wrap--open" : "")}>
        <button
          type="button"
          className={"co-row" + (isExpanded ? " on" : "") + (!c.is_active ? " co-row--off" : "") + (isAlt ? " co-row--alt" : "")}
          style={{ "--co-color": c.color } as CSSProperties}
          onClick={() => setSelId(isExpanded ? null : c.id)}
          aria-expanded={isExpanded ? "true" : "false"}
        >
          <span className="co-row__bar" />
          {isAlt && <span className="co-row__tree">└</span>}
          <span className="co-logo co-logo--sm">
            {renderLogoImg(c.logo_url, c.name) ?? coLogo(c.name)}
          </span>
          <span className="co-row__meta">
            <b>
              {c.name}
              {c.is_platform_primary && <span className="co-tag co-tag--platform">PLATFORM</span>}
              {segment === "partner" && c.is_primary && <span className="co-tag co-tag--main">ANA</span>}
              {segment === "partner" && !c.is_primary && <span className="co-tag co-tag--alt">alt</span>}
              {!c.is_active && <span className="co-tag co-tag--off">Pasif</span>}
              {responsibleIsDeleted && <span className="co-tag co-tag--warn">Yetkili Eksik</span>}
            </b>
            <i>{resolveCompanyTenantLabel(c) ?? resolveCompanyResponsible(c)} · {c.city ?? "—"}</i>
          </span>
          {(c.quote_count ?? 0) > 0 && (
            <span className="co-row__count">{c.quote_count} proje</span>
          )}
          <span className="co-row__chev">{isExpanded ? "▴" : "▾"}</span>
        </button>
        <div className="co-row__inlineacts">
          <button
            type="button"
            aria-label={`Detay ${c.name}`}
            className="co-act-btn"
            onClick={() => openEntityModal("company", c.id, c.name, false)}
          >
            Detay
          </button>
          {!readOnly && (
            <button
              type="button"
              aria-label={`Duzenle ${c.name}`}
              className="co-act-btn co-act-btn--edit"
              onClick={() => openEntityModal("company", c.id, c.name, true)}
            >
              Düzenle
            </button>
          )}
          <button
            type="button"
            disabled={readOnly || togglingId === c.id || !!c.is_platform_primary}
            className={"co-status-btn" + (c.is_active ? " co-status-btn--active" : " co-status-btn--passive")}
            onClick={() => { void handleToggleCompanyActive(c); }}
          >
            {togglingId === c.id ? "…" : c.is_active ? "✓ Aktif" : "✗ Pasif"}
          </button>
          {!readOnly && (
            <button
              type="button"
              aria-label={`Sil ${c.name}`}
              className="co-act-btn co-act-btn--delete"
              disabled={c.is_active}
              onClick={() => { void handleDeleteCompany(c.id); }}
            >
              Sil
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="co-expand">
            {responsibleIsDeleted && (
              <div className="co-expand__warn">
                ⚠️ Bu firmanın yetkili kullanıcısı silinmiş veya ayrılmış. Firma yetkilisiz kalmadan önce yeni bir yetkili kullanıcı atayın.
              </div>
            )}
            {companyDetail(c)}
          </div>
        )}
      </div>
    );
  }

  function supplierRow(s: AdminSupplierListItem) {
    const isActive = s.is_active !== false;
    const isExpanded = s.id === selId;
    const responsible = resolveSupplierResponsible(s);
    const responsibleIsDeleted = isDeletedPersonValue(responsible) || isDeletedPersonValue(s.email);

    return (
      <div key={s.id} className={"co-row-wrap" + (isExpanded ? " co-row-wrap--open" : "")}>
        <button
          type="button"
          className={"co-row co-row--supplier" + (isExpanded ? " on" : "") + (!isActive ? " co-row--off" : "")}
          style={{ "--co-color": "#be123c" } as CSSProperties}
          onClick={() => setSelId(isExpanded ? null : s.id)}
          aria-expanded={isExpanded ? "true" : "false"}
        >
          <span className="co-row__bar" />
          <span className="co-logo co-logo--sm co-logo--supplier">
            {renderLogoImg(s.logo_url, s.company_name) ?? coLogo(s.company_name)}
          </span>
          <span className="co-row__meta">
            <b>
              {s.company_name}
              {s.special_listing_active && <span className="co-tag co-tag--special">Özel Liste</span>}
              {!isActive && <span className="co-tag co-tag--off">Pasif</span>}
              {responsibleIsDeleted && <span className="co-tag co-tag--warn">Yetkili Eksik</span>}
            </b>
            <i>{responsible} · {s.city ?? "—"}</i>
          </span>
          <span className="co-row__chev">{isExpanded ? "▴" : "▾"}</span>
        </button>
        <div className="co-row__inlineacts">
          <button
            type="button"
            aria-label={`Detay ${s.company_name}`}
            className="co-act-btn"
            onClick={() => openEntityModal("supplier", s.id, s.company_name, false)}
          >
            Detay
          </button>
          <button
            type="button"
            disabled={readOnly || supplierTogglingId === s.id}
            className={"co-status-btn" + (isActive ? " co-status-btn--active" : " co-status-btn--passive")}
            onClick={() => { void handleToggleSupplierActive(s); }}
          >
            {supplierTogglingId === s.id ? "…" : isActive ? "✓ Aktif" : "✗ Pasif"}
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                aria-label={`Duzenle ${s.company_name}`}
                className="co-act-btn co-act-btn--edit"
                onClick={() => openEntityModal("supplier", s.id, s.company_name, true)}
              >
                Düzenle
              </button>
              <button
                type="button"
                aria-label={`Sil ${s.company_name}`}
                className="co-act-btn co-act-btn--delete"
                disabled={isActive}
                onClick={() => { void handleDeleteSupplier(s.id); }}
              >
                Sil
              </button>
            </>
          )}
        </div>

        {isExpanded && (
          <div className="co-expand">
            {responsibleIsDeleted && (
              <div className="co-expand__warn">
                ⚠️ Bu tedarikçinin yetkili kullanıcısı silinmiş veya ayrılmış. Lütfen yeni bir yetkili kullanıcı atayın.
              </div>
            )}
            <div className="co-detail__hd">
              <span className="co-logo co-logo--lg co-logo--supplier">
                {renderLogoImg(s.logo_url, s.company_name) ?? coLogo(s.company_name)}
              </span>
              <div className="co-detail__info">
                <h3 className="co-detail__title">
                  {s.company_name}
                  {" "}
                  <span className="co-type-pill co-type-pill--supplier">Tedarikçi</span>
                  {s.special_listing_active && <span className="co-badge co-badge--special">Özel Liste</span>}
                  {!isActive && <span className="co-badge co-badge--off">Pasif</span>}
                </h3>
                <div className="co-detail__meta">
                  {(s.tenant_name ?? s.inviter_company_name) && (
                    <><span className="co-detail__tenant">{s.tenant_name ?? s.inviter_company_name}</span><span className="co-sep">·</span></>
                  )}
                  {s.city && <span>{s.city}</span>}
                </div>
              </div>
            </div>
            {supplierDetail(s)}
          </div>
        )}
      </div>
    );
  }

  function renderSupplierList() {
    const platformSups = filteredSuppliers.filter((s) => s.tenant_id === null);
    const tenantMap = new Map<number, AdminSupplierListItem[]>();
    filteredSuppliers.filter((s) => s.tenant_id !== null).forEach((s) => {
      if (!tenantMap.has(s.tenant_id!)) tenantMap.set(s.tenant_id!, []);
      tenantMap.get(s.tenant_id!)!.push(s);
    });
    return (
      <>
        {platformSups.length > 0 && (
          <div>
            <div className="co-grouphd">{`Buyera Asistans Özel Tedarikçi (${platformSups.length})`}</div>
            {platformSups.map((s) => supplierRow(s))}
          </div>
        )}
        {Array.from(tenantMap.entries()).map(([, sups]) => (
          <div key={sups[0].tenant_id!}>
            <div className="co-grouphd">{sups[0].tenant_name ?? sups[0].inviter_company_name ?? "Tedarikçi"}</div>
            {sups.map((s) => supplierRow(s))}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="cmp-tab">
      <PageHeader
        eyebrow="Yönetişim · Firma Rehberi"
        title="Firmalar"
        sub="Ekosistemdeki tüm firmalar — stratejik partnerler, tedarikçiler, iş ortakları, portal ve personel arayan firmalar; kimlik, iletişim ve izinlerle."
        actions={
          <div className="co-header-actions">
            {!readOnly && (
              <button
                type="button"
                className="co-fix-btn"
                disabled={provisioning}
                onClick={async () => {
                  if (!window.confirm("Yetkilisi olmayan tüm firmalara otomatik yetkili oluşturulsun mu? Bu işlem geri alınamaz.")) return;
                  setProvisioning(true);
                  try {
                    const result = await provisionMissingOwners();
                    setProvisionResult(result);
                    await loadData();
                  } catch {
                    setNotice({ type: "error", text: "Otomatik düzeltme başarısız." });
                  } finally {
                    setProvisioning(false);
                  }
                }}
              >
                {provisioning ? "İşleniyor…" : "⚙ Eksik Yetkilileri Düzelt"}
              </button>
            )}
            {segment !== "supplier" && (
              <button
                type="button"
                className="co-add-btn"
                disabled={readOnly}
                onClick={() => setShowNewCompanyModal(true)}
              >
                + Yeni Firma
              </button>
            )}
          </div>
        }
      />

      <div className="kpi-grid kpi-grid--3">
        <StatCard label="Aktif firma" value={companies.filter((c) => c.is_active).length} accent="blue"
          sub={`${companies.filter((c) => !c.is_active).length} pasif kayıt`} />
        <StatCard label="Tedarikçi" value={suppliers.length} accent="teal" sub="Platform tedarikçi havuzu" />
        <StatCard label="Toplam firma" value={companies.length} accent="slate" sub="Tüm segmentler dahil" />
      </div>

      {readOnly && (
        <div className="cmp-readonly-bar">
          Platform personeli firma portföyünü inceleyebilir; yeni firma ekleme, düzenleme ve silme bu yüzeyde salt okunur moda alınmıştır.
        </div>
      )}

      {notice && (
        <div className={`cmp-notice cmp-notice--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="cmp-notice__dismiss">✕</button>
        </div>
      )}

      <div className="cmp-segment-tabs">
        {segmentTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => changeSegment(tab.key)}
            className={"cmp-segment-btn" + (segment === tab.key ? " cmp-segment-btn--active" : "")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="cmp-toolbar">
        {(["all", "active", "passive"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={"cmp-filter-btn" + (statusFilter === f ? " cmp-filter-btn--active" : "")}
          >
            {f === "all" ? "Tümü" : f === "active" ? "Aktif" : "Pasif"}
          </button>
        ))}
        <div className="co-search">
          <span className="co-search__icon">⌕</span>
          <input
            className="co-search__input"
            placeholder="Firma, unvan veya şehir ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* ── Full-width list (accordion layout) ── */}
      <div className="co-list">
        <div className="co-pool__hd">
          {segment === "career" ? "Personel Arayan Firmalar" : "Firmalar"} <span>{listCount}</span>
        </div>
        <div className="co-pool__list">
          {listCount === 0 ? (
            <div className="co-state">Eşleşen firma yok.</div>
          ) : segment === "supplier" ? (
            renderSupplierList()
          ) : segment === "partner" && partnerGrouped ? (
            partnerGrouped.map((group) => {
              const primary = group.find((c) => c.is_primary) ?? group[0];
              const tenantLabel = resolveCompanyTenantLabel(primary) ?? primary.name;
              return (
                <div key={primary.tenant_id ?? primary.id}>
                  <div className="co-grouphd" style={{ "--co-color": primary.color } as CSSProperties}>
                    <span />
                    {tenantLabel}
                  </div>
                  {group.map((c) => companyRow(c))}
                </div>
              );
            })
          ) : (
            filteredCompanies.map((c) => companyRow(c))
          )}
        </div>
      </div>

      <CompanyCreateModal
        isOpen={showNewCompanyModal}
        onClose={() => setShowNewCompanyModal(false)}
        onSuccess={() => { void loadData(); setShowNewCompanyModal(false); }}
      />

      {entityModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="cmp-modal-overlay"
          onClick={() => setEntityModal(null)}
        >
          <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmp-modal__header">
              <div>
                <strong className="cmp-modal__title">
                  {entityModal.edit ? "Düzenle" : "Detay"}: {entityModal.entityName}
                </strong>
                <p className="cmp-modal__sub">
                  {entityModal.entityType === "company" ? "Firma" : "Tedarikçi"} bilgisi
                </p>
              </div>
              <button type="button" onClick={() => setEntityModal(null)} className="cmp-modal__close">
                Kapat
              </button>
            </div>
            <iframe
              title={`${entityModal.entityType}-${entityModal.entityId}-modal`}
              src={entityModal.entityType === "company"
                ? `/admin/companies/${entityModal.entityId}?embedded=1${entityModal.edit ? "&edit=true" : ""}`
                : `/admin/suppliers/${entityModal.entityId}?embedded=1${entityModal.edit ? "&edit=true" : ""}`}
            />
          </div>
        </div>
      )}

      {provisionResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="cmp-modal-overlay"
          onClick={() => setProvisionResult(null)}
        >
          <div className="cmp-modal cmp-modal--provision" onClick={(e) => e.stopPropagation()}>
            <div className="cmp-modal__header">
              <div>
                <strong className="cmp-modal__title">Eksik Yetkili Düzeltme Sonucu</strong>
                <p className="cmp-modal__sub">
                  Toplam {provisionResult.summary.total_companies} firma · {provisionResult.summary.already_ok} zaten tamam · {provisionResult.summary.created} yeni yetkili oluşturuldu · {provisionResult.summary.assigned_existing} mevcut kullanıcı atandı
                </p>
              </div>
              <button type="button" onClick={() => setProvisionResult(null)} className="cmp-modal__close">Kapat</button>
            </div>
            <div className="cmp-provision-body">
              {provisionResult.created_users.length > 0 && (
                <>
                  <h3 className="cmp-provision-title">Oluşturulan Yetkililer (şifre: <code>Aa1234!!</code>)</h3>
                  <div className="cmp-provision-warn">
                    Bu bilgileri not alın — sayfa kapatıldığında bir daha göremezsiniz.
                  </div>
                  <table className="cmp-provision-table">
                    <thead>
                      <tr>
                        <th>Firma</th>
                        <th>E-posta</th>
                        <th>Şifre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provisionResult.created_users.map((u) => (
                        <tr key={u.company_id}>
                          <td>{u.company}</td>
                          <td><code>{u.email}</code></td>
                          <td><code>{u.password}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {provisionResult.assigned_users.length > 0 && (
                <>
                  <h3 className="cmp-provision-title cmp-provision-title--secondary">Mevcut Kullanıcı Atananlar</h3>
                  <table className="cmp-provision-table">
                    <thead><tr><th>Firma</th><th>E-posta</th></tr></thead>
                    <tbody>
                      {provisionResult.assigned_users.map((u) => (
                        <tr key={u.company_id}><td>{u.company}</td><td><code>{u.email}</code></td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {provisionResult.created_users.length === 0 && provisionResult.assigned_users.length === 0 && (
                <div className="cmp-provision-ok">Tüm firmalar zaten bir yetkili kullanıcıya sahip.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
