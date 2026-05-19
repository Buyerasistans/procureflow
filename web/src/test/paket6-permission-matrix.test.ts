/**
 * Paket 6 frontend test paketi
 *
 * Kapsanan alanlar:
 *  1. resolveMatrixProfileKey — profil eşleştirme mantığı
 *  2. buildMenuPreviewFromMatrix — katalog + matris → MenuAccessPreviewItem[]
 *  3. Override map uygulaması (override true/false, defaults)
 */
import { describe, expect, it } from "vitest";
import type { RolePermissionMatrixRow } from "../services/admin.service";
import type { PermissionCatalogNode } from "../services/admin.service";
import {
  resolveMatrixProfileKey,
  buildMenuPreviewFromMatrix,
} from "../auth/permissions";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MATRIX: RolePermissionMatrixRow[] = [
  {
    profile: "admin:tenant_admin",
    business_role: "admin",
    system_role: "tenant_admin",
    enabled_keys: ["workspace_home", "admin_surface", "admin_surface.user_view"],
  },
  {
    profile: "satinalmaci:tenant_member",
    business_role: "satinalmaci",
    system_role: "tenant_member",
    enabled_keys: ["workspace_home", "quote_workspace", "quote_workspace.list"],
  },
  {
    profile: "super_admin:super_admin",
    business_role: "super_admin",
    system_role: "super_admin",
    enabled_keys: [
      "workspace_home",
      "admin_surface",
      "admin_surface.user_view",
      "admin_surface.user_create",
      "admin_surface.user_edit",
      "admin_surface.user_delete",
    ],
  },
];

const CATALOG: PermissionCatalogNode[] = [
  {
    key: "workspace_home",
    label: "Ana Sayfa",
    description: "",
    children: [
      { key: "workspace_home.kpi_cards", label: "KPI Kartları", description: "", children: [] },
    ],
  },
  {
    key: "admin_surface",
    label: "Yönetim Alanı",
    description: "",
    children: [
      { key: "admin_surface.user_view", label: "Personel Listeleme", description: "", children: [] },
      { key: "admin_surface.user_create", label: "Personel Oluşturma", description: "", children: [] },
      { key: "admin_surface.user_delete", label: "Personel Silme", description: "", children: [] },
    ],
  },
  {
    key: "quote_workspace",
    label: "Teklif Alanı",
    description: "",
    children: [
      { key: "quote_workspace.list", label: "Teklif Listele", description: "", children: [] },
      { key: "quote_workspace.create", label: "Teklif Oluştur", description: "", children: [] },
    ],
  },
];

// ---------------------------------------------------------------------------
// resolveMatrixProfileKey tests
// ---------------------------------------------------------------------------

describe("resolveMatrixProfileKey", () => {
  it("tam eslesen profili dondurur", () => {
    const result = resolveMatrixProfileKey("admin", "tenant_admin", MATRIX);
    expect(result).toBeDefined();
    expect(result!.profile).toBe("admin:tenant_admin");
  });

  it("super_admin satirini dogru bulur", () => {
    const result = resolveMatrixProfileKey("super_admin", "super_admin", MATRIX);
    expect(result).toBeDefined();
    expect(result!.enabled_keys).toContain("admin_surface.user_create");
  });

  it("tanimli olmayan rol icin undefined dondurur", () => {
    const result = resolveMatrixProfileKey("bilinmeyen", "bilinmeyen", MATRIX);
    expect(result).toBeUndefined();
  });

  it("buyuk-kucuk harf duyarsiz calisir", () => {
    const result = resolveMatrixProfileKey("ADMIN", "TENANT_ADMIN", MATRIX);
    expect(result).toBeDefined();
    expect(result!.profile).toBe("admin:tenant_admin");
  });
});

// ---------------------------------------------------------------------------
// buildMenuPreviewFromMatrix tests
// ---------------------------------------------------------------------------

describe("buildMenuPreviewFromMatrix", () => {
  it("bos matris icin bos liste dondurur", () => {
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", [], CATALOG);
    expect(result).toHaveLength(0);
  });

  it("bos katalog icin bos liste dondurur", () => {
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", MATRIX, []);
    expect(result).toHaveLength(0);
  });

  it("tenant_admin icin admin_surface etkin, quote_workspace devre disi", () => {
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", MATRIX, CATALOG);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    const quoteWorkspace = result.find((r) => r.key === "quote_workspace");
    expect(adminSurface?.enabled).toBe(true);
    expect(quoteWorkspace?.enabled).toBe(false);
  });

  it("satinalmaci icin quote_workspace etkin, admin_surface devre disi", () => {
    const result = buildMenuPreviewFromMatrix("satinalmaci", "tenant_member", MATRIX, CATALOG);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    const quoteWorkspace = result.find((r) => r.key === "quote_workspace");
    expect(adminSurface?.enabled).toBe(false);
    expect(quoteWorkspace?.enabled).toBe(true);
  });

  it("alt menu user_view etkin, user_create devre disi (tenant_admin)", () => {
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", MATRIX, CATALOG);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    const userView = adminSurface?.children?.find((c) => c.key === "admin_surface.user_view");
    const userCreate = adminSurface?.children?.find((c) => c.key === "admin_surface.user_create");
    expect(userView?.enabled).toBe(true);
    expect(userCreate?.enabled).toBe(false);
  });

  it("override map matris sonucunu ezer (acik kapatma)", () => {
    const overrides = { "admin_surface": false };
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", MATRIX, CATALOG, overrides);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    expect(adminSurface?.enabled).toBe(false);
  });

  it("override map matris sonucunu ezer (kapali acma)", () => {
    const overrides = { "admin_surface.user_create": true };
    const result = buildMenuPreviewFromMatrix("admin", "tenant_admin", MATRIX, CATALOG, overrides);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    const userCreate = adminSurface?.children?.find((c) => c.key === "admin_surface.user_create");
    expect(userCreate?.enabled).toBe(true);
  });

  it("super_admin tum kritik alt menulere erisebilir", () => {
    const result = buildMenuPreviewFromMatrix("super_admin", "super_admin", MATRIX, CATALOG);
    const adminSurface = result.find((r) => r.key === "admin_surface");
    const userDelete = adminSurface?.children?.find((c) => c.key === "admin_surface.user_delete");
    expect(userDelete?.enabled).toBe(true);
  });

  it("tanimlanmamis rol icin tum menuler devre disi", () => {
    const result = buildMenuPreviewFromMatrix("bilinmeyen", "bilinmeyen", MATRIX, CATALOG);
    expect(result.every((r) => r.enabled === false)).toBe(true);
  });
});
