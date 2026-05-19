// web/src/types/project.ts

export interface ProjectFile {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  created_at?: string;
}

export interface ProjectPersonnel {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  code: string;
  budget?: number;
  company_id?: number;
  created_by_id?: number | null;
  project_type: "merkez" | "franchise";
  address?: string;
  latitude?: number;
  longitude?: number;
  manager_name?: string;
  manager_phone?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  project_files?: ProjectFile[];
  personnel?: ProjectPersonnel[];
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  code: string;
  budget?: number;
  company_id?: number;
  project_type: "merkez" | "franchise";
  address?: string;
  latitude?: number;
  longitude?: number;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  is_active?: boolean;
  responsible_user_ids?: number[];
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string;
  code?: string;
  budget?: number;
  company_id?: number;
  project_type?: "merkez" | "franchise";
  address?: string;
  latitude?: number;
  longitude?: number;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  is_active?: boolean;
  responsible_user_ids?: number[];
}
