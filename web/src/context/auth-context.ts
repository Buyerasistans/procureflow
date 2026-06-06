// FILE: web\src\context\auth-context.ts
import { createContext } from "react";
import type { AuthUser } from "./auth-types";

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
