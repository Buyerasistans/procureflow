// FILE: web/src/context/ProfileProvider.tsx
import React, { useState, useCallback } from "react";
import type { UserProfile } from "../services/profile.service";
import {
  getMyProfile,
  updateMyProfile,
  changePassword as changePasswordApi,
} from "../services/profile.service";
import type { ProfileContextType } from "./profile-types";
import { ProfileContext } from "./ProfileContext";

interface ProfileProviderProps {
  children: React.ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyProfile();
      setProfile(data);
      console.log("[PROFILE] Profile yüklendi:", data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profil yükleme hatası";
      setError(message);
      console.error("[PROFILE] Yükleme hatası:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (data: { full_name?: string; work_email?: string | null }) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await updateMyProfile(data);
        setProfile(updated);
        console.log("[PROFILE] Profil güncellendi:", updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Profil güncelleme hatası";
        setError(message);
        console.error("[PROFILE] Güncelleme hatası:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const changePassword = useCallback(
    async (old_password: string, new_password: string) => {
      try {
        setLoading(true);
        setError(null);
        await changePasswordApi(old_password, new_password);
        console.log("[PROFILE] Şifre değiştirildi");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Şifre değişme hatası";
        setError(message);
        console.error("[PROFILE] Şifre değişme hatası:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const value: ProfileContextType = {
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
    changePassword,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
