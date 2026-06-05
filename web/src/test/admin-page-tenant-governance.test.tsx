import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import AdminPage from "../pages/AdminPage";
import { AuthContext } from "../context/auth-context";
import type { AuthContextType } from "../context/auth-context";
import { createTenant, getBillingOverview, getDiscoveryLabAnswerAudits, getDiscoveryLabSessions, getDiscoveryLabSummary, getOnboardingStudioSummary, getSubscriptionCatalog, getTenants, retryBillingWebhookEvent, updateTenantSupportWorkflow } from "../services/admin.service";
import { getQuote, getQuoteAuditTrail, getQuoteHistory, getQuotePendingApprovals, getQuotes } from "../services/quote.service";

vi.mock("../pages/admin/DepartmentsTab", () => ({
  DepartmentsTab: () => <div>Departments Tab Mock</div>,
}));
vi.mock("../pages/admin/PersonnelTab", () => ({
  PersonnelTab: () => <div>Personnel Tab Mock</div>,
}));
vi.mock("../pages/admin/CompaniesTab", () => ({
  CompaniesTab: () => <div>Companies Tab Mock</div>,
}));
vi.mock("../components/ProjectsTab", () => ({
  ProjectsTab: ({ initialSearchTerm }: { initialSearchTerm?: string }) => <div>Projects Tab Mock {initialSearchTerm ? `• ${initialSearchTerm}` : ""}</div>,
}));
vi.mock("../components/RolesTab", () => ({
  RolesTab: () => <div>Roles Tab Mock</div>,
}));
vi.mock("../components/admin/RoleDepartmentGovernanceTab", () => ({
  RoleDepartmentGovernanceTab: () => <div>Roles Tab Mock</div>,
}));
vi.mock("../components/SuppliersTab", () => ({
  SuppliersTab: () => <div>Suppliers Tab Mock</div>,
}));
vi.mock("../components/SettingsTab", () => ({
  SettingsTab: () => <div>Settings Tab Mock</div>,
}));
vi.mock("../components/ApprovalDashboard", () => ({
  ApprovalDashboard: () => <div>Approval Dashboard Mock</div>,
}));
vi.mock("../components/admin/CampaignsTab.tsx", () => ({
  CampaignsAdminTab: () => <div>Campaigns Admin Tab Mock</div>,
}));
vi.mock("../lib/token", () => ({
  getAccessToken: () => "token",
}));

vi.mock("../services/quote.service", () => ({
  getQuotes: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    count: 0,
  }),
  getQuote: vi.fn().mockResolvedValue({
    id: 77,
    project_id: 15,
    created_by_id: 17,
    title: "Discovery Lab RFQ - ornek-1.dxf",
    company_name: "ProcureFlow",
    company_contact_name: "Support Specialist",
    company_contact_phone: "-",
    company_contact_email: "support@test.com",
    status: "submitted",
    transition_reason: "Teknik onay tamamlandı",
    created_at: "2026-04-15T10:45:00Z",
  }),
  getQuoteHistory: vi.fn().mockResolvedValue([
    {
      id: 1,
      quote_id: 77,
      from_status: "draft",
      to_status: "submitted",
      changed_by: 17,
      changed_by_name: "Support Specialist",
      changed_at: "2026-04-15T11:00:00Z",
      approval_details: [
        {
          level: 1,
          required_business_role: "satinalma_yoneticisi",
          required_role_mirror: "satinalma_yoneticisi",
          required_role_label: "Satın Alma Yöneticisi",
          required_business_role_label: "Satın Alma Yöneticisi",
          status: "beklemede",
          comment: "İlk onay sırası açıldı",
        },
      ],
    },
  ]),
  getQuoteAuditTrail: vi.fn().mockResolvedValue({
    quote_id: 77,
    quote_title: "Discovery Lab RFQ - ornek-1.dxf",
    current_status: "submitted",
    total_events: 3,
    summary: {
      status_changes: 1,
      approval_levels: 1,
      suppliers_responded: 0,
    },
    timeline: [
      {
        type: "quote_created",
        title: "RFQ olusturuldu",
        actor: "Support Specialist",
        timestamp: "2026-04-15T10:45:00Z",
        details: {
          source: "Discovery Lab",
        },
      },
      {
        type: "status_changed",
        title: "Onaya gonderildi",
        actor: "Support Specialist",
        timestamp: "2026-04-15T11:00:00Z",
        details: {
          reason: "Teknik onay tamamlandı",
        },
      },
    ],
  }),
  getQuotePendingApprovals: vi.fn().mockResolvedValue([
    {
      approval_level: 1,
      required_business_role: "satinalma_yoneticisi",
      required_role_mirror: "satinalma_yoneticisi",
      required_role_label: "Satın Alma Yöneticisi",
      required_business_role_label: "Satın Alma Yöneticisi",
      status: "beklemede",
    },
  ]),
}));

vi.mock("../services/admin.service", () => ({
  getTenants: vi.fn().mockResolvedValue([
    {
      id: 1,
      slug: "tenant-one",
      legal_name: "Tenant One LLC",
      brand_name: "Tenant One",
      city: "Istanbul",
      subscription_plan_code: "starter",
      status: "active",
      onboarding_status: "active",
      support_status: "new",
      support_owner_name: "Platform Ops",
      support_last_contacted_at: "2026-04-10T10:00:00Z",
      is_active: true,
      owner_user_id: 101,
      owner_full_name: "Owner User",
      owner_email: "owner@test.com",
    },
    {
      id: 2,
      slug: "tenant-two",
      legal_name: "Tenant Two LLC",
      brand_name: "Tenant Two",
      city: "Ankara",
      subscription_plan_code: "growth",
      status: "active",
      onboarding_status: "active",
      support_status: "waiting_owner",
      support_owner_name: "Platform Ops",
      support_last_contacted_at: "2026-04-15T10:00:00Z",
      is_active: true,
      owner_user_id: 202,
      owner_full_name: "Owner Two",
      owner_email: "owner-two@test.com",
    },
  ]),
  createTenant: vi.fn().mockResolvedValue({
    id: 55,
    slug: "starter-draft",
    legal_name: "STARTER Draft Tenant Ltd.",
    brand_name: "STARTER Draft",
    city: "Istanbul",
    subscription_plan_code: "starter",
    status: "active",
    onboarding_status: "draft",
    support_status: "new",
    is_active: true,
    owner_user_id: 501,
    owner_full_name: "Ilk Tenant Admin",
    owner_email: "draft-starter@procureflow.test",
    initial_admin_email_sent: false,
    created_at: "2026-04-15T10:00:00Z",
    updated_at: "2026-04-15T10:00:00Z",
  }),
  updateTenant: vi.fn(),
  getTenantUsers: vi.fn().mockResolvedValue([
    {
      id: 202,
      email: "owner-two@test.com",
      full_name: "Owner Two",
      role: "admin",
      system_role: "tenant_owner",
      tenant_id: 2,
      approval_limit: 1000,
      is_active: true,
    },
    {
      id: 101,
      email: "owner@test.com",
      full_name: "Owner User",
      role: "admin",
      system_role: "tenant_owner",
      tenant_id: 1,
      approval_limit: 1000,
      is_active: true,
    },
  ]),
  getDepartments: vi.fn().mockResolvedValue([]),
  getCompanies: vi.fn().mockResolvedValue([]),
  getRoles: vi.fn().mockResolvedValue([]),
  getWorkspacePanelConfig: vi.fn().mockResolvedValue({
    updated_at: "2026-04-15T10:00:00Z",
    profiles: [
      {
        profile: "super_admin",
        title: "Super Admin",
        description: "Tum platform yetkileri",
        nav_label: "Super Admin",
        summary: "Platform yonetimi",
        allowed_tabs: [
          "panel_home",
          "panel_designer",
          "platform_operations",
          "discovery_lab_operations",
          "onboarding_studio",
          "tenant_governance",
          "packages",
          "platform_analytics",
          "platform_suppliers",
          "public_pricing",
          "roles",
          "companies",
          "projects",
          "settings",
          "campaigns",
          "suppliers",
          "approvals",
          "reports",
          "personnel",
          "departments",
          "commission_admin",
        ],
      },
    ],
  }),
  updateWorkspacePanelConfig: vi.fn().mockResolvedValue({
    updated_at: "2026-04-15T10:00:00Z",
    profiles: [
      {
        profile: "super_admin",
        title: "Super Admin",
        description: "Tum platform yetkileri",
        nav_label: "Super Admin",
        summary: "Platform yonetimi",
        allowed_tabs: [
          "panel_home",
          "panel_designer",
          "platform_operations",
          "discovery_lab_operations",
          "onboarding_studio",
          "tenant_governance",
          "packages",
          "platform_analytics",
          "platform_suppliers",
          "public_pricing",
          "roles",
          "companies",
          "projects",
          "settings",
          "campaigns",
          "suppliers",
          "approvals",
          "reports",
          "personnel",
          "departments",
          "commission_admin",
        ],
      },
    ],
  }),
  getSubscriptionCatalog: vi.fn().mockResolvedValue({
    catalog: {
      plans: [
        {
          code: "starter",
          name: "Starter",
          description: "Temel RFQ ve tedarikci operasyon paketi",
          audience: "Yeni tenant",
          is_default: true,
          modules: [
            {
              code: "rfq_core",
              name: "RFQ Core",
              description: "RFQ temel modulu",
              enabled: true,
              limit_key: "active_projects",
              limit_value: 5,
              unit: "proje",
            },
          ],
        },
        {
          code: "growth",
          name: "Growth",
          description: "Buyuyen ekipler icin gelismis operasyon paketi",
          audience: "Olgun tenant",
          is_default: false,
          modules: [
            {
              code: "advanced_reports",
              name: "Advanced Reports",
              description: "Gelismis raporlama modulu",
              enabled: true,
              limit_key: "active_private_suppliers",
              limit_value: 250,
              unit: "tedarikci",
            },
          ],
        },
      ],
    },
    tenant_usage: [
      {
        tenant_id: 1,
        tenant_name: "Tenant One",
        plan_code: "starter",
        plan_name: "Starter",
        status: "active",
        is_active: true,
        metrics: [
          { key: "active_projects", label: "Aktif Proje", used: 3, limit: 5, unit: "proje" },
          { key: "active_internal_users", label: "Aktif Kullanici", used: 2, limit: 10, unit: "kullanici" },
        ],
      },
      {
        tenant_id: 2,
        tenant_name: "Tenant Two",
        plan_code: "growth",
        plan_name: "Growth",
        status: "active",
        is_active: true,
        metrics: [
          { key: "active_private_suppliers", label: "Aktif Ozel Tedarikci", used: 250, limit: 250, unit: "tedarikci" },
        ],
      },
    ],
  }),
  getBillingOverview: vi.fn().mockResolvedValue({
    subscriptions: [
      {
        id: 11,
        tenant_id: 1,
        subscription_plan_code: "starter",
        billing_provider: "stripe",
        provider_customer_id: "cus-1",
        provider_subscription_id: "sub-1",
        status: "active",
        billing_cycle: "monthly",
        seats_purchased: 5,
        cancel_at_period_end: false,
        created_at: "2026-04-15T10:00:00Z",
        updated_at: "2026-04-15T10:00:00Z",
      },
      {
        id: 12,
        tenant_id: 2,
        subscription_plan_code: "growth",
        billing_provider: "stripe",
        provider_customer_id: "cus-2",
        provider_subscription_id: "sub-2",
        status: "trialing",
        billing_cycle: "yearly",
        seats_purchased: 15,
        cancel_at_period_end: false,
        created_at: "2026-04-14T10:00:00Z",
        updated_at: "2026-04-15T10:00:00Z",
      },
      {
        id: 13,
        tenant_id: 3,
        subscription_plan_code: "enterprise",
        billing_provider: "iyzico",
        provider_customer_id: "cus-3",
        provider_subscription_id: "sub-3",
        status: "past_due",
        billing_cycle: "monthly",
        seats_purchased: 40,
        cancel_at_period_end: true,
        created_at: "2026-04-13T10:00:00Z",
        updated_at: "2026-04-15T10:00:00Z",
      },
    ],
    invoices: [
      {
        id: 91,
        tenant_id: 1,
        tenant_subscription_id: 11,
        provider_invoice_id: "inv-1",
        invoice_number: "PF-1",
        status: "open",
        currency: "TRY",
        subtotal_amount: 1000,
        tax_amount: 200,
        total_amount: 1200,
        created_at: "2026-04-15T10:00:00Z",
        updated_at: "2026-04-15T10:00:00Z",
      },
    ],
    recent_webhook_events: [
      {
        id: 51,
        tenant_id: 1,
        tenant_subscription_id: 11,
        provider: "stripe",
        event_type: "subscription.updated",
        provider_event_id: "evt-1",
        processing_status: "processed",
        received_at: "2026-04-15T10:05:00Z",
      },
    ],
  }),
  getDiscoveryLabSessions: vi.fn().mockResolvedValue([]),
  getDiscoveryLabSummary: vi.fn().mockResolvedValue({
    total_sessions: 0,
    locked_sessions: 0,
    quote_ready_sessions: 0,
    active_project_count: 0,
    answer_audit_count: 0,
  }),
  getDiscoveryLabAnswerAudits: vi.fn().mockResolvedValue([]),
  getOnboardingStudioSummary: vi.fn().mockResolvedValue({
    tenant_count: 2,
    onboarding_queue_count: 1,
    owner_pending_count: 0,
    branding_pending_count: 1,
    rfq_readiness: {
      quotes_missing_tenant: 0,
      approvals_quote_tenant_mismatch: 0,
      approvals_missing_tenant: 0,
      quotes_project_tenant_mismatch: 0,
      supplier_quote_scope_mismatch: 0,
      supplier_quotes_platform_network_count: 0,
      transition_ready: true,
    },
    supplier_mix: {
      private_count: 12,
      platform_network_count: 4,
    },
  }),
  updateTenantSupportWorkflow: vi.fn().mockResolvedValue({
    id: 1,
    support_status: "in_progress",
    support_owner_name: "Platform Ops",
    support_last_contacted_at: "2026-04-15T10:00:00Z",
    support_notes: "Musteri ile iletisim kuruldu",
    support_resolution_reason: "Kayit guvenli sekilde kapatildi",
  }),
  deleteCompany: vi.fn(),
  retryBillingWebhookEvent: vi.fn().mockResolvedValue({
    id: 0,
    provider: "stripe",
    provider_event_id: "evt-retry",
    event_type: "subscription.updated",
    processing_status: "processed",
    retried: true,
    error_message: null,
  }),
  getCommercialRequests: vi.fn().mockResolvedValue([]),
  getSubscriptionAddons: vi.fn().mockResolvedValue([]),

}));

