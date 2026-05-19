// FILE: web/src/context/profile-types.ts
import type { UserProfile } from "../services/profile.service";

export interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: { full_name?: string; work_email?: string | null }) => Promise<void>;
  changePassword: (old_password: string, new_password: string) => Promise<void>;
}

export const initialState: ProfileContextType = {
  profile: null,
  loading: false,
  error: null,
  refreshProfile: async () => {},
  updateProfile: async () => {},
  changePassword: async () => {},
};
