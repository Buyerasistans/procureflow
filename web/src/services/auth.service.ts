// FILE: web/src/services/auth.service.ts
import axios from "axios";
import { http } from "../lib/http";
import { setSupplierAccessToken } from "../lib/session";
import { clearAccessToken } from "../lib/token";
import { getRefreshToken } from "../lib/token";
import type { AuthUser } from "../context/auth-types";

const AUTH_REQUEST_TIMEOUT_MS = 10000;

type LoginApiResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | string;
  user?: AuthUser;
};

type SupplierLoginResponse = {
  success?: boolean;
  message?: string;
  access_token?: string;
  token_type?: string;
  supplier_user?: {
    id: number;
    name: string;
    email: string;
    supplier_id: number;
    supplier_name: string;
    email_verified: boolean;
  };
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser | null;
};

function deriveSystemRole(user: Pick<AuthUser, "role" | "system_role">): string | null {
  const explicitSystemRole = String(user.system_role || "").toLowerCase();
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" && (!explicitSystemRole || explicitSystemRole === "tenant_member")) {
    return "tenant_admin";
  }
  if (explicitSystemRole) {
    return explicitSystemRole;
  }

  if (role === "super_admin") {
    return "super_admin";
  }
  if (role === "admin") {
    return "tenant_admin";
  }
  return "tenant_member";
}

function deriveScopeType(user: Pick<AuthUser, "scope_type" | "system_role" | "role" | "business_role">): string | null {
  const explicitScope = String(user.scope_type || "").trim().toLowerCase();
  if (explicitScope) return explicitScope;

  const systemRole = String(user.system_role || "").toLowerCase();
  const businessRole = String(user.business_role || user.role || "").toLowerCase();
  if (["super_admin", "platform_operator", "platform_support", "finance_officer"].includes(systemRole)) return "platform";
  if (systemRole === "supplier_user" || businessRole.startsWith("supplier_")) return "supplier";
  if (businessRole.startsWith("channel_")) return "channel";
  return "partner";
}

function deriveRoleProfileCode(user: Pick<AuthUser, "role_profile_code" | "scope_type" | "system_role" | "role" | "business_role">): string | null {
  const explicitCode = String(user.role_profile_code || "").trim().toLowerCase();
  if (explicitCode) return explicitCode;

  const scopeType = deriveScopeType(user);
  const systemRole = String(user.system_role || "").toLowerCase();
  const businessRole = String(user.business_role || user.role || "").toLowerCase();
  if (scopeType === "platform") {
    if (systemRole === "super_admin") return "platform.super_admin";
    if (systemRole === "finance_officer") return "platform.finance_officer";
    if (systemRole === "platform_support") return "platform.support_agent";
    return "platform.portal_admin";
  }
  if (scopeType === "supplier") {
    return businessRole === "supplier_admin" ? "supplier.org_admin" : "supplier.sales_senior";
  }
  if (scopeType === "channel") {
    return businessRole === "channel_owner" ? "channel.account_owner" : "channel.agent";
  }
  if (systemRole === "tenant_owner") return "partner.account_owner";
  if (systemRole === "tenant_admin") return "partner.org_admin";
  return "partner.custom_role";
}

export function normalizeAuthUser(user: AuthUser | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const role = String(user.role || "").toLowerCase() as AuthUser["role"];
  const businessRole = String(user.business_role || role || "").toLowerCase() || null;
  const systemRole = deriveSystemRole(user);

  return {
    ...user,
    role,
    scope_type: deriveScopeType(user),
    role_profile_code: deriveRoleProfileCode(user),
    business_role: businessRole,
    system_role: systemRole,
  };
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  try {
    const res = await http.post<LoginApiResponse>("/auth/login", { email, password }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
    const data = res.data;

    if (!data?.access_token || !data?.refresh_token) {
      throw new Error("Login yanıtında token bilgisi eksik.");
    }

    console.log("[AUTH] Login başarılı, token alındı:", data);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: normalizeAuthUser(data.user ?? null),
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message;

      if (error.response?.status === 401) {
        throw new Error(detail || "E-posta veya şifre hatalı.");
      }

      if (error.code === "ECONNABORTED") {
        throw new Error("Giris istegi zaman asimina ugradi. API servisini kontrol edip tekrar deneyin.");
      }

      if (detail) {
        throw new Error(detail);
      }
    }

    console.error("[AUTH] Login hatası:", error);
    throw new Error("Giriş sırasında bir sorun oluştu.");
  }
}

