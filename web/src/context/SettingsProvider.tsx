// FILE: web/src/context/SettingsProvider.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { SystemSettings, SettingsUpdatePayload } from "../services/settings.service";
import { getSettings, updateSettings as updateSettingsApi, refreshSettings as refreshSettingsApi } from "../services/settings.service";
import type { SettingsContextType } from "./settings-types";
import { shouldUseSupplierSession } from "../lib/session";
import { getAccessToken, getRefreshToken } from "../lib/token";
import { SettingsContext } from "./SettingsContext";

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const location = useLocation();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSettings();
      setSettings(data);
      console.log("[SETTINGS] Settings yüklendi:", data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ayarlar yükleme hatası";
      const maybeResponse =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { status?: number } }).response
          : undefined;
      const statusCode = maybeResponse?.status;

      // 401/403 yetkisiz surface'larda (channel/supplier) sessizce gec.
      if (statusCode === 401 || statusCode === 403) {
        console.log("[SETTINGS] 401/403 - Yetki veya oturum yok, silently skip");
        return;
      }

      setError(message);
      console.error("[SETTINGS] Yükleme hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Public route'larda ve auth session yokken settings çağrısını atla.
  useEffect(() => {
    const pathname = location.pathname;
    const isPublicRoute =
      pathname === "/login" ||
      pathname === "/activate-account" ||
      pathname === "/supplier/login" ||
      pathname === "/supplier/register";

    const hasAdminAuthSession = Boolean(getAccessToken() || getRefreshToken());

    if (isPublicRoute || !hasAdminAuthSession) {
      return;
    }

    // Supplier session'da settings yükleme
    const isSupplierSession = shouldUseSupplierSession(pathname);
    if (!isSupplierSession) {
      loadSettings();
    }
  }, [loadSettings, location.pathname]);

  const updateSettings = useCallback(
    async (payload: SettingsUpdatePayload) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await updateSettingsApi(payload);
        setSettings(updated);
        console.log("[SETTINGS] Ayarlar güncellendi:", updated);
      } catch (err) {
        const maybeResponse =
          typeof err === "object" && err !== null && "response" in err
            ? (err as { response?: { status?: number; data?: { detail?: string } } }).response
            : undefined;
        const statusCode = maybeResponse?.status;
        const backendDetail = maybeResponse?.data?.detail;
        const message =
          statusCode === 401 || statusCode === 403
            ? "Bu panelde ayar degistirme yetkiniz yok."
            : backendDetail || (err instanceof Error ? err.message : "Ayarlar guncelleme hatasi");
        setError(message);
        console.error("[SETTINGS] Güncelleme hatası:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await refreshSettingsApi();
      setSettings(data);
      console.log("[SETTINGS] Ayarlar yenilendi:", data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ayarlar yenileme hatası";
      setError(message);
      console.error("[SETTINGS] Yenileme hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: SettingsContextType = {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
