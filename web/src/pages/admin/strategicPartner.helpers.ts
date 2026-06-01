// ============================================================================
// strategicPartner.helpers.ts
// FAZ 1 — Stratejik Partner Yönetimi için saf türetme yardımcıları (UI yok).
// Hedef konum:  web/src/pages/admin/strategicPartner.helpers.ts
//
// Prototipteki STRATEGIC_PARTNERS view-model'ini GERÇEK admin.service tiplerinden
// türetir. Hiyerarşi: companies (aynı tenant_id, is_primary). parent_id YOKTUR.
//
// ⚠️ BACKEND NOTU (köken/çift-rol tam aydınlanması için küçük ekleme):
//   AdminSupplierListItem şu an `dual_role_status` ve `linked_tenant_id` ALANLARINI
//   içermiyor (kolonlar Supplier modelinde var). Bu iki alanı admin tedarikçi listesi
//   serializer'ına eklerseniz (admin.py ~7357/7462 "source_type": s.source_type yanına
//   "dual_role_status": s.dual_role_status, "linked_tenant_id": s.linked_tenant_id),
//   `deriveOrigin`/`deriveDualRole` otomatik çalışır. Eklenene kadar bu fonksiyonlar
//   güvenle 'direct'/null döner (çökmden). Kanal kökeni için opsiyonel channelLinks verin.
// ============================================================================

import type {
  Tenant,
  Company,
  AdminSupplierListItem,
} from "../../services/admin.service";

export type PartnerOrigin = "direct" | "supplier" | "channel";
export type DualRole = "active" | "pending" | null;
export type PartnerStatus =
  | "active"
  | "trial"
  | "setup"
  | "churn-risk"
  | "past-due"
  | "paused";

/** AdminSupplierListItem + (varsa) çift-rol alanları. Backend eklerse otomatik kullanılır. */
export type PartnerSupplier = AdminSupplierListItem & {
  linked_tenant_id?: number | null;
  dual_role_status?: string | null;
};

/** Opsiyonel kanal bağlantısı: hangi tenant'ı hangi iş ortağı getirdi. */
export type ChannelLink = { tenant_id: number; organization_name: string };

export type PlanInfo = { name?: string | null; monthly_price?: number | null };

export type SubRow = {
  id: number;
  name: string;
  code: string;
  color: string;
  sector: string;
  city: string;
  users: number;
  status: PartnerStatus;
  isPrimary: boolean;
};

export type PartnerRow = {
  id: number;
  name: string;
  code: string;
  color: string;
  sector: string;
  city: string;
  contact: string;
  planCode: string;
  plan: string;
  status: PartnerStatus;
  mrr: number;
  users: number;
  health: number;
  origin: PartnerOrigin;
  originChannel?: string | null;
  dualRole: DualRole;
  subs: SubRow[];
};

export type BuildPartnerRowsInput = {
  tenants: Tenant[];
  companies: Company[];
  suppliers?: PartnerSupplier[];
  channelLinks?: ChannelLink[];
  /** plan kodu → { name, monthly_price } (subscription_plans) */
  planByCode?: Record<string, PlanInfo>;
  /** tenant_id → açık (open/pending) destek kayıt sayısı */
  openTicketsByTenant?: Record<number, number>;
  /** vade aşımı olan tenant id'leri (billing) */
  pastDueTenantIds?: ReadonlySet<number>;
  /** churn riski işaretli tenant id'leri */
  churnRiskTenantIds?: ReadonlySet<number>;
};

// ---------------------------------------------------------------------------
// Küçük yardımcılar
// ---------------------------------------------------------------------------

const PALETTE = [
  "#1d4ed8", "#0e7490", "#15803d", "#be123c", "#7c3aed",
  "#b45309", "#0891b2", "#9a1239", "#0284c7", "#34487a",
];

export function colorForId(id: number): string {
  return PALETTE[Math.abs(id) % PALETTE.length];
}

