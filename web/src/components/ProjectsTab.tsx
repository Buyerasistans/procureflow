// web/src/components/ProjectsTab.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCompanies } from "../services/admin.service";
import { deleteProject, getProjects } from "../services/project.service";
import type { Company } from "../services/admin.service";
import type { Project } from "../types/project";
import { getShortCompanyName } from "../utils/companyDisplay";
import { ProjectCreateModal } from "./ProjectCreateModal";
import "./ProjectsTab.css";

interface ProjectsTabProps {
  readOnly?: boolean;
  initialSearchTerm?: string;
}

type ProjectGroup = Record<number, Project[]>;
type ColorVariant = "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan" | "slate";

export function ProjectsTab({ readOnly = false, initialSearchTerm = "" }: ProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [groupByCompany, setGroupByCompany] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  async function loadData() {
    try {
      setLoading(true);
      const [projectsData, companiesData] = await Promise.all([getProjects(), getCompanies()]);
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
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== id));
    } catch (error) {
      console.error("Proje silme hatası:", error);
    }
  }

  const getCompanyName = (companyId?: number) => {
    const company = companies.find((item) => item.id === companyId);
    if (!company) return "Firma yok";
    return getShortCompanyName(company);
  };

  const getCompanyVariant = (companyId?: number): ColorVariant => {
    const variants: ColorVariant[] = ["blue", "emerald", "violet", "amber", "rose", "cyan", "slate"];
    if (!companyId) return "blue";
    return variants[Math.abs(companyId) % variants.length];
  };

  const renderProjectRow = (project: Project) => (
    <div key={project.id} className="projects-tab__row">
      <div>
        <span
          className={`projects-tab__company-badge projects-tab__company-badge--${getCompanyVariant(
            project.company_id,
          )}`}
        >
          {getCompanyName(project.company_id)}
        </span>
      </div>

      <div>
        <p className="projects-tab__project-name">{project.name}</p>
        <p className="projects-tab__project-code">Kod: {project.code}</p>
      </div>

      <div>
        <span
          className={`projects-tab__project-type ${
            project.project_type === "franchise"
              ? "projects-tab__project-type--franchise"
              : "projects-tab__project-type--center"
          }`}
        >
          {project.project_type === "franchise" ? "🍕 Franchise" : "🏢 Merkez"}
        </span>
      </div>

      <div className="projects-tab__manager">
        <span className="projects-tab__manager-name">{project.manager_name || "-"}</span>
        {project.manager_phone && (
          <a
            href={`tel:${project.manager_phone}`}
            className="projects-tab__manager-phone"
            title={project.manager_phone}
          >
            ☎️
          </a>
        )}
      </div>

      <div className="projects-tab__actions">
        <Link to={`/admin/projects/${project.id}`} className="projects-tab__action projects-tab__action--details">
          Detaylar
        </Link>
        <button
          type="button"
          onClick={() => void handleDelete(project.id)}
          disabled={readOnly}
          className="projects-tab__action projects-tab__action--delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompanyId === null || project.company_id === selectedCompanyId;
    return matchesSearch && matchesCompany;
  });

  if (loading) {
    return <div className="projects-tab__loading">Yükleniyor...</div>;
  }

  const groupedProjects = filteredProjects.reduce((accumulator, project) => {
    const companyId = project.company_id || 0;
    if (!accumulator[companyId]) {
      accumulator[companyId] = [];
    }
    accumulator[companyId].push(project);
    return accumulator;
  }, {} as ProjectGroup);

  return (
    <div className="projects-tab">
      {readOnly && (
        <div className="projects-tab__read-only-note">
          Platform personeli proje portföyünü inceleyebilir; yeni proje ekleme ve silme aksiyonları bu yüzeyde kapatıldı.
        </div>
      )}

      <div className="projects-tab__filters">
        <div className="projects-tab__company-filter">
          <select
            value={selectedCompanyId === null ? "" : selectedCompanyId}
            onChange={(event) =>
              setSelectedCompanyId(event.target.value === "" ? null : Number(event.target.value))
            }
            className="projects-tab__select"
            aria-label="Firma filtresi"
            title="Firma filtresi"
          >
            <option value="">Tüm Firmalar</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {getShortCompanyName(company)}
              </option>
            ))}
          </select>
        </div>

        <label className="projects-tab__group-toggle">
          <input
            type="checkbox"
            checked={groupByCompany}
            onChange={(event) => setGroupByCompany(event.target.checked)}
            className="projects-tab__group-toggle-input"
          />
          Firmaya Göre Grupla
        </label>
      </div>

      <div className="projects-tab__header">
        <input
          type="text"
          placeholder="Proje adı veya kodu ara..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="projects-tab__search"
        />
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={readOnly}
          className="projects-tab__create-button"
        >
          ➕ Yeni Proje
        </button>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="projects-tab__list">
          {groupByCompany ? (
            Object.entries(groupedProjects).map(([companyId, companyProjects]) => (
              <div key={companyId} className="projects-tab__group">
                <div
                  className={`projects-tab__group-header projects-tab__group-header--${getCompanyVariant(
                    Number(companyId),
                  )}`}
                >
                  <span>{getCompanyName(Number(companyId))}</span>
                  <span className="projects-tab__group-count">({companyProjects.length} proje)</span>
                </div>

                {companyProjects.map((project) => renderProjectRow(project))}
              </div>
            ))
          ) : (
            filteredProjects.map((project) => renderProjectRow(project))
          )}
        </div>
      ) : (
        <div className="projects-tab__empty">
          {searchTerm ? "Sonuç bulunamadı" : "Henüz proje oluşturulmamış"}
        </div>
      )}

      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          void loadData();
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
