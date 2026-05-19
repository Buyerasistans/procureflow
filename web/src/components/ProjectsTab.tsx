// web/src/components/ProjectsTab.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getProjects, deleteProject } from "../services/project.service";
import { getCompanies } from "../services/admin.service";
import { ProjectCreateModal } from "./ProjectCreateModal";
import type { Project } from "../types/project";
import type { Company } from "../services/admin.service";
import { getShortCompanyName } from "../utils/companyDisplay";

interface ProjectsTabProps {
  readOnly?: boolean;
  initialSearchTerm?: string;
}

export function ProjectsTab({ readOnly = false, initialSearchTerm = "" }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [groupByCompany, setGroupByCompany] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectsData, companiesData] = await Promise.all([
        getProjects(),
        getCompanies()
      ]);
      setProjects(projectsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Veriler yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Projeyi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Proje silme hatası:", error);
    }
  }

  const getCompanyName = (companyId?: number) => {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return "Firma yok";
    return getShortCompanyName(company);
  };

  const renderProjectRow = (project: Project) => (
    <div
      key={project.id}
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr 120px 150px auto",
        gap: "16px",
        padding: "16px",
        alignItems: "center",
        borderBottom: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        transition: "background-color 0.2s"
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#fff"}
    >
      {/* Firma (Renklı Badge) */}
      <div>
        <span
          style={{
            display: "inline-block",
            backgroundColor: companies.find((c) => c.id === project.company_id)?.color || "#3b82f6",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "600",
            wordBreak: "break-word"
          }}
        >
          {getCompanyName(project.company_id)}
        </span>
      </div>

      {/* Proje Adı */}
      <div>
        <p style={{ margin: "0", fontSize: "14px", fontWeight: "600", color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </p>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>Kod: {project.code}</p>
      </div>

      {/* Türü */}
      <div>
        <span
          style={{
            display: "inline-block",
            backgroundColor: project.project_type === "franchise" ? "#f3e8ff" : "#dcfce7",
            color: project.project_type === "franchise" ? "#9333ea" : "#16a34a",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600"
          }}
        >
          {project.project_type === "franchise" ? "🍕 Franchise" : "🏢 Merkez"}
        </span>
      </div>

      {/* Yetkilisi */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontSize: "13px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1" }}>
          {project.manager_name || "-"}
        </span>
        {project.manager_phone && (
          <a
            href={`tel:${project.manager_phone}`}
            style={{
              padding: "4px 8px",
              backgroundColor: "#22c55e",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              border: "none",
              flexShrink: 0,
              transition: "background-color 0.2s"
            }}
            title={project.manager_phone}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#16a34a"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#22c55e"}
          >
            ☎️
          </a>
        )}
      </div>

      {/* İşlemler */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <Link
          to={`/admin/projects/${project.id}`}
          style={{
            padding: "6px 12px",
            backgroundColor: "#3b82f6",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
        >
          Detaylar
        </Link>
        <button
          onClick={() => handleDelete(project.id)}
          disabled={readOnly}
          style={{
            padding: "6px 12px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: readOnly ? "not-allowed" : "pointer",
            opacity: readOnly ? 0.6 : 1,
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.backgroundColor = "#dc2626"; }}
          onMouseLeave={(e) => { if (!readOnly) e.currentTarget.style.backgroundColor = "#ef4444"; }}
        >
          🗑️
        </button>
      </div>
    </div>
  );

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompanyId === null || p.company_id === selectedCompanyId;
    return matchesSearch && matchesCompany;
  });

  if (loading) return <div style={{ textAlign: "center", padding: "32px" }}>Yükleniyor...</div>;

  return (
    <div>
      {readOnly && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>
          Platform personeli proje portfoyunu inceleyebilir; yeni proje ekleme ve silme aksiyonlari bu yuzeyde kapatildi.
        </div>
      )}
      
      {/* Filtre Kontrolleri */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1", minWidth: "200px" }}>
          <select
            value={selectedCompanyId === null ? "" : selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value === "" ? null : parseInt(e.target.value))}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "#fff",
              cursor: "pointer"
            }}
          >
            <option value="">Tüm Firmalar</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {getShortCompanyName(company)}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "#374151", whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={groupByCompany}
            onChange={(e) => setGroupByCompany(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          Firmaya Göre Grupla
        </label>
      </div>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px" }}>
        <input
          type="text"
          placeholder="Proje adı veya kodu ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: "1",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px"
          }}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={readOnly}
          style={{
            padding: "10px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: readOnly ? "not-allowed" : "pointer",
            fontSize: "14px"
          }}
          onMouseEnter={(e) => { if (!readOnly) e.currentTarget.style.backgroundColor = "#2563eb"; }}
          onMouseLeave={(e) => { if (!readOnly) e.currentTarget.style.backgroundColor = "#3b82f6"; }}
        >
          ➕ Yeni Proje
        </button>
      </div>

      {/* Proje Listesi */}
      {filteredProjects.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {groupByCompany ? (
            // Firmaya göre gruplandırılmış görünüm
            Object.entries(
              filteredProjects.reduce((acc, project) => {
                const companyId = project.company_id || 0;
                if (!acc[companyId]) {
                  acc[companyId] = [];
                }
                acc[companyId].push(project);
                return acc;
              }, {} as Record<number, Project[]>)
            ).map(([companyId, groupProjects]) => (
              <div key={companyId}>
                {/* Firma Başlığı */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    backgroundColor: companies.find((c) => c.id === parseInt(companyId))?.color || "#3b82f6",
                    color: "white",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: "default"
                  }}
                >
                  <span>{getCompanyName(parseInt(companyId))}</span>
                  <span style={{ fontSize: "12px", opacity: 0.9 }}>({groupProjects.length} proje)</span>
                </div>
                
                {/* Firma Altındaki Projeler */}
                {groupProjects.map((project) => renderProjectRow(project))}
              </div>
            ))
          ) : (
            // Flat görünüm
            filteredProjects.map((project) => renderProjectRow(project))
          )}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px", color: "#6b7280", backgroundColor: "#f3f4f6", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          {searchTerm ? "Sonuç bulunamadı" : "Henüz proje oluşturulmamış"}
        </div>
      )}

      {/* Create Modal */}
      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadData();
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
