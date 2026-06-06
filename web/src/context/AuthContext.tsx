import { useEffect, useMemo, useState } from "react";
import { login as loginApi, me } from "../services/auth";
import { clearToken, getToken, setTokens } from "../lib/session";
import { AuthContext } from "./auth-context";
import type { AuthUser } from "./auth-types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hasToken = !!getToken();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(hasToken);

  useEffect(() => {
    if (!hasToken) return;

    me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [hasToken]);

  async function login(email: string, password: string, captchaToken?: string) {
    const data = await loginApi(email, password, captchaToken);
    setTokens(data.access_token, data.refresh_token);
    const profile = await me();
    setUser(profile);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