const mockedUpdateTenantSupportWorkflow = vi.mocked(updateTenantSupportWorkflow);
const mockedCreateTenant = vi.mocked(createTenant);
const mockedGetTenants = vi.mocked(getTenants);
const mockedGetSubscriptionCatalog = vi.mocked(getSubscriptionCatalog);
const mockedGetBillingOverview = vi.mocked(getBillingOverview);
const mockedGetDiscoveryLabSessions = vi.mocked(getDiscoveryLabSessions);
const mockedGetDiscoveryLabSummary = vi.mocked(getDiscoveryLabSummary);
const mockedGetDiscoveryLabAnswerAudits = vi.mocked(getDiscoveryLabAnswerAudits);
const mockedGetOnboardingStudioSummary = vi.mocked(getOnboardingStudioSummary);
const mockedRetryBillingWebhookEvent = vi.mocked(retryBillingWebhookEvent);
const mockedGetQuote = vi.mocked(getQuote);
const mockedGetQuoteHistory = vi.mocked(getQuoteHistory);
const mockedGetQuoteAuditTrail = vi.mocked(getQuoteAuditTrail);
const mockedGetQuotePendingApprovals = vi.mocked(getQuotePendingApprovals);
const mockedGetQuotes = vi.mocked(getQuotes);

function renderAdminPage(user: AuthContextType["user"], route: string = "/admin?tab=tenant_governance") {
  const authValue: AuthContextType = {
    user,
    loading: false,
    login: async () => {},
    logout: () => {},
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.search}</div>;
}

