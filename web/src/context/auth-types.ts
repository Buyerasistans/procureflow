// FILE: web\src\context\auth-types.ts
import type { Role } from "../auth/permissions";

export type AuthUser = {
  id: number;
  email: string;
  work_email?: string | null;
  role: Role;
  business_role?: string | null;
  system_role?: string | null;
  full_name?: string;
  scope_type?: string | null;
  role_profile_code?: string | null;
  department_id?: number | null;
  organization_name?: string | null;
  organization_logo_url?: string | null;
  workspace_label?: string | null;
  platform_name?: string | null;
  platform_domain?: string | null;
};

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
