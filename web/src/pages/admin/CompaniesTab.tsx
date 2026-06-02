import { useEffect, useMemo, useState } from "react";
import { CompanyCreateModal } from "../../components/CompanyCreateModal";
import type { AdminSupplierListItem, Company, Tenant, TenantUser } from "../../services/admin.service";
import { deleteAdminSupplier, updateAdminSupplierManagementDetail, updateCompany } from "../../services/admin.service";
import { buildTenantScopeMap, resolveCompanyScope } from "../../utils/scopeResolver";
import { PageHeader, Section, StatCard } from "./AdminTabContent";
import "./CompaniesTab.css";

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

function coLogo(name: string): string {
  return name
    .split(" ")
    .filter((w) => /[A-Za-zÇĞİÖŞÜçğışöüa-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

const SEG_META: Record<CompanySegment, { label: string; color: string }> = {
  portal:   { label: "Portal",              color: "#0891b2" },
  partner:  { label: "Stratejik Partner",   color: "#1d4ed8" },
  supplier: { label: "Tedarikçi",           color: "#be123c" },
  channel:  { label: "İş Ortağı",          color: "#047857" },
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
        return stored as CompanySegment;
      }
    }
    return "portal";
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

  const segmentCompanies = useMemo(() => {
    if (segment === "portal") return portalCompanies;
    if (segment === "partner") return partnerCompanies;
    if (segment === "channel") return channelCompanies;
    return [];
  }, [segment, portalCompanies, partnerCompanies, channelCompanies]);

  const ql = q.trim().toLowerCase();

  const filteredCompanies = useMemo(() => {
    let rows = segmentCompanies;
    if (statusFilter === "active") rows = rows.filter((c) => c.is_active);
    if (statusFilter === "passive") rows = rows.filter((c) => !c.is_active);
    if (ql) rows = rows.filter((c) =>
      (c.name + " " + (c.trade_name ?? "") + " " + (c.city ?? "") + " " + (c.short_name ?? ""))
        .toLowerCase().includes(ql),
    );
    return rows;
  }, [segmentCompanies, statusFilter, ql]);

  const filteredSuppliers = useMemo(() => {
    let rows = suppliers;
    if (statusFilter === "active") rows = rows.filter((s) => s.is_active !== false);
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
  }), [portalCompanies.length, partnerCompanies.length, suppliers.length, channelCompanies.length]);

  // Auto-select first item when selId is null
  useEffect(() => {
    if (selId !== null) return;
    if (segment === "supplier") {
      if (filteredSuppliers.length > 0) setSelId(filteredSuppliers[0].id);
    } else {
      if (filteredCompanies.length > 0) setSelId(filteredCompanies[0].id);
    }
  }, [selId, segment, filteredCompanies, filteredSuppliers]);

  const sel = segment !== "supplier"
    ? (filteredCompanies.find((c) => c.id === selId) ?? filteredCompanies[0] ?? null)
    : null;
  const selSup = segment === "supplier"
    ? (filteredSuppliers.find((s) => s.id === selId) ?? filteredSuppliers[0] ?? null)
    : null;

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
    const resolveScore = (person: TenantUser, assignment: NonNullable<TenantUser["company_assignments"]>[number]): number => {
      const sr = String(person.system_role || "").trim().toLowerCase();
      if (sr === "super_admin" || sr === "tenant_owner") return 0;
      if (sr === "tenant_admin") return 1;
      return 10 + (typeof assignment.role?.hierarchy_level === "number" ? assignment.role.hierarchy_level : 99);
    };
    [...personnel, ...channelUsers].forEach((person) => {
      if (!person.is_active) return;
      const personLabel = person.full_name || person.email || "-";
      if (isDeletedPersonValue(personLabel) || isDeletedPersonValue(person.email)) return;
      (person.company_assignments || []).forEach((assignment) => {
        if (!assignment.is_active) return;
        const score = resolveScore(person, assignment);
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

  const segmentTabs: { key: CompanySegment; label: string }[] = [
    { key: "portal",   label: `Portal Ana Firmalar (${segmentCounts.portal})` },
    { key: "partner",  label: `Stratejik Partner (${segmentCounts.partner})` },
    { key: "supplier", label: `Tedarikçi (${segmentCounts.supplier})` },
    { key: "channel",  label: `İş Ortağı (${segmentCounts.channel})` },
  ];

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

  function companyRow(c: Company) {
    const isAlt = segment === "partner" && !c.is_primary;
    return (
      <button
        key={c.id}
        type="button"
        className={"co-row" + (c.id === sel?.id ? " on" : "") + (!c.is_active ? " co-row--off" : "") + (isAlt ? " co-row--alt" : "")}
        onClick={() => setSelId(c.id)}
      >
        <span className="co-row__bar" style={{ background: c.color }} />
        {isAlt && <span className="co-row__tree">└</span>}
        <span className="co-logo co-logo--sm" style={{ background: c.color }}>
          {renderLogoImg(c.logo_url, c.name) ?? coLogo(c.name)}
        </span>
        <span className="co-row__meta">
          <b>
            {c.name}
            {c.is_platform_primary && <span className="co-tag co-tag--platform">PLATFORM</span>}
            {segment === "partner" && c.is_primary && <span className="co-tag co-tag--main">ANA</span>}
            {segment === "partner" && !c.is_primary && <span className="co-tag co-tag--alt">alt</span>}
            {!c.is_active && <span className="co-tag co-tag--off">Pasif</span>}
          </b>
          <i>{resolveCompanyTenantLabel(c) ?? resolveCompanyResponsible(c)} · {c.city ?? "—"}</i>
        </span>
        {(c.quote_count ?? 0) > 0 && (
          <span className="co-row__count">{c.quote_count} proje</span>
        )}
      </button>
    );
  }

  function supplierRow(s: AdminSupplierListItem) {
    const isActive = s.is_active !== false;
    return (
      <button
        key={s.id}
        type="button"
        className={"co-row" + (s.id === selSup?.id ? " on" : "") + (!isActive ? " co-row--off" : "")}
        onClick={() => setSelId(s.id)}
      >
        <span className="co-row__bar" style={{ background: "#be123c" }} />
        <span className="co-logo co-logo--sm" style={{ background: "#be123c" }}>
          {renderLogoImg(s.logo_url, s.company_name) ?? coLogo(s.company_name)}
        </span>
        <span className="co-row__meta">
          <b>
            {s.company_name}
            {s.special_listing_active && <span className="co-tag co-tag--special">Özel Liste</span>}
            {!isActive && <span className="co-tag co-tag--off">Pasif</span>}
          </b>
          <i>{s.tenant_name ?? s.inviter_company_name ?? "—"}</i>
        </span>
      </button>
    );
  }

  function companyDetail(c: Company) {
    const segColor = SEG_META[segment].color;
    const responsible = resolveCompanyResponsible(c);
    const relatedCompanies = segment === "partner"
      ? companies.filter((x) => x.tenant_id === c.tenant_id && x.id !== c.id)
      : [];

    return (
      <>
        <div className="co-detail__hd">
          <span className="co-logo co-logo--lg" style={{ background: c.color }}>
            {renderLogoImg(c.logo_url, c.name) ?? coLogo(c.name)}
          </span>
          <div className="co-detail__info">
            <h3 className="co-detail__title">
              {c.name}
              {" "}
              <span className="co-type-pill" style={{ background: segColor + "1f", color: segColor }}>
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
          <div className="co-detail__acts">
            <button
              type="button"
              disabled={readOnly || togglingId === c.id || !!c.is_platform_primary}
              className={"co-status-btn" + (c.is_active ? " co-status-btn--active" : " co-status-btn--passive")}
              title={c.is_platform_primary ? "Platform ana firma pasife alınamaz" : undefined}
              onClick={() => { void handleToggleCompanyActive(c); }}
            >
              {togglingId === c.id ? "…" : c.is_active ? "✓ Aktif" : "✗ Pasif"}
            </button>
            <button type="button" className="co-act-btn"
              onClick={() => openEntityModal("company", c.id, c.name, false)}>
              İncele →
            </button>
            {!readOnly && (
              <button type="button" className="co-act-btn co-act-btn--edit"
                onClick={() => openEntityModal("company", c.id, c.name, true)}>
                Düzenle
              </button>
            )}
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
              <span className="co-av" style={{ background: c.color }}>
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
                  onClick={() => setSelId(r.id)}
                >
                  <span className="co-logo co-logo--sm" style={{ background: r.color }}>
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
    const isActive = s.is_active !== false;
    const tags = s.effective_category_tags ?? s.category_tags ?? [];
    const responsible = resolveSupplierResponsible(s);

    return (
      <>
        <div className="co-detail__hd">
          <span className="co-logo co-logo--lg" style={{ background: "#be123c" }}>
            {renderLogoImg(s.logo_url, s.company_name) ?? coLogo(s.company_name)}
          </span>
          <div className="co-detail__info">
            <h3 className="co-detail__title">
              {s.company_name}
              {" "}
              <span className="co-type-pill" style={{ background: "#be123c1f", color: "#be123c" }}>
                Tedarikçi
              </span>
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
          <div className="co-detail__acts">
            <button
              type="button"
              disabled={readOnly || supplierTogglingId === s.id}
              className={"co-status-btn" + (isActive ? " co-status-btn--active" : " co-status-btn--passive")}
              onClick={() => { void handleToggleSupplierActive(s); }}
            >
              {supplierTogglingId === s.id ? "…" : isActive ? "✓ Aktif" : "✗ Pasif"}
            </button>
            <button type="button" className="co-act-btn"
              onClick={() => openEntityModal("supplier", s.id, s.company_name, false)}>
              İncele →
            </button>
            {!readOnly && (
              <button type="button" className="co-act-btn co-act-btn--edit"
                onClick={() => openEntityModal("supplier", s.id, s.company_name, true)}>
                Düzenle
              </button>
            )}
          </div>
        </div>

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
              <span className="co-av" style={{ background: "#be123c" }}>
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

  return (
    <div className="cmp-tab">
      <PageHeader
        eyebrow="Yönetişim · Firma Rehberi"
        title="Firmalar"
        sub="Ekosistemdeki tüm firmalar — stratejik partnerler, tedarikçiler, iş ortakları ve portal firmaları; kimlik, iletişim ve izinlerle."
        actions={
          segment !== "supplier" && !readOnly ? (
            <button
              type="button"
              className="co-add-btn"
              onClick={() => setShowNewCompanyModal(true)}
            >
              + Yeni Firma
            </button>
          ) : undefined
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

      <div className="co-split">
        {/* ── List pane ── */}
        <aside className="co-pool">
          <div className="co-pool__hd">
            Firmalar <span>{listCount}</span>
          </div>
          <div className="co-pool__list">
            {listCount === 0 ? (
              <div className="co-state">Eşleşen firma yok.</div>
            ) : segment === "supplier" ? (
              filteredSuppliers.map((s) => supplierRow(s))
            ) : segment === "partner" && partnerGrouped ? (
              partnerGrouped.map((group) => {
                const primary = group.find((c) => c.is_primary) ?? group[0];
                const tenantLabel = resolveCompanyTenantLabel(primary) ?? primary.name;
                return (
                  <div key={primary.tenant_id ?? primary.id}>
                    <div className="co-grouphd" style={{ color: primary.color }}>
                      <span style={{ background: primary.color }} />
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
        </aside>

        {/* ── Detail pane ── */}
        <div className="co-detail">
          {segment === "supplier" ? (
            selSup
              ? supplierDetail(selSup)
              : <div className="co-state co-state--pad">Listeden bir tedarikçi seçin.</div>
          ) : (
            sel
              ? companyDetail(sel)
              : <div className="co-state co-state--pad">Listeden bir firma seçin.</div>
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
    </div>
  );
}