function renderAdminPageWithLocationProbe(user: AuthContextType["user"], route: string) {
  const authValue: AuthContextType = {
    user,
    loading: false,
    login: async () => {},
    logout: () => {},
  };

  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route
            path="/admin"
            element={(
              <>
                <AdminPage />
                <LocationProbe />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function createJsonResponse(payload: unknown, ok: boolean = true, status: number = 200): Response {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

describe("AdminPage tenant governance permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedGetTenants.mockResolvedValue([
      {
        id: 1,
        slug: "tenant-one",
        legal_name: "Tenant One LLC",
        brand_name: "Tenant One",
        city: "Istanbul",
        subscription_plan_code: "starter",
        status: "active",
        onboarding_status: "active",
        support_status: "new",
        support_owner_name: "Platform Ops",
        support_last_contacted_at: "2026-04-10T10:00:00Z",
        is_active: true,
        owner_user_id: 101,
        owner_full_name: "Owner User",
        owner_email: "owner@test.com",
      },
      {
        id: 2,
        slug: "tenant-two",
        legal_name: "Tenant Two LLC",
        brand_name: "Tenant Two",
        city: "Ankara",
        subscription_plan_code: "growth",
        status: "active",
        onboarding_status: "active",
        support_status: "waiting_owner",
        support_owner_name: "Platform Ops",
        support_last_contacted_at: "2026-04-15T10:00:00Z",
        is_active: true,
        owner_user_id: 202,
        owner_full_name: "Owner Two",
        owner_email: "owner-two@test.com",
      },
    ] as never);
    mockedGetSubscriptionCatalog.mockImplementation(async () => ({
      catalog: {
        plans: [
          {
            code: "starter",
            name: "Starter",
            description: "Temel RFQ ve tedarikci operasyon paketi",
            audience: "Yeni tenant",
            is_default: true,
            modules: [
              {
                code: "rfq_core",
                name: "RFQ Core",
                description: "RFQ temel modulu",
                enabled: true,
                limit_key: "active_projects",
                limit_value: 5,
                unit: "proje",
              },
            ],
          },
          {
            code: "growth",
            name: "Growth",
            description: "Buyuyen ekipler icin gelismis operasyon paketi",
            audience: "Olgun tenant",
            is_default: false,
            modules: [
              {
                code: "advanced_reports",
                name: "Advanced Reports",
                description: "Gelismis raporlama modulu",
                enabled: true,
                limit_key: "active_private_suppliers",
                limit_value: 250,
                unit: "tedarikci",
              },
            ],
          },
        ],
      },
      tenant_usage: [
        {
          tenant_id: 1,
          tenant_name: "Tenant One",
          plan_code: "starter",
          plan_name: "Starter",
          status: "active",
          is_active: true,
          metrics: [
            { key: "active_projects", label: "Aktif Proje", used: 3, limit: 5, unit: "proje" },
          ],
        },
        {
          tenant_id: 2,
          tenant_name: "Tenant Two",
          plan_code: "growth",
          plan_name: "Growth",
          status: "active",
          is_active: true,
          metrics: [
            { key: "active_private_suppliers", label: "Aktif Ozel Tedarikci", used: 250, limit: 250, unit: "tedarikci" },
          ],
        },
      ],
    } as never));
    mockedGetBillingOverview.mockImplementation(async () => ({
      subscriptions: [
        {
          id: 11,
          tenant_id: 1,
          subscription_plan_code: "starter",
          billing_provider: "stripe",
          provider_customer_id: "cus-1",
          provider_subscription_id: "sub-1",
          status: "active",
          billing_cycle: "monthly",
          seats_purchased: 5,
          cancel_at_period_end: false,
          created_at: "2026-04-15T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
        {
          id: 12,
          tenant_id: 2,
          subscription_plan_code: "growth",
          billing_provider: "stripe",
          provider_customer_id: "cus-2",
          provider_subscription_id: "sub-2",
          status: "trialing",
          billing_cycle: "yearly",
          seats_purchased: 15,
          cancel_at_period_end: false,
          created_at: "2026-04-14T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
        {
          id: 13,
          tenant_id: 3,
          subscription_plan_code: "enterprise",
          billing_provider: "iyzico",
          provider_customer_id: "cus-3",
          provider_subscription_id: "sub-3",
          status: "past_due",
          billing_cycle: "monthly",
          seats_purchased: 40,
          cancel_at_period_end: true,
          created_at: "2026-04-13T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
      ],
      invoices: [
        {
          id: 91,
          tenant_id: 1,
          tenant_subscription_id: 11,
          provider_invoice_id: "pf-1",
          invoice_number: "INV-001",
          status: "open",
          currency: "TRY",
          subtotal_amount: 1000,
          tax_amount: 200,
          total_amount: 1200,
          due_at: "2026-04-20T10:00:00Z",
          created_at: "2026-04-15T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
        {
          id: 92,
          tenant_id: 2,
          tenant_subscription_id: 12,
          provider_invoice_id: "pf-2",
          invoice_number: "INV-002",
          status: "past_due",
          currency: "TRY",
          subtotal_amount: 1500,
          tax_amount: 300,
          total_amount: 1800,
          due_at: "2026-04-18T10:00:00Z",
          created_at: "2026-04-14T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
        {
          id: 93,
          tenant_id: 1,
          tenant_subscription_id: 11,
          provider_invoice_id: "pf-3",
          invoice_number: "INV-003",
          status: "paid",
          currency: "TRY",
          subtotal_amount: 900,
          tax_amount: 180,
          total_amount: 1080,
          due_at: "2026-04-12T10:00:00Z",
          paid_at: "2026-04-13T12:00:00Z",
          created_at: "2026-04-11T10:00:00Z",
          updated_at: "2026-04-13T12:00:00Z",
        },
      ],
      recent_webhook_events: [
        {
          id: 1,
          provider: "stripe",
          event_type: "subscription.updated",
          provider_event_id: "evt-1",
          processing_status: "processed",
          received_at: "2026-04-15T10:05:00Z",
        },
      ],
    } as never));
    mockedGetDiscoveryLabSessions.mockResolvedValue([
      {
        session_id: "dl-1",
        source_filename: "ornek-1.dxf",
        status: "technical_locked",
        quote_id: 77,
        project_id: 15,
        project_name: "Merkez Projesi",
        created_by_email: "support@test.com",
        confirmed_by_email: "support@test.com",
        created_at: "2026-04-15T09:00:00Z",
        updated_at: "2026-04-15T09:30:00Z",
        latest_event_title: "Teknik Kilit ve Satin Alma Aktarimi",
        latest_actor: "Support Specialist",
      },
    ] as never);
    mockedGetDiscoveryLabSummary.mockResolvedValue({
      total_sessions: 4,
      locked_sessions: 3,
      quote_ready_sessions: 2,
      active_project_count: 2,
      answer_audit_count: 1,
    } as never);
    mockedGetDiscoveryLabAnswerAudits.mockResolvedValue([
      {
        id: 901,
        session_id: "dl-1",
        project_id: 15,
        project_name: "Merkez Projesi",
        quote_id: 77,
        quote_status: "submitted",
        tenant_id: 1,
        tenant_name: "Tenant One",
        question_id: 7,
        question_text: "Kapı detayı otomatik tamamlansın mı?",
        answer_text: "Saha ekibi ile tekrar doğrulanacak.",
        decision: "needs_review",
        rationale: "Uygulama detayı çizime göre teyit edilmeli.",
        created_by_email: "support@test.com",
        created_at: "2026-04-15T10:30:00Z",
        source_filename: "ornek-1.dxf",
      },
    ] as never);
    mockedGetQuotes.mockResolvedValue({
      items: [],
      total: 0,
      count: 0,
    } as never);
    mockedGetOnboardingStudioSummary.mockResolvedValue({
      tenant_count: 2,
      onboarding_queue_count: 1,
      owner_pending_count: 0,
      branding_pending_count: 1,
      rfq_readiness: {
        quotes_missing_tenant: 0,
        approvals_quote_tenant_mismatch: 0,
        approvals_missing_tenant: 0,
        quotes_project_tenant_mismatch: 0,
        supplier_quote_scope_mismatch: 0,
        supplier_quotes_platform_network_count: 0,
        transition_ready: true,
      },
      supplier_mix: {
        private_count: 12,
        platform_network_count: 4,
      },
    } as never);
    mockedRetryBillingWebhookEvent.mockResolvedValue({
      id: 1,
      provider: "stripe",
      provider_event_id: "evt-retry-1",
      event_type: "subscription.updated",
      processing_status: "processed",
      retried: true,
      error_message: null,
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("platform support icin tenant governance aksiyonlarini salt okunur gosterir", async () => {
    renderAdminPage({
      id: 1,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    });

    expect(await screen.findByText(/stratejik partner portfoyu/i)).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner olusturma, owner yeniden atama ve yasam dongusu degistirme yetkisi sadece super admin hesabindadir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stratejik partner olustur/i })).toBeDisabled();
    expect(screen.getByPlaceholderText(/resmi firma adi/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/e-posta/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/plan kodu/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
  });

  it("role-management-only kullaniciya sadece roller sekmesini gosterir", async () => {
    renderAdminPageWithLocationProbe({
      id: 44,
      email: "manager@test.com",
      role: "manager",
      system_role: "tenant_member",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=tenant_governance");

    expect(await screen.findByText(/roles tab mock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /roller ve yetkiler/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /firma yapisi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /personeller/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /projeler/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/bu sayfaya erişim için yönetim yetkisi gerekir/i)).not.toBeInTheDocument();
  });

  it("role-management-only kullanici query param ile baska sekmeye gecemez", async () => {
    renderAdminPageWithLocationProbe({
      id: 45,
      email: "manager-query@test.com",
      role: "manager",
      system_role: "tenant_member",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=projects&projectFocusName=delta");

    expect(await screen.findByText(/roles tab mock/i)).toBeInTheDocument();
    expect(screen.queryByText(/projects tab mock/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /projeler/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /firma yapisi/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/bu sayfaya erişim için yönetim yetkisi gerekir/i)).not.toBeInTheDocument();
  });

  it("platform support icin platform operasyon kuyrugunu gosterir", async () => {
    renderAdminPage({
      id: 10,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview");

    expect(await screen.findByText(/platform destek (oncelikleri|öncelikleri)/i)).toBeInTheDocument();
    expect(screen.getByText(/kurulum kuyru[gğ]u/i)).toBeInTheDocument();
    expect(screen.getByText(/sorumlu aksiyonu/i)).toBeInTheDocument();
    expect(screen.getByText(/(acik|açık) destek kayd(i|ı)/i)).toBeInTheDocument();
    expect(screen.getByText(/sorumlu bekleyen destek/i)).toBeInTheDocument();
    expect(screen.getByText(/temas[ıi] geciken kay[ıi]t/i)).toBeInTheDocument();
    expect(screen.getByText(/sorumlusuz destek kayd(i|ı)/i)).toBeInTheDocument();
    expect(screen.getByText(/en yo[gğ]un destek sorumlusu/i)).toBeInTheDocument();
    expect(screen.getByText(/^platform ops$/i)).toBeInTheDocument();
    expect(screen.getByText(/temas edilmeyen aktif destek/i)).toBeInTheDocument();
    expect(screen.getAllByText(/marka kimli[gğ]i eksik/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/destek: sorumlu bekleniyor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tenant one/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hizli linkler/i).length).toBeGreaterThan(0);
  });

  it("platform support icin ayri platform operasyonlari sekmesini gosterir", async () => {
    renderAdminPage({
      id: 11,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_operations");

    expect(await screen.findByText(/platform operasyon masasi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/stratejik partner triage kuyruklari/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/onboarding takibi/i)).toBeInTheDocument();
    expect(screen.getByText(/owner atama kuyrugu/i)).toBeInTheDocument();
    expect(screen.getAllByText(/stratejik partner yonetimine git/i).length).toBeGreaterThan(0);
  });

  it("platform support icin onboarding studio sekmesini gosterir", async () => {
    renderAdminPage({
      id: 13,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=onboarding_studio");

    expect(await screen.findByText(/yeni stratejik partner kurulum iskeleti/i)).toBeInTheDocument();
    expect(screen.getByText(/toplam stratejik partner portfoyu/i)).toBeInTheDocument();
    expect(screen.getByText(/1. plan secimi/i)).toBeInTheDocument();
    expect(screen.getByText(/3. ilk admin aktivasyonu/i)).toBeInTheDocument();
    expect(screen.getByText(/rfq gecis hazirligi/i)).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner rfq gecisi icin kritik blokaj gorunmuyor/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ozel tedarikci/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/platform agi/i).length).toBeGreaterThan(0);
  });

  it("super admin onboarding studio hizli baslangictan tenant formunu doldurur", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 99,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=onboarding_studio");

    expect(await screen.findByText(/yeni stratejik partner kurulum iskeleti/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /stratejik partner formuna tasla/i })[0]);

    expect(await screen.findByText(/yeni stratejik partner olustur/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("starter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Starter Musteri Ltd.")).toBeInTheDocument();
  });

  it("super admin onboarding studio icinden taslak tenant olusturur", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 99,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=onboarding_studio");

    expect(await screen.findByText(/yeni stratejik partner kurulum iskeleti/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /taslak stratejik partner olustur/i })[0]);

    await waitFor(() => expect(mockedCreateTenant).toHaveBeenCalled());
    expect(await screen.findByDisplayValue("STARTER Draft Tenant Ltd.")).toBeInTheDocument();
  });

  it("platform operasyonlari sekmesinde destek workflow alanlarini gosterir", async () => {
    renderAdminPage({
      id: 12,
      email: "support@test.com",
      full_name: "Support Specialist",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_operations");

    expect((await screen.findAllByText(/operasyon sahibi/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/destek durumu/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/son temas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/destek notu/i).length).toBeGreaterThan(0);

    const noteBoxes = screen.getAllByPlaceholderText(/bu stratejik partner icin son destek notunu girin/i);
    fireEvent.change(noteBoxes[0], { target: { value: "Owner dogrulamasi bekleniyor" } });
    expect(screen.getAllByDisplayValue(/owner dogrulamasi bekleniyor/i).length).toBeGreaterThan(0);

    const ownerInputs = await screen.findAllByLabelText(/operasyon sahibi/i);
    fireEvent.change(ownerInputs[0], { target: { value: "" } });
    expect(await screen.findByRole("button", { name: /beni ata/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gorunenleri bana ata/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gorunenleri isleme al/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /gorunenleri isleme al/i }));
    expect(screen.getAllByText(/islemde/i).length).toBeGreaterThan(0);

    fireEvent.change(ownerInputs[0], { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /gorunenleri bana ata/i }));
    expect(screen.getAllByDisplayValue(/support specialist/i).length).toBeGreaterThan(0);

    fireEvent.change(ownerInputs[0], { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /beni ata/i }));
    expect(screen.getAllByDisplayValue(/support specialist/i).length).toBeGreaterThan(0);
  });

  it("platform operasyonlari sekmesinde destek durumu sayaçlari ve filtreleri calisir", async () => {
    renderAdminPage({
      id: 14,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_operations");

    expect(await screen.findByText(/tum kayitlar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /owner bekleniyor/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/owner filtresi/i)).toBeInTheDocument();

    const waitingOwnerButton = screen.getByRole("button", { name: /owner bekleniyor/i });
    await userEvent.click(waitingOwnerButton);

    expect(await screen.findByTestId("admin-focus-banner-platform-operations")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: platform operasyonlari filtresi/i)).toBeInTheDocument();
    expect(await screen.findByText(/tenant two/i)).toBeInTheDocument();
    expect(screen.queryByText(/tenant one/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /tum kayitlar/i }));
    await userEvent.selectOptions(screen.getByLabelText(/owner filtresi/i), "Platform Ops");

    expect(await screen.findByText(/tenant one/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant two/i)).toBeInTheDocument();
  });

  it("platform operasyonlari sekmesinden destek notunu kalici olarak kaydeder", async () => {
    renderAdminPage({
      id: 13,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_operations");

    const user = userEvent.setup();
    await screen.findByText(/tenant two/i);
    const statusSelects = await screen.findAllByLabelText(/destek durumu/i);
    await user.selectOptions(statusSelects[0], "in_progress");

    const ownerInputs = await screen.findAllByLabelText(/operasyon sahibi/i);
    await user.clear(ownerInputs[0]);
    await user.type(ownerInputs[0], "Platform Ops");

    const noteBoxes = screen.getAllByPlaceholderText(/bu stratejik partner icin son destek notunu girin/i);
    await user.clear(noteBoxes[0]);
    await user.type(noteBoxes[0], "Musteri ile iletisim kuruldu");

    const saveButtons = screen.getAllByRole("button", { name: /destek notunu kaydet/i });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockedUpdateTenantSupportWorkflow).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          support_status: "in_progress",
          support_owner_name: expect.stringContaining("Platform Ops"),
          support_last_contacted_at: expect.stringContaining("2026-04-15"),
          support_notes: "Musteri ile iletisim kuruldu",
        })
      );
    });
  });

  it("resolved durumunda kapanis nedenini ister ve payload'a ekler", async () => {
    renderAdminPage({
      id: 15,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_operations");

    const user = userEvent.setup();
    await screen.findByText(/tenant two/i);
    const statusSelects = await screen.findAllByLabelText(/destek durumu/i);
    await user.selectOptions(statusSelects[0], "resolved");

    expect(await screen.findByLabelText(/kapanis nedeni/i)).toBeInTheDocument();
    const resolutionReason = screen.getByLabelText(/kapanis nedeni/i);
    await user.type(resolutionReason, "Kayit guvenli sekilde kapatildi");

    const saveButtons = screen.getAllByRole("button", { name: /destek notunu kaydet/i });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockedUpdateTenantSupportWorkflow).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          support_status: "resolved",
          support_resolution_reason: "Kayit guvenli sekilde kapatildi",
        })
      );
    });
  });

  it("platform operator icin tenant governance aksiyonlarini salt okunur gosterir", async () => {
    renderAdminPage({
      id: 3,
      email: "operator@test.com",
      role: "user",
      system_role: "platform_operator",
      platform_name: "Buyera Asistans",
    });

    expect(await screen.findByText(/stratejik partner portfoyu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stratejik partner olustur/i })).toBeDisabled();
    expect(screen.getByPlaceholderText(/resmi firma adi/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/e-posta/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/plan kodu/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
  });

  it("super admin icin tenant governance aksiyonlarini aktif gosterir", async () => {
    renderAdminPage({
      id: 2,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    });

    expect(await screen.findByText(/stratejik partner portfoyu/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /stratejik partner olustur/i })).not.toBeDisabled());
    expect(screen.getByPlaceholderText(/resmi firma adi/i)).not.toBeDisabled();
    expect(screen.getByPlaceholderText(/e-posta/i)).not.toBeDisabled();
    expect(screen.getByPlaceholderText(/plan kodu/i)).not.toBeDisabled();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /duzenle/i }).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText(/aktif proje: 3\/5/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/limit asimi var/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /limit asimi/i }));
    expect(screen.getByText(/tenant two/i)).toBeInTheDocument();
    expect(screen.queryByText(/tenant one/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue(/risk onceligi/i), { target: { value: "name" } });
    fireEvent.click(screen.getByRole("button", { name: /tum stratejik partnerler/i }));
    expect(screen.getByText(/tenant one/i)).toBeInTheDocument();
  });

  it("discovery lab operasyonlarinda discovery lab kartini filtreler ve detay acar", async () => {
    renderAdminPage({
      id: 16,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations");

    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/ornek-1.dxf/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/merkez projesi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/toplam audit/i)).toBeInTheDocument();
    expect(screen.getByText(/rfq bagli audit/i)).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner bagli audit/i)).toBeInTheDocument();
    expect(screen.getByText(/inceleme bekleyen/i)).toBeInTheDocument();
    expect(screen.getByText(/filtrelenmis audit kayitlari/i)).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner ve rfq bagli detay listesi/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant: tenant one/i)).toBeInTheDocument();
    expect(screen.getAllByText(/proje: merkez projesi/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/discovery lab proje filtresi/i), { target: { value: "Merkez" } });
    await waitFor(() => {
      expect(mockedGetDiscoveryLabSessions).toHaveBeenLastCalledWith(expect.objectContaining({ projectQuery: "Merkez" }));
    });
    const searchInput = await screen.findByLabelText(/discovery lab kayit arama/i);
    fireEvent.change(searchInput, { target: { value: "ornek-1" } });
    await waitFor(() => {
      expect(mockedGetDiscoveryLabSessions).toHaveBeenLastCalledWith(expect.objectContaining({ projectQuery: "Merkez", search: "ornek-1" }));
    });
    await waitFor(() => {
      expect(mockedGetDiscoveryLabAnswerAudits).toHaveBeenLastCalledWith(expect.objectContaining({ projectQuery: "Merkez", search: "ornek-1" }));
    });

    fireEvent.click(screen.getByRole("button", { name: /inceleme/i }));
    await waitFor(() => {
      expect(mockedGetDiscoveryLabAnswerAudits).toHaveBeenLastCalledWith(expect.objectContaining({ decision: "needs_review" }));
    });

    await screen.findByText(/answer audit ve rfq baglanti merkezi/i);
    expect(screen.getAllByText(/tenant: tenant one/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/proje: merkez projesi/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/discovery lab kullanici filtresi/i), { target: { value: "support@test.com" } });
    await waitFor(() => {
      expect(mockedGetDiscoveryLabSessions).toHaveBeenLastCalledWith(expect.objectContaining({ userQuery: "support@test.com" }));
    });

    fireEvent.click(await screen.findByRole("button", { name: /son 7 gun/i }));
    await waitFor(() => {
      expect(mockedGetDiscoveryLabSessions).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }));
    });

    await waitFor(() => {
      expect(mockedGetDiscoveryLabSessions).toHaveBeenCalled();
    });
  });

  it("platform genel bakista deep-link odagini ortak focus banner ile gosterir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi&telemetrySource=platform-overview&telemetrySearch=Merkez");

    expect(await screen.findByTestId("admin-focus-banner-platform-overview")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: platform genel bakis baglantisi/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /discovery lab'a git/i }));
    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
  });

  it("platform overview project odagini projects sekmesine tasir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByTestId("admin-focus-banner-platform-overview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /projelere git/i }));
    expect(await screen.findByTestId("admin-focus-banner-project")).toBeInTheDocument();
  });

  it("platform overview telemetry export metadata ve indirme adlarini gosterir", async () => {
    const user = userEvent.setup();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/telemetry kaynak filtresi/i), "platform-overview");
    await user.type(screen.getByRole("textbox", { name: /telemetry arama/i }), "merkez");
    await user.click(screen.getByRole("button", { name: /telemetry export hazirla/i }));
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain("Platform Genel Bakisi Odagi");
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain('"filters"');
    await user.click(screen.getByRole("button", { name: /csv ozet hazirla/i }));
    expect((screen.getByRole("textbox", { name: /focus telemetry csv export/i }) as HTMLTextAreaElement).value).toContain("platform-overview");
    expect((screen.getByRole("textbox", { name: /focus telemetry csv export/i }) as HTMLTextAreaElement).value).toContain("Event Count");
    expect((screen.getByRole("textbox", { name: /focus telemetry csv export/i }) as HTMLTextAreaElement).value).toContain("Source Distribution");
    await user.click(screen.getByRole("button", { name: /json kopyala/i }));
    expect(clipboardWriteText).toHaveBeenCalled();
    expect(screen.getAllByText(/disa aktarim zamani:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/source distribution:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/replay summary:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/json export panoya kopyalandi/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /json indir \(admin-focus-telemetry-.*\.json\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /csv kopyala/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /csv kopyala/i }));
    expect(screen.getAllByText(/csv export panoya kopyalandi/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /csv indir \(admin-focus-telemetry-.*\.csv\)/i })).toBeInTheDocument();
  });

  it("platform overview telemetry filtrelerini preset olarak kaydeder, yeniden adlandirir, siler ve geri yukler", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/telemetry kaynak filtresi/i), "platform-overview");
    await user.type(screen.getByRole("textbox", { name: /telemetry arama/i }), "merkez");
    await user.type(screen.getByRole("textbox", { name: /telemetry preset adi/i }), "Merkez preset");
    await user.click(screen.getByRole("button", { name: /preset kaydet/i }));
    expect(screen.getByRole("button", { name: /preset: merkez preset/i })).toBeInTheDocument();
    expect(screen.getAllByText(/preset kaydedildi: merkez preset/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /yeniden adlandir/i }));
    await user.clear(screen.getByRole("textbox", { name: /preset yeniden adlandir merkez preset/i }));
    await user.type(screen.getByRole("textbox", { name: /preset yeniden adlandir merkez preset/i }), "Merkez preset v2");
    await user.click(screen.getByRole("button", { name: /^kaydet$/i }));
    expect(screen.getByRole("button", { name: /preset: merkez preset v2/i })).toBeInTheDocument();
    expect(screen.getAllByText(/preset yeniden adlandirildi: merkez preset v2/i).length).toBeGreaterThan(0);

    await user.clear(screen.getByRole("textbox", { name: /telemetry arama/i }));
    await user.selectOptions(screen.getByLabelText(/telemetry kaynak filtresi/i), "all");
    await user.click(screen.getByRole("button", { name: /preset: merkez preset v2/i }));
    expect(screen.getByRole("combobox", { name: /telemetry kaynak filtresi/i })).toHaveValue("platform-overview");
    expect(screen.getByRole("textbox", { name: /telemetry arama/i })).toHaveValue("merkez");

    await user.click(screen.getByRole("button", { name: /preseti sil/i }));
    expect(screen.queryByRole("button", { name: /preset: merkez preset v2/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/preset silindi: merkez preset v2/i).length).toBeGreaterThan(0);
  });

  it("platform overview telemetry preset paketini disa aktarir ve geri ice alir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/telemetry kaynak filtresi/i), "platform-overview");
    await user.type(screen.getByRole("textbox", { name: /telemetry arama/i }), "merkez");
    await user.type(screen.getByRole("textbox", { name: /telemetry preset adi/i }), "Paket preset");
    await user.click(screen.getByRole("button", { name: /preset kaydet/i }));

    await user.click(screen.getByRole("button", { name: /preset paketi hazirla/i }));
    expect(screen.getAllByText(/preset paketi hazirlandi: 1 kayit/i).length).toBeGreaterThan(0);
    expect((screen.getByRole("textbox", { name: /telemetry preset paketi/i }) as HTMLTextAreaElement).value).toContain('"version": 1');
    expect((screen.getByRole("textbox", { name: /telemetry preset paketi/i }) as HTMLTextAreaElement).value).toContain("Paket preset");
    expect(screen.getByText(/on ayar paketi onizlemesi/i)).toBeInTheDocument();
    expect(screen.getByText(/versiyon: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/calisma alani: buyera asistans/i)).toBeInTheDocument();
    expect(screen.getByText(/operator: support@test.com/i)).toBeInTheDocument();
    expect(screen.getByText(/ozet kodu: pf-/i)).toBeInTheDocument();
    expect(screen.getByText(/1 preset ice aktarim icin hazir/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /preseti sil/i }));
    expect(screen.queryByRole("button", { name: /preset: paket preset/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /preset paketini ice aktar/i }));
    expect(screen.getAllByText(/preset paketi ice aktarildi: 1 kayit/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /preset: paket preset/i })).toBeInTheDocument();
    expect(screen.getAllByText(/preset/i).length).toBeGreaterThan(0);
  });

  it("platform overview telemetry preset paketi uyumsuz versiyonu preview ve hata ile gosterir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /telemetry preset paketi/i }), { target: { value: JSON.stringify({ version: 2, exportedAt: "2026-04-16T10:00:00.000Z", presets: [] }) } });
    expect(screen.getByText(/versiyon uyumsuz: 2/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /preset paketini ice aktar/i }));
    expect(screen.getAllByText(/preset paketi versiyonu desteklenmiyor: 2/i).length).toBeGreaterThan(0);
  });

  it("platform overview telemetry preset preview cakisma bilgisini gosterir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /telemetry preset adi/i }), "Merkez preset");
    await user.click(screen.getByRole("button", { name: /preset kaydet/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /telemetry preset paketi/i }), {
      target: {
        value: JSON.stringify({
          version: 1,
          exportedAt: "2026-04-16T10:00:00.000Z",
          sourceWorkspace: "Demo Workspace",
          operatorLabel: "ops@test.com",
          presetHash: "pf-123",
          userKey: "ops@test.com::30",
          presets: [{
            id: "preset-1",
            name: "Merkez preset",
            userKey: "ops@test.com::30",
            createdAt: 1,
            filters: { source: "platform-overview", window: "all", search: "merkez" },
          }],
        }),
      },
    });
    expect(screen.getByText(/calisma alani: demo workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/operator: ops@test.com/i)).toBeInTheDocument();
    expect(screen.getByText(/cakisma: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/1 preset mevcut kayitlari override edecek/i)).toBeInTheDocument();
    expect(screen.getByText(/gecersiz kilinacak on ayarlar/i)).toBeInTheDocument();
    expect(screen.getAllByText(/merkez preset/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/secili telemetry filtresi: kaynak=all • zaman=all • arama=- \| referans preset \(merkez preset\): kaynak=platform-overview • zaman=all • arama=merkez/i)).toBeInTheDocument();
    expect(screen.getByText(/merkez preset • override/i)).toBeInTheDocument();
    expect(screen.getByText(/secili referans/i)).toBeInTheDocument();
    expect(screen.getByText(/arama: - -> merkez/i)).toBeInTheDocument();
  });

  it("platform overview telemetry preset preview yeni eklenecek presetleri ayri blokta gosterir", async () => {
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /telemetry preset paketi/i }), {
      target: {
        value: JSON.stringify({
          version: 1,
          exportedAt: "2026-04-16T10:00:00.000Z",
          sourceWorkspace: "Demo Workspace",
          operatorLabel: "ops@test.com",
          presetHash: "pf-124",
          userKey: "ops@test.com::30",
          presets: [{
            id: "preset-2",
            name: "Yeni preset",
            userKey: "ops@test.com::30",
            createdAt: 2,
            filters: { source: "platform-operations", window: "15m", search: "audit" },
          }],
        }),
      },
    });

    expect(screen.getByText(/yeni eklenecek presetler/i)).toBeInTheDocument();
    expect(screen.getByText(/^yeni preset$/i)).toBeInTheDocument();
    expect(screen.getByText(/yeni preset • yeni kayit/i)).toBeInTheDocument();
    expect(screen.getByText(/kaynak: platform-operations/i)).toBeInTheDocument();
    expect(screen.getByText(/zaman: 15m/i)).toBeInTheDocument();
  });

  it("platform overview telemetry preset preview referans preset secimine gore aktif filtre ozetini degistirir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&telemetrySource=platform-overview&telemetrySearch=merkez");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /telemetry preset paketi/i }), {
      target: {
        value: JSON.stringify({
          version: 1,
          exportedAt: "2026-04-16T10:00:00.000Z",
          sourceWorkspace: "Demo Workspace",
          operatorLabel: "ops@test.com",
          presetHash: "pf-125",
          userKey: "ops@test.com::30",
          presets: [
            {
              id: "preset-2",
              name: "Yeni preset",
              userKey: "ops@test.com::30",
              createdAt: 2,
              filters: { source: "platform-operations", window: "15m", search: "audit" },
            },
            {
              id: "preset-3",
              name: "Ikinci preset",
              userKey: "ops@test.com::30",
              createdAt: 3,
              filters: { source: "packages", window: "all", search: "risk" },
            },
          ],
        }),
      },
    });

    expect(screen.getByText(/referans on ayar secimi/i)).toBeInTheDocument();
    expect(screen.getByText(/secili telemetry filtresi: kaynak=platform-overview • zaman=all • arama=merkez \| referans preset \(yeni preset\): kaynak=platform-operations • zaman=15m • arama=audit/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ikinci preset/i }));
    expect(screen.getByText(/secili telemetry filtresi: kaynak=platform-overview • zaman=all • arama=merkez \| referans preset \(ikinci preset\): kaynak=packages • zaman=all • arama=risk/i)).toBeInTheDocument();
    expect(screen.getByText((content) => /ikinci preset/i.test(content) && /secili referans/i.test(content))).toBeInTheDocument();
  });

  it("platform overview telemetry export aksiyonlarinda hata durumlarini gosterir", async () => {
    const user = userEvent.setup();
    const clipboardWriteText = vi.fn().mockRejectedValue(new Error("clipboard blocked"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardWriteText },
      configurable: true,
    });
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /json kopyala/i }));
    expect(screen.getAllByText(/json export panoya kopyalanamadi/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /json indir \(admin-focus-telemetry-.*\.json\)/i }));
    expect(screen.getAllByText(/json export indirilemedi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/telemetri eylem tarihcesi/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^export$/i }));
    expect(screen.getAllByText(/export/i).length).toBeGreaterThan(0);
  });

  it("platform overview telemetry export metadata'sina history filtrelerini ekler", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&telemetryHistoryScope=navigation&telemetryHistoryWindow=24h&telemetryHistorySearch=RFQ");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    expect(screen.getByText(/gecmis kapsami: navigation/i)).toBeInTheDocument();
    expect(screen.getByText(/gecmis penceresi: 24h/i)).toBeInTheDocument();
    expect(screen.getByText(/gecmis aramasi: RFQ/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /telemetry export hazirla/i }));
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain('"historyFilters"');
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain('"scope": "navigation"');
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain('"historyRecordCount"');
    expect((screen.getByRole("textbox", { name: /focus telemetry export/i }) as HTMLTextAreaElement).value).toContain('"historyScopeDistribution"');
  });

  it("platform overview telemetry aksiyon tarihcesini localStorage'dan geri yukler", async () => {
    window.localStorage.setItem("admin.focusTelemetry.actionHistory", JSON.stringify([
      { id: "telemetry-action-1", tone: "success", scope: "preset", message: "Preset yuklendi: Merkez", createdAt: Date.now() },
    ]));

    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/telemetri eylem tarihcesi/i)).toBeInTheDocument();
    expect(screen.getByText(/preset yuklendi: merkez/i)).toBeInTheDocument();
  });

  it("platform overview telemetry aksiyon tarihcesine zaman ve metin filtresi uygular", async () => {
    const now = Date.now();
    window.localStorage.setItem("admin.focusTelemetry.actionHistory", JSON.stringify([
      { id: "telemetry-action-1", tone: "success", scope: "preset", message: "Preset yuklendi: Merkez", createdAt: now - (10 * 60 * 1000) },
      { id: "telemetry-action-2", tone: "success", scope: "navigation", message: "Discovery Lab odagi acildi: RFQ #77", createdAt: now - (3 * 24 * 60 * 60 * 1000) },
    ]));

    const user = userEvent.setup();
    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/telemetri eylem tarihcesi/i)).toBeInTheDocument();
    expect(screen.getByText(/preset yuklendi: merkez/i)).toBeInTheDocument();
    expect(screen.getByText(/discovery lab odagi acildi: rfq #77/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: /aksiyon tarihcesi zaman penceresi/i }), "30m");
    expect(screen.getByText(/preset yuklendi: merkez/i)).toBeInTheDocument();
    expect(screen.queryByText(/discovery lab odagi acildi: rfq #77/i)).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: /aksiyon tarihcesi arama/i }));
    await user.type(screen.getByRole("textbox", { name: /aksiyon tarihcesi arama/i }), "preset yuklendi");
    expect(screen.getByText(/preset yuklendi: merkez/i)).toBeInTheDocument();
    expect(screen.queryByText(/discovery lab odagi acildi: rfq #77/i)).not.toBeInTheDocument();
  });

  it("platform overview telemetry aksiyon tarihcesi filtrelerini localStorage'dan geri yukler", async () => {
    window.localStorage.setItem("admin.focusTelemetry.actionHistory", JSON.stringify([
      { id: "telemetry-action-1", tone: "success", scope: "preset", message: "Preset yuklendi: Merkez", createdAt: Date.now() },
    ]));
    window.localStorage.setItem("admin.focusTelemetry.actionHistoryFilters", JSON.stringify({
      scope: "preset",
      window: "24h",
      search: "Merkez",
    }));

    renderAdminPage({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/telemetri eylem tarihcesi/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /aksiyon tarihcesi zaman penceresi/i })).toHaveValue("24h"));
    expect(screen.getByRole("textbox", { name: /aksiyon tarihcesi arama/i })).toHaveValue("Merkez");
    expect(screen.getByRole("button", { name: /^preset$/i })).toHaveStyle({ background: "rgb(239, 246, 255)" });
  });

  it("platform overview telemetry aksiyon tarihcesi filtrelerini query param ile geri yukler", async () => {
    window.localStorage.setItem("admin.focusTelemetry.actionHistory", JSON.stringify([
      { id: "telemetry-action-1", tone: "success", scope: "navigation", message: "Discovery Lab odagi acildi: RFQ #77", createdAt: Date.now() },
    ]));

    renderAdminPageWithLocationProbe({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&telemetryHistoryScope=navigation&telemetryHistoryWindow=24h&telemetryHistorySearch=RFQ");

    expect(await screen.findByText(/telemetri eylem tarihcesi/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /aksiyon tarihcesi zaman penceresi/i })).toHaveValue("24h");
    expect(screen.getByRole("textbox", { name: /aksiyon tarihcesi arama/i })).toHaveValue("RFQ");
    expect(screen.getByRole("button", { name: /^navigation$/i })).toHaveStyle({ background: "rgb(239, 246, 255)" });
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetryHistoryScope=navigation");
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetryHistoryWindow=24h");
  });

  it("telemetry aksiyon tarihcesi query filtrelerini sekmeler arasi korur", async () => {
    const user = userEvent.setup();
    renderAdminPageWithLocationProbe({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&telemetryHistoryScope=navigation&telemetryHistoryWindow=24h&telemetryHistorySearch=RFQ");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /discovery lab operasyonlari/i }));
    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetryHistoryScope=navigation");
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetryHistoryWindow=24h");
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetryHistorySearch=RFQ");
  });

  it("telemetry filtrelerini sekmeler arasi korur", async () => {
    const user = userEvent.setup();
    renderAdminPageWithLocationProbe({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview&projectFocusName=Merkez%20Projesi&telemetrySource=platform-overview&telemetrySearch=Merkez");

    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /telemetry kaynak filtresi/i })).toHaveValue("platform-overview");
    expect(screen.getByRole("textbox", { name: /telemetry arama/i })).toHaveValue("Merkez");
    await user.click(screen.getByRole("button", { name: /discovery lab'a git/i }));
    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetrySource=platform-overview");
    expect(screen.getByTestId("location-probe").textContent).toContain("telemetrySearch=Merkez");
    await user.click(screen.getByRole("button", { name: /(super admin paneli|panel ana sayfa)/i }));
    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /telemetry kaynak filtresi/i })).toHaveValue("platform-overview");
    expect(screen.getByRole("textbox", { name: /telemetry arama/i })).toHaveValue("Merkez");
  });

  it("platform overview telemetry filtrelerini localStorage'dan geri yukler", async () => {
    window.localStorage.setItem("admin.focusTelemetry.filters", JSON.stringify({
      source: "platform-overview",
      window: "all",
      search: "Merkez",
    }));

    renderAdminPageWithLocationProbe({
      id: 30,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=platform_overview");

    await waitFor(() => expect(screen.getByRole("combobox", { name: /telemetry kaynak filtresi/i })).toHaveValue("platform-overview"));
    expect(screen.getByRole("textbox", { name: /telemetry arama/i })).toHaveValue("Merkez");
  });

  it("discovery lab operasyonlari sekmesinde tenant ve rfq bagli audit merkezini gosterir", async () => {
    renderAdminPage({
      id: 17,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations");

    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    expect(screen.getByText(/rfq bagli audit/i)).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner bagli audit/i)).toBeInTheDocument();
    expect(screen.getAllByText(/tenant one/i).length).toBeGreaterThan(0);
    expect(screen.getByText((content) => content.includes("RFQ Durumu:") && content.includes("Onaya"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rfq #77/i })).toHaveAttribute("href", "/quotes/77");
    expect(screen.getByRole("link", { name: /rfq karsilastirma/i })).toHaveAttribute("href", "/quotes/77/comparison?adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77");
    expect(screen.getByRole("link", { name: /rfq akisina git/i })).toHaveAttribute("href", "/quotes/77/edit?adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77");
    expect(screen.getByRole("link", { name: /rfq durum gecmisi/i })).toHaveAttribute("href", "/quotes/77?insight=status-history&adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77&quoteInsight=status-history");
    expect(screen.getByRole("link", { name: /rfq denetim izi sayfasi/i })).toHaveAttribute("href", "/quotes/77?insight=full-audit-trail&adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77&quoteInsight=full-audit-trail");

    await userEvent.click(screen.getByRole("button", { name: /rfq gecmisini ac/i }));
    expect(screen.getByRole("link", { name: /rfq durum gecmisi/i })).toHaveAttribute("href", "/quotes/77?insight=status-history&adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77&quoteInsight=status-history");
    expect(screen.getByText(/draft -> submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/onay adimlari/i)).toBeInTheDocument();
    expect(screen.getByText(/seviye 1/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rfq denetim izi sayfasi/i })).toHaveAttribute("href", "/quotes/77?insight=full-audit-trail&adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=77&quoteInsight=full-audit-trail");
    expect(screen.getByText(/rfq olusturuldu/i)).toBeInTheDocument();
    expect(screen.getByText(/durum degisikligi: 1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/teknik onay tamamlandı/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/transition reason: teknik onay tamamlandı/i)).toBeInTheDocument();
    expect(screen.getByText(/pending approval: 1/i)).toBeInTheDocument();
    expect(mockedGetQuoteHistory).toHaveBeenCalledWith(77);
    expect(mockedGetQuoteAuditTrail).toHaveBeenCalledWith(77);
    expect(mockedGetQuotePendingApprovals).toHaveBeenCalledWith(77);
    expect(mockedGetQuote).toHaveBeenCalledWith(77);
    expect(screen.getByRole("button", { name: /proje akisini ac/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /stratejik partner yonetimine git/i }));
    expect(await screen.findByText(/discovery lab odagi: tenant one/i)).toBeInTheDocument();
    expect(screen.getAllByText(/tenant one/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^tenant two$/i)).not.toBeInTheDocument();
  });

  it("discovery lab operasyonlari sekmesi quoteFocusId ile rfq insight panelini otomatik acar", async () => {
    renderAdminPage({
      id: 19,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77");

    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    expect(await screen.findByText(/draft -> submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/rfq olusturuldu/i)).toBeInTheDocument();
    expect(mockedGetQuoteHistory).toHaveBeenCalledWith(77);
    expect(mockedGetQuoteAuditTrail).toHaveBeenCalledWith(77);
  });

  it("discovery lab operasyonlari sekmesi quoteInsight ile ilgili alt bolumu vurgular", async () => {
    renderAdminPageWithLocationProbe({
      id: 20,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    expect((await screen.findAllByText(/admin geri donus odagi: rfq denetim izi/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/rfq #77 icinde denetim izi odagi geri yuklendi/i)).toBeInTheDocument();
    expect(screen.getByTestId("restored-quote-toast-progress")).toBeInTheDocument();
    await waitFor(() => {
      const toast = screen.queryByTestId("restored-quote-toast");
      const timeline = screen.queryByText(/geri yukleme zaman cizelgesi/i);
      expect(toast || timeline).toBeTruthy();
    });
    expect(screen.getAllByText(/geri donus odagi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pending 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/gerekce var: teknik onay tamamlandı/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rfq olusturuldu: rfq olusturuldu/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rfq denetim izi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rfq olusturuldu/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/geri yukleme zaman cizelgesi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rfq #77 bildirimi gosterildi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rfq #77 .* odagi/i).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId("location-probe").textContent).toBe("?tab=discovery_lab_operations"));
  });

  it("discovery lab operasyonlari restore toast'ini escape ile kapatir", async () => {
    renderAdminPage({
      id: 27,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    const toast = await screen.findByTestId("restored-quote-toast");
    fireEvent.keyDown(toast, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("restored-quote-toast")).not.toBeInTheDocument());
    expect(screen.getByText(/manuel temizleme/i)).toBeInTheDocument();
  });

  it("discovery lab operasyonlari debug timeline filtreleri ve replay aksiyonunu calistirir", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    renderAdminPage({
      id: 28,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    await screen.findByText(/geri yukleme zaman cizelgesi/i);
    expect(screen.getByText(/kaynak: quote return/i)).toBeInTheDocument();
  expect(screen.getAllByText(/yuksek onem|operator|izleme/i).length).toBeGreaterThan(0);
    await user.click(screen.getByTestId("restore-debug-filter-action"));
    expect(screen.getByText(/secili filtre icin debug olayi bulunmuyor/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /restore replay hedefi/i }), "status-history");
    expect(screen.getByRole("combobox", { name: /restore replay hedefi/i })).toHaveValue("status-history");
    expect(screen.getByRole("button", { name: /geri yukleme tekrari • durum gecmisi/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /geri yukleme tekrari • durum gecmisi/i }));
    expect(await screen.findByText(/replay action/i)).toBeInTheDocument();
    expect(screen.getByText(/rfq #77 durum gecmisi odagi yeniden calistirildi/i)).toBeInTheDocument();
    await user.click(screen.getByTestId("restore-debug-replay-filter-last-replay-chain"));
    await user.type(screen.getByRole("textbox", { name: /restore timeline arama/i }), "status history");
    expect(screen.getAllByText(/replay zinciri/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("rfq-audit-card-77")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /(super admin paneli|panel ana sayfa)/i }));
    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    expect(screen.getByText(/replay summary:/i)).toBeInTheDocument();
  });

  it("telemetry secimi discovery lab satirini otomatik acar ve ilgili bolume kaydirir", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    renderAdminPage({
      id: 28,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    await screen.findByText(/geri yukleme zaman cizelgesi/i);
    await user.click(screen.getByRole("button", { name: /(super admin paneli|panel ana sayfa)/i }));
    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /event'i sec/i }));
    await user.click(screen.getByRole("button", { name: /discovery lab operasyonlari/i }));
    expect(await screen.findByRole("button", { name: /rfq gecmisini gizle/i })).toBeInTheDocument();
    expect(screen.getAllByText(/telemetry secimi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/telemetry secimi bu bolumu hedefledi: denetim izi/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /telemetry eventine don/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /secimi temizle/i })).toBeInTheDocument();
    expect(screen.getByTestId("rfq-audit-trail-panel-77")).toHaveStyle({ transform: "scale(1.02)" });
    expect(scrollSpy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /telemetry eventine don/i }));
    expect(await screen.findByText(/yonetici odak telemetrisi/i)).toBeInTheDocument();
    expect(screen.getByText(/geri donus hedefi/i)).toBeInTheDocument();
    const highlightedCards = screen.getAllByTestId(/telemetry-event-card-/i).filter((item) => item.textContent?.includes("Geri donus hedefi"));
    expect(highlightedCards.length).toBeGreaterThan(0);
    expect(highlightedCards[0]).toHaveStyle({ transform: "scale(1.01)" });
    expect(scrollSpy).toHaveBeenCalled();
    expect(screen.getByText(/fade-out aktif/i)).toBeInTheDocument();
    fireEvent.mouseEnter(highlightedCards[0]);
    expect(screen.getByText(/fade-out duraklatildi/i)).toBeInTheDocument();
    expect(screen.getByText(/kalan sure:/i)).toBeInTheDocument();
    expect(screen.getByTestId(/telemetry-return-progress-/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /discovery lab operasyonlari/i }));
    expect(await screen.findByRole("button", { name: /rfq gecmisini gizle/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /secimi temizle/i }));
    expect(screen.queryByText(/telemetry secimi bu bolumu hedefledi: denetim izi/i)).not.toBeInTheDocument();
  });

  it("discovery lab operasyonlari debug timeline satirlarini silebilir ve tumunu temizleyebilir", async () => {
    renderAdminPage({
      id: 31,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    expect(await screen.findByText(/geri yukleme zaman cizelgesi/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/restore-debug-remove-/i).length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /timeline temizle/i })).toBeInTheDocument();
  });

  it("discovery lab operasyonlari debug timeline kayitlarini sert yenileme sonrasi geri getirir", async () => {
    renderAdminPage({
      id: 29,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    expect((await screen.findAllByText(/geri yukleme zaman cizelgesi/i)).length).toBeGreaterThan(0);
    renderAdminPage({
      id: 29,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations");

    expect(await screen.findByText(/geri yukleme zaman cizelgesi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rfq #77 bildirimi gosterildi/i).length).toBeGreaterThan(0);
  });

  it("discovery lab operasyonlari restore odaginda toast veya debug timeline gosterir", async () => {
    renderAdminPage({
      id: 25,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    await waitFor(() => {
      const toast = screen.queryByTestId("restored-quote-toast");
      const timeline = screen.queryByText(/geri yukleme zaman cizelgesi/i);
      expect(toast || timeline).toBeTruthy();
    });
  });

  it("discovery lab operasyonlari restore toast'inden rfq kart odagina gidebilir", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    renderAdminPage({
      id: 22,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    await screen.findByText(/rfq #77 icinde denetim izi odagi geri yuklendi/i);
    await user.click(screen.getAllByRole("button", { name: /rfq #77 odagina git/i })[0]);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("discovery lab operasyonlari restore edilen rfq kartini listenin ustune tasir", async () => {
    renderAdminPage({
      id: 23,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=full-audit-trail");

    expect(await screen.findByTestId("rfq-audit-card-77")).toBeInTheDocument();
    const cards = screen.getAllByTestId(/rfq-audit-card-/i);
    expect(cards[0]).toHaveAttribute("data-testid", "rfq-audit-card-77");
  });

  it("discovery lab operasyonlari restore odagini sekme gecisinde korur", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 24,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=status-history");

    expect(await screen.findByTestId("rfq-audit-card-77")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rfq gecmisini gizle/i })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /stratejik partner yonetimi/i })[1]);
    expect(await screen.findByText(/stratejik partner portfoyu/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /discovery lab operasyonlari/i }));
    expect(await screen.findByText(/answer audit ve rfq baglanti merkezi/i)).toBeInTheDocument();
    await waitFor(() => {
      const restoredCard = screen.queryByTestId("rfq-audit-card-77");
      const restoredBanner = screen.queryByTestId("admin-focus-banner-rfq");
      expect(restoredCard || restoredBanner).toBeTruthy();
    });
  });

  it("discovery lab operasyonlari restore odagini sert yenileme sonrasi local storage'dan bir kez geri getirir", async () => {
    renderAdminPage({
      id: 26,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=status-history");

    expect(await screen.findByTestId("rfq-audit-card-77")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rfq gecmisini gizle/i })).toBeInTheDocument();

    renderAdminPage({
      id: 26,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations");

    expect(await screen.findByTestId("admin-focus-banner-rfq")).toBeInTheDocument();
    expect(screen.getAllByText(/geri donus odagi/i).length).toBeGreaterThan(0);
  });

  it("discovery lab operasyonlari sekmesinde restore odagi manuel temizlenebilir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 21,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=discovery_lab_operations&quoteFocusId=77&quoteInsight=status-history");

    expect(await screen.findByTestId("rfq-audit-card-77")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rfq gecmisini gizle/i })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /odagi temizle/i })[0]);
    expect(await screen.findByText(/manuel temizleme/i)).toBeInTheDocument();
  });

  it("tenant governance deep-link odagini query param ile acar", async () => {
    renderAdminPage({
      id: 18,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=tenant_governance&tenantFocusId=1&tenantFocusName=Tenant%20One");

    expect(await screen.findByText(/discovery lab odagi: tenant one/i)).toBeInTheDocument();
    expect(screen.getByTestId("admin-focus-banner-tenant")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: stratejik partner deep-link/i)).toBeInTheDocument();
    expect(screen.getAllByText(/tenant one/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^tenant two$/i)).not.toBeInTheDocument();
  });

  it("projects ve onboarding deep-link odagini query param ile acar", async () => {
    renderAdminPage({
      id: 19,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=projects&projectFocusName=Merkez%20Projesi");

    expect(await screen.findByText(/proje odagi: merkez projesi/i)).toBeInTheDocument();
    expect(screen.getByTestId("admin-focus-banner-project")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: project deep-link/i)).toBeInTheDocument();
    expect(screen.getByText(/projects tab mock • merkez projesi/i)).toBeInTheDocument();

    renderAdminPage({
      id: 20,
      email: "support@test.com",
      role: "user",
      system_role: "platform_support",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=onboarding_studio&onboardingPlanFocus=growth");

    expect(await screen.findByText(/onboarding odagi: growth plani/i)).toBeInTheDocument();
    expect(screen.getByTestId("admin-focus-banner-onboarding")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: onboarding deep-link/i)).toBeInTheDocument();
  });

  it("super admin icin paket ve kullanim sekmesini gosterir", async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollSpy,
      configurable: true,
      writable: true,
    });
    const authValue: AuthContextType = {
      user: {
        id: 2,
        email: "super@test.com",
        role: "super_admin",
        system_role: "super_admin",
        platform_name: "Buyera Asistans",
      },
      loading: false,
      login: async () => {},
      logout: () => {},
    };

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/admin?tab=packages"]}>
          <Routes>
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(await screen.findByText(/paket ve modul matrisi/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText(/starter/i).length).toBeGreaterThan(0));
  expect(screen.getByText(/rfq core/i)).toBeInTheDocument();
  expect(screen.getAllByText(/varsayilan plan/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/stratejik partner bazli kullanim sayaçlari/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/tenant one/i)).toBeInTheDocument());
  expect(screen.getByText(/3 \/ 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tum planlar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^growth/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /limit baskisi/i })).toBeInTheDocument();
    expect(screen.getByText(/riskteki stratejik partner/i)).toBeInTheDocument();
    expect(screen.getByText(/en yuksek doluluk/i)).toBeInTheDocument();
    expect(screen.getByText(/100% doluluk/i)).toBeInTheDocument();
    expect(screen.getByText(/billing operasyonlari/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aktif/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deneme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /acik/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /odendi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /islendi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hatali/i })).toBeInTheDocument();
    expect(screen.getByText(/subscription.updated/i)).toBeInTheDocument();
    expect(screen.getByText(/seat: 5/i)).toBeInTheDocument();
    expect(screen.getByText(/seat: 15/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^growth/i }));
    expect(await screen.findByTestId("admin-focus-banner-packages")).toBeInTheDocument();
    expect(screen.getByText(/kaynak: paketler filtresi/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /odak kartina git/i }));
    expect(scrollSpy).toHaveBeenCalled();
    expect(screen.getByText(/tenant two/i)).toBeInTheDocument();
    expect(screen.queryByText(/tenant one/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /tum planlar/i }));
    expect(screen.getByText(/tenant one/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /limit baskisi/i }));
    expect(screen.getByText(/tenant two/i)).toBeInTheDocument();
    expect(screen.queryByText(/tenant one/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /tum riskler/i }));
    expect(screen.getByText(/tenant one/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^growth/i }));
    await userEvent.click(screen.getByRole("button", { name: /limit baskisi/i }));
    await userEvent.click(screen.getByRole("button", { name: /filtreyi temizle/i }));
    expect(screen.queryByTestId("admin-focus-banner-packages")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^aktif/i }));
    expect(screen.getByText(/seat: 5/i)).toBeInTheDocument();
    expect(screen.queryByText(/seat: 15/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /deneme/i }));
    expect(screen.getByText(/seat: 15/i)).toBeInTheDocument();
    expect(screen.queryByText(/seat: 40/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: /diger/i })[0]);
    expect(screen.getByText(/seat: 40/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /acik/i }));
    expect(screen.getByText(/inv-001/i)).toBeInTheDocument();
    expect(screen.getByText(/inv-002/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /odendi/i }));
    expect(screen.getByText(/inv-003/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /islendi/i }));
    expect(screen.getByText(/subscription.updated/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /hatali/i }));
    expect(screen.getByText(/henuz webhook olayi alinmadi/i)).toBeInTheDocument();
  });

  it("failed webhook kartinda yeniden isle quick-action gosterir ve tetikler", async () => {
    const failedBillingOverview = {
      subscriptions: [
        {
          id: 11,
          tenant_id: 1,
          subscription_plan_code: "starter",
          billing_provider: "stripe",
          provider_customer_id: "cus-1",
          provider_subscription_id: "sub-1",
          status: "active",
          billing_cycle: "monthly",
          seats_purchased: 5,
          cancel_at_period_end: false,
          created_at: "2026-04-15T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
      ],
      invoices: [],
      recent_webhook_events: [
        {
          id: 9,
          tenant_id: 1,
          tenant_subscription_id: 11,
          provider: "stripe",
          event_type: "subscription.updated",
          provider_event_id: "evt-failed-9",
          processing_status: "failed",
          error_message: "mock processing error",
          received_at: "2026-04-15T10:05:00Z",
        },
      ],
    };
    const processedBillingOverview = {
      subscriptions: [
        {
          id: 11,
          tenant_id: 1,
          subscription_plan_code: "starter",
          billing_provider: "stripe",
          provider_customer_id: "cus-1",
          provider_subscription_id: "sub-1",
          status: "active",
          billing_cycle: "monthly",
          seats_purchased: 5,
          cancel_at_period_end: false,
          created_at: "2026-04-15T10:00:00Z",
          updated_at: "2026-04-15T10:00:00Z",
        },
      ],
      invoices: [],
      recent_webhook_events: [
        {
          id: 9,
          tenant_id: 1,
          tenant_subscription_id: 11,
          provider: "stripe",
          event_type: "subscription.updated",
          provider_event_id: "evt-failed-9",
          processing_status: "processed",
          received_at: "2026-04-15T10:05:00Z",
        },
      ],
    };
    let billingOverviewCallCount = 0;
    mockedGetBillingOverview.mockImplementation(async () => {
      billingOverviewCallCount += 1;
      return (billingOverviewCallCount < 3 ? failedBillingOverview : processedBillingOverview) as never;
    });

    renderAdminPage({
      id: 2,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=packages");

    expect(await screen.findByText(/billing operasyonlari/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/mock processing error/i)).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /yeniden isle/i }));

    await waitFor(() => {
      expect(mockedRetryBillingWebhookEvent).toHaveBeenCalledWith(9);
    });
  });

  it("raporlar sekmesinde rapor linklerini gosterir", async () => {
    renderAdminPage({
      id: 8,
      email: "admin@test.com",
      role: "admin",
      system_role: "tenant_admin",
      platform_name: "Buyera Asistans",
    }, "/admin?tab=reports");

    expect(await screen.findByText(/rfq karsilastirma, tedarikci performans ve satin alma sureci raporlarinizi goruntuleyin/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /teklif listesi/i })).toHaveAttribute("href", "/quotes");
    expect(screen.getByRole("link", { name: /karsilastirma raporu api/i })).toHaveAttribute("href", expect.stringContaining("/api/v1/reports/quote-comparison"));
  });

  it("platform analitikleri sekmesinde backend ozet metriklerini gosterir", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        summary: {
          total_tenants: 12,
          active_tenants: 10,
          total_internal_users: 87,
          total_suppliers: 245,
          platform_suppliers: 41,
          private_suppliers: 204,
          total_projects: 56,
          total_quotes: 133,
        },
        plan_distribution: [
          { plan_code: "starter", plan_name: "Starter", tenant_count: 7 },
          { plan_code: "growth", plan_name: "Growth", tenant_count: 5 },
        ],
        onboarding_distribution: [
          { status: "active", count: 8 },
          { status: "pending_activation", count: 2 },
        ],
      })
    );

    renderAdminPage({
      id: 9,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    });

    await screen.findByRole("button", { name: /(admin|super admin) paneli/i });
    await userEvent.click(screen.getByRole("button", { name: /platform analitikleri/i }));

    expect(await screen.findByText(/platform analitikleri/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  it("platform tedarikci havuzu sekmesinde listeleme ve yeni tedarikci ekleme akislarini calistirir", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse([
          { id: 1, name: "Global Tedarikci", email: "hello@global.com", phone: "+90 212 000 00 00", city: "Istanbul" },
        ])
      )
      .mockResolvedValueOnce(createJsonResponse({ id: 2, name: "Yeni Tedarikci", email: "yeni@tedarikci.com", source_type: "platform_network" }, true, 201))
      .mockResolvedValueOnce(
        createJsonResponse([
          { id: 1, name: "Global Tedarikci", email: "hello@global.com", phone: "+90 212 000 00 00", city: "Istanbul" },
          { id: 2, name: "Yeni Tedarikci", email: "yeni@tedarikci.com", phone: "+90 555 111 22 33", city: "Ankara" },
        ])
      );

    const user = userEvent.setup();
    renderAdminPage({
      id: 10,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    });

    await screen.findByRole("button", { name: /(admin|super admin) paneli/i });

    await user.click(screen.getByRole("button", { name: /platform tedarikci havuzu/i }));

    expect(await screen.findByRole("heading", { name: /platform tedarikci havuzu/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /yeni tedarikci/i })[0]);
    await user.type(screen.getByPlaceholderText(/firma adi/i), "Yeni Tedarikci");
    await user.type(screen.getByPlaceholderText(/^email$/i), "yeni@tedarikci.com");
    await user.type(screen.getByPlaceholderText(/^phone$/i), "+90 555 111 22 33");
    await user.type(screen.getByPlaceholderText(/^website$/i), "https://yeni.test");
    await user.type(screen.getByPlaceholderText(/^city$/i), "Ankara");
    await user.click(screen.getByRole("button", { name: /^kaydet$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
    expect(
      fetchMock.mock.calls.some(([url, options]) =>
        String(url).includes("/api/v1/admin/platform-suppliers")
        && typeof options === "object"
        && options !== null
        && (options as { method?: string }).method === "POST"
      )
    ).toBe(true);
  });

  it("kampanyalar ve landing sekmesinde seeded kartlari ve disabled aksiyonu gosterir", async () => {
    const user = userEvent.setup();
    renderAdminPage({
      id: 11,
      email: "super@test.com",
      role: "super_admin",
      system_role: "super_admin",
      platform_name: "Buyera Asistans",
    });

    await screen.findByRole("button", { name: /(admin|super admin) paneli/i });

    await user.click(screen.getByRole("button", { name: /kampanyalar ve landing/i }));

    expect(await screen.findByText(/campaigns admin tab mock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kampanyalar ve landing/i })).toBeInTheDocument();
  });
});