// Tedarikçi giriş
export async function supplierLoginRequest(email: string, password: string): Promise<string> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const res = await http.post<SupplierLoginResponse>("/supplier/login", { email: normalizedEmail, password });
    const data = res.data;

    if (!data?.access_token) {
      throw new Error("Tedarikçi login yanıtında access_token yok.");
    }

    console.log("[SUPPLIER_AUTH] Login başarılı:", data);
  // Supplier oturumuna geçerken admin token/cache'i temizle.
  clearAccessToken();
  sessionStorage.removeItem("pf_user");
  localStorage.removeItem("pf_user");
    setSupplierAccessToken(data.access_token);

    return data.access_token;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error("E-posta veya şifre hatalı.");
    }
    console.error("[SUPPLIER_AUTH] Login hatası:", error);
    throw new Error("Giriş sırasında bir sorun oluştu.");
  }
}

// Tedarikçi kayıt
export async function supplierRegisterRequest(token: string, password: string): Promise<string> {
  try {
    const res = await http.post<SupplierLoginResponse>("/supplier/register", {
      token,
      password,
    });
    const data = res.data;

    if (!data?.access_token) {
      throw new Error("Tedarikçi kayıt yanıtında access_token yok.");
    }

    console.log("[SUPPLIER_AUTH] Kayıt başarılı:", data);
  // Supplier oturumuna geçerken admin token/cache'i temizle.
  clearAccessToken();
  sessionStorage.removeItem("pf_user");
  localStorage.removeItem("pf_user");
    setSupplierAccessToken(data.access_token);

    return data.access_token;
  } catch (error: unknown) {
    console.error("[SUPPLIER_AUTH] Kayıt hatası:", error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || "Kayıt sırasında sorun oluştu.");
    }
    throw new Error("Kayıt sırasında bir sorun oluştu.");
  }
}

export async function meRequest(): Promise<AuthUser> {
  const res = await http.get<AuthUser>("/auth/me", { timeout: AUTH_REQUEST_TIMEOUT_MS });
  console.log("[AUTH] /me endpoint'den kullanıcı bilgisi alındı:", res.data);
  return normalizeAuthUser(res.data) as AuthUser;
}

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type ActivationVerifyResponse = {
  valid: boolean;
  email: string;
  full_name: string;
  role: AuthUser["role"];
  business_role?: string | null;
  system_role?: string | null;
  accepted: boolean;
  organization_name?: string | null;
  organization_logo_url?: string | null;
  workspace_label?: string | null;
  platform_name?: string | null;
  platform_domain?: string | null;
};

export async function verifyInternalActivationToken(token: string): Promise<ActivationVerifyResponse> {
  const res = await http.post<ActivationVerifyResponse>("/auth/activate/verify", { token });
  return res.data;
}

export async function activateInternalUserRequest(token: string, password: string): Promise<LoginResponse> {
  const res = await http.post<LoginApiResponse>("/auth/activate", { token, password });
  const data = res.data;

  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Aktivasyon yanıtında token bilgisi eksik.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: normalizeAuthUser(data.user ?? null),
  };
}

export async function refreshRequest(refreshToken: string): Promise<RefreshResponse> {
  const res = await http.post<LoginApiResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  });

  if (!res.data?.access_token || !res.data?.refresh_token) {
    throw new Error("Refresh yanıtında token bilgisi eksik.");
  }

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
  };
}

export async function logoutRequest(): Promise<void> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return;

    await http.post("/auth/logout", {
      refresh_token: refreshToken,
    });
  } catch {
    // backend logout başarısız olsa da local temizliği AuthProvider yapacak
  }
}