export function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter((w) => /[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(w))
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function planLabel(
  code: string | null | undefined,
  planByCode?: Record<string, PlanInfo>,
): string {
  if (!code) return "—";
  const info = planByCode?.[code];
  return info?.name ?? code;
}

// ---------------------------------------------------------------------------
// Hiyerarşi: companies → tenant gruplama
// ---------------------------------------------------------------------------

export function groupCompaniesByTenant(
  companies: Company[],
): Map<number, { primary?: Company; subs: Company[] }> {
  const map = new Map<number, { primary?: Company; subs: Company[] }>();
  for (const c of companies) {
    if (c.tenant_id == null) continue;
    let entry = map.get(c.tenant_id);
    if (!entry) {
      entry = { primary: undefined, subs: [] };
      map.set(c.tenant_id, entry);
    }
    if (c.is_primary && !entry.primary) {
      entry.primary = c;
    } else {
      entry.subs.push(c);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Köken & çift rol
// ---------------------------------------------------------------------------

export function deriveDualRole(
  tenantId: number,
  suppliers?: PartnerSupplier[],
): DualRole {
  if (!suppliers) return null;
  const linked = suppliers.find((s) => s.linked_tenant_id === tenantId);
  if (!linked || !linked.dual_role_status) return null;
  if (linked.dual_role_status === "active") return "active";
  if (linked.dual_role_status === "pending") return "pending";
  return null; // rejected vb. → rozet yok
}

export function deriveOrigin(
  tenantId: number,
  suppliers?: PartnerSupplier[],
  channelLinks?: ChannelLink[],
): { origin: PartnerOrigin; channel?: string | null } {
  // 1) Tedarikçiden geçiş (çift rol) en güçlü sinyaldir
  if (deriveDualRole(tenantId, suppliers)) {
    return { origin: "supplier" };
  }
  // 2) İş ortağı (kanal) yönlendirmesi
  const ch = channelLinks?.find((c) => c.tenant_id === tenantId);
  if (ch) return { origin: "channel", channel: ch.organization_name };
  // 3) Doğrudan
  return { origin: "direct" };
}

// ---------------------------------------------------------------------------
// Durum & sağlık
// ---------------------------------------------------------------------------

const SETUP_ONBOARDING = new Set([
  "draft", "pending", "in_setup", "in_progress", "awaiting_payment",
  "awaiting_approval", "info_requested",
]);

export function deriveStatus(
  tenant: Tenant,
  opts?: { pastDue?: boolean; churnRisk?: boolean },
): PartnerStatus {
  if (opts?.pastDue) return "past-due";
  if (opts?.churnRisk) return "churn-risk";
  if (tenant.is_active === false) return "paused";
  const s = (tenant.status || "").toLowerCase();
  const ob = (tenant.onboarding_status || "").toLowerCase();
  if (s === "trial" || ob === "trial") return "trial";
  if (s === "active" && (ob === "completed" || ob === "active" || ob === "")) {
    return "active";
  }
  if (ob && SETUP_ONBOARDING.has(ob)) return "setup";
  if (s === "active") return "active";
  return "setup";
}

export function deriveHealth(
  status: PartnerStatus,
  openTickets = 0,
): number {
  let h = 100;
  if (status === "past-due") h -= 45;
  else if (status === "churn-risk") h -= 55;
  else if (status === "paused") h -= 70;
  else if (status === "setup") h -= 18;
  else if (status === "trial") h -= 10;
  h -= Math.min(openTickets, 4) * 6;
  return Math.max(4, Math.min(100, h));
}

// ---------------------------------------------------------------------------
// Ana fonksiyon: PartnerRow[] üret
// ---------------------------------------------------------------------------

export function buildPartnerRows(input: BuildPartnerRowsInput): PartnerRow[] {
  const {
    tenants, companies, suppliers, channelLinks, planByCode,
    openTicketsByTenant, pastDueTenantIds, churnRiskTenantIds,
  } = input;

  const byTenant = groupCompaniesByTenant(companies);

  return tenants.map((t) => {
    const group = byTenant.get(t.id) ?? { primary: undefined, subs: [] };
    const primary = group.primary;
    const subsCompanies = group.subs;

    const openTickets = openTicketsByTenant?.[t.id] ?? 0;
    const status = deriveStatus(t, {
      pastDue: pastDueTenantIds?.has(t.id),
      churnRisk: churnRiskTenantIds?.has(t.id),
    });

    const { origin, channel } = deriveOrigin(t.id, suppliers, channelLinks);
    const dualRole = deriveDualRole(t.id, suppliers);

    const name = t.brand_name || t.legal_name;
    const color = primary?.color || colorForId(t.id);
    const planCode = t.subscription_plan_code ?? "";
    const mrr = planByCode?.[planCode]?.monthly_price ?? 0;

    const primaryUsers = primary?.personnel_count ?? 0;
    const subUsers = subsCompanies.reduce((a, c) => a + (c.personnel_count ?? 0), 0);

    const subs: SubRow[] = subsCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      code: initials(c.short_name || c.name),
      color: c.color || colorForId(c.id),
      sector: c.trade_name || "—",
      city: c.city || "—",
      users: c.personnel_count ?? 0,
      status: c.is_active === false ? "paused" : status,
      isPrimary: false,
    }));

    return {
      id: t.id,
      name,
      code: initials(t.legal_name || name),
      color,
      sector: primary?.trade_name || t.category || "—",
      city: t.city || primary?.city || "—",
      contact: t.owner_email || t.owner_full_name || "—",
      planCode,
      plan: planLabel(planCode, planByCode),
      status,
      mrr: typeof mrr === "number" ? mrr : 0,
      users: primaryUsers + subUsers,
      health: deriveHealth(status, openTickets),
      origin,
      originChannel: channel ?? null,
      dualRole,
      subs,
    };
  });
}
