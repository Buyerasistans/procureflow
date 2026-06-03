import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDepartments, updateDepartment } from "../services/admin.service";
import type { Department } from "../services/admin.service";
import "./DepartmentDetailPage.css";

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
  });
  const [tasks, setTasks] = useState<{ name: string; active: boolean }[]>([]);
  const [taskInput, setTaskInput] = useState("");

  const fetchDepartment = useCallback(async () => {
    try {
      setLoading(true);
      const allDepts = await getDepartments();
      const dept = allDepts.find((d: Department) => d.id === parseInt(id!));
      if (dept) {
        setDepartment(dept);
        setForm({
          name: dept.name,
          description: dept.description || "",
        });
        const taskLines = (dept.description || "").split("\n").filter(l => l.startsWith("- "));
        const parsedTasks = taskLines.map(line => {
          const match = line.match(/^- (.+) \[(Aktif|Pasif)\]/);
          return match ? { name: match[1], active: match[2] === "Aktif" } : null;
        }).filter(Boolean) as { name: string; active: boolean }[];
        setTasks(parsedTasks);
      } else {
        setError("Departman bulunamadı");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDepartment();
  }, [fetchDepartment]);

  const handleSave = async () => {
    try {
      const taskSummary = tasks.length
        ? `\nİş/Hizmetler:\n` + tasks.map(t => `- ${t.name} [${t.active ? "Aktif" : "Pasif"}]`).join("\n")
        : "";
      await updateDepartment(parseInt(id!), {
        ...form,
        description: (form.description || "").replace(/\nİş\/Hizmetler:[\s\S]*/g, "") + taskSummary,
      });
      setError(null);
      setIsEditing(false);
      navigate("/admin?tab=departments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncelleme hatası");
    }
  };

  function handleAddTask() {
    const val = taskInput.trim();
    if (!val) return;
    setTasks([...tasks, { name: val, active: true }]);
    setTaskInput("");
  }

  function handleToggleTask(idx: number) {
    setTasks(tasks.map((t, i) => i === idx ? { ...t, active: !t.active } : t));
  }

  function handleRemoveTask(idx: number) {
    setTasks(tasks.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    if (window.location.search.includes("edit=true")) {
      setIsEditing(true);
    }
  }, []);

  if (loading) return <div className="ddp-loading">Yükleniyor...</div>;
  if (error) return <div className="ddp-error">❌ {error}</div>;
  if (!department) return <div className="ddp-not-found">Departman bulunamadı</div>;

  return (
    <div className="ddp-root">
      <button
        type="button"
        onClick={() => navigate("/admin?tab=departments")}
        className="ddp-back-btn"
      >
        ← Geri Dön
      </button>

      <h1>🏢 {department.name}</h1>

      {!isEditing ? (
        <div className="ddp-card">
          <div className="ddp-field">
            <strong>Departman Adı:</strong> {department.name}
          </div>
          <div className="ddp-field">
            <strong>Açıklama:</strong>
            <div className="ddp-desc-content">
              {(() => {
                const desc = department.description || "";
                const [mainDesc, ...rest] = desc.split(/\nİş\/Hizmetler:/);
                const taskLines = rest.join("").split("\n").filter(l => l.startsWith("- "));
                return (
                  <>
                    <div>{mainDesc.trim() || "Açıklama eklenmemiş"}</div>
                    {taskLines.length > 0 && (
                      <div className="ddp-task-section">
                        <strong>İş/Hizmetler:</strong>
                        <ul className="ddp-task-list">
                          {taskLines.map((line, i) => {
                            const match = line.match(/^- (.+) \[(Aktif|Pasif)\]/);
                            return (
                              <li key={i} className={match && match[2] === "Pasif" ? "ddp-task-item ddp-task-item--pasif" : "ddp-task-item"}>
                                {match ? (
                                  <>
                                    {match[1]}{" "}
                                    {match[2] === "Aktif"
                                      ? <span className="ddp-status-active">[Aktif]</span>
                                      : <span className="ddp-status-pasif">[Pasif]</span>
                                    }
                                  </>
                                ) : line}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="ddp-field">
            <strong>Durum:</strong> {department.is_active ? "✅ Aktif" : "❌ Pasif"}
          </div>
          <div className="ddp-btn-row">
            <button type="button" onClick={() => setIsEditing(true)} className="ddp-edit-btn">
              Düzenle
            </button>
            <button type="button" onClick={() => navigate("/admin?tab=departments")} className="ddp-secondary-btn">
              Geri Dön
            </button>
          </div>
        </div>
      ) : (
        <div className="ddp-card">
          <h2>Departman Bilgilerini Düzenle</h2>
          <div className="ddp-form-grid">
            <div>
              <label htmlFor="ddp-dept-name">Departman Adı:</label>
              <input
                id="ddp-dept-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="ddp-input"
              />
            </div>
            <div>
              <label htmlFor="ddp-dept-desc">Açıklama:</label>
              <textarea
                id="ddp-dept-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="ddp-textarea"
              />
            </div>
            <div>
              <label htmlFor="ddp-task-input">İş/Hizmetler</label>
              <div className="ddp-task-input-row">
                <input
                  id="ddp-task-input"
                  type="text"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  placeholder="İş veya hizmet adı"
                  className="ddp-task-input"
                />
                <button type="button" onClick={handleAddTask} className="ddp-task-add-btn">
                  Ekle
                </button>
              </div>
              {tasks.filter(t => t.active).length > 0 && (
                <ul className="ddp-task-edit-list">
                  {tasks.filter(t => t.active).map((task, idx) => (
                    <li key={idx} className="ddp-task-edit-item">
                      <span className="ddp-task-name">{task.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(idx)}
                        title={task.active ? "Pasifleştir" : "Aktifleştir"}
                        className={task.active ? "ddp-toggle-btn--active" : "ddp-toggle-btn--inactive"}
                      >
                        {task.active ? "✔️" : "❌"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        className="ddp-remove-btn"
                      >
                        Sil
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="ddp-btn-row">
            <button type="button" onClick={handleSave} className="ddp-save-btn">
              Kaydet
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="ddp-secondary-btn">
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
