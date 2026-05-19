// web/src/services/project.service.ts
import { http } from "../lib/http";
import type { Project, ProjectCreatePayload, ProjectUpdatePayload, ProjectFile } from "../types/project";

// PROJECTS
export async function getProjects(): Promise<Project[]> {
  const res = await http.get<Project[]>("/admin/projects");
  return res.data;
}

export async function createProject(data: ProjectCreatePayload): Promise<Project> {
  const res = await http.post<Project>("/admin/projects", data);
  return res.data;
}

export async function updateProject(id: number, data: ProjectUpdatePayload): Promise<Project> {
  const res = await http.put<Project>(`/admin/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/admin/projects/${id}`);
  return res.data;
}

export async function addProjectPersonnel(projectId: number, userId: number): Promise<{ message: string }> {
  const res = await http.post<{ message: string }>(`/admin/users/${userId}/projects/${projectId}`);
  return res.data;
}

export async function addProjectTenantUser(projectId: number, userId: number): Promise<{ message: string }> {
  return addProjectPersonnel(projectId, userId);
}

export async function removeProjectPersonnel(projectId: number, userId: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/admin/users/${userId}/projects/${projectId}`);
  return res.data;
}

export async function removeProjectTenantUser(projectId: number, userId: number): Promise<{ message: string }> {
  return removeProjectPersonnel(projectId, userId);
}

// PROJECT FILES
export async function uploadProjectFile(projectId: number, file: File): Promise<ProjectFile> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await http.post<ProjectFile>(`/admin/projects/${projectId}/files`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}

export async function getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  const res = await http.get<ProjectFile[]>(`/admin/projects/${projectId}/files`);
  return res.data;
}

export async function deleteProjectFile(fileId: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/admin/files/${fileId}`);
  return res.data;
}

export interface ProjectSupplierItem {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_email: string;
  category?: string;
  is_active: boolean;
  invitation_sent?: boolean;
  invitation_sent_at?: string;
  assigned_at?: string;
}

export async function getProjectSuppliers(projectId: number): Promise<ProjectSupplierItem[]> {
  const res = await http.get<ProjectSupplierItem[]>(`/suppliers/projects/${projectId}/suppliers`);
  return res.data;
}
