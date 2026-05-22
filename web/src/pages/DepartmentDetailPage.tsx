import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDepartments, updateDepartment } from "../services/admin.service";
import type { Department } from "../services/admin.service";

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
  // İş/hizmetler için state
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
        // İş/hizmetleri açıklamadan ayrıştır
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
      // İş/hizmetleri açıklamaya ekle
      const taskSummary = tasks.length
        ? `\nİş/Hizmetler:\n` + tasks.map(t => `- ${t.name} [${t.active ? "Aktif" : "Pasif"}]`).join("\n")
        : "";
      await updateDepartment(parseInt(id!), {
        ...form,
        description: (form.description || "").replace(/\nİş\/Hizmetler:[\s\S]*/g, "") + taskSummary,
      });
      setError(null);
      setIsEditing(false);
      // Kaydettikten sonra departmanlar sekmesine yönlendir
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

  // URL'de ?edit=true varsa otomatik düzenleme moduna geç
  useEffect(() => {
    if (window.location.search.includes("edit=true")) {
      setIsEditing(true);
    }
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>❌ {error}</div>;
  if (!department) return <div style={{ padding: 20 }}>Departman bulunamadı</div>;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/admin?tab=departments")}
        style={{
          marginBottom: 20,
          padding: "8px 16px",
          background: "#f3f4f6",
          border: "1px solid #ddd",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        ← Geri Dön
      </button>

      <h1>🏢 {department.name}</h1>

      {!isEditing ? (
        <div style={{ background: "#f9fafb", padding: 20, borderRadius: 8, border: "1px solid #ddd" }}>
          <div style={{ marginBottom: 16 }}>
            <strong>Departman Adı:</strong> {department.name}
          </div>
          {/* Açıklama ve iş/hizmetler ayrıştırılmış gösterim */}
          <div style={{ marginBottom: 16 }}>
            <strong>Açıklama:</strong>
            <div style={{ marginTop: 4 }}>
              {(() => {
                const desc = department.description || "";
                const [mainDesc, ...rest] = desc.split(/\nİş\/Hizmetler:/);
                const taskLines = rest.join("").split("\n").filter(l => l.startsWith("- "));
                return (
                  <>
                    <div>{mainDesc.trim() || "Açıklama eklenmemiş"}</div>
                    {taskLines.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>İş/Hizmetler:</strong>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {taskLines.map((line, i) => {
                            const match = line.match(/^- (.+) \[(Aktif|Pasif)\]/);
                            return (
                              <li key={i} style={{ color: match && match[2] === "Pasif" ? "#9ca3af" : undefined }}>
                                {match ? (
                                  <>
                                    {match[1]} {match[2] === "Aktif" ? <span style={{ color: "#10b981" }}>[Aktif]</span> : <span style={{ color: "#9ca3af" }}>[Pasif]</span>}
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
          <div style={{ marginBottom: 16 }}>
            <strong>Durum:</strong> {department.is_active ? "✅ Aktif" : "❌ Pasif"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: "10px 16px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Düzenle
            </button>
            <button
              onClick={() => navigate("/admin?tab=departments")}
              style={{
                padding: "10px 16px",
                background: "#f3f4f6",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Geri Dön
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: "#f9fafb", padding: 20, borderRadius: 8, border: "1px solid #ddd" }}>
          <h2>Departman Bilgilerini Düzenle</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label>Departman Adı:</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label>Açıklama:</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ddd", boxSizing: "border-box", minHeight: 100 }}
              />
            </div>
            {/* İş/Hizmet Ekleme Alanı */}
            <div>
              <label>İş/Hizmetler</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  placeholder="İş veya hizmet adı"
                  style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
                />
                <button type="button" onClick={handleAddTask} style={{ background: "#10b981", color: "white", border: "none", borderRadius: 4, padding: "8px 16px", cursor: "pointer" }}>
                  Ekle
                </button>
              </div>
              {/* Sadece aktif iş/hizmetler gösterilecek */}
              {tasks.filter(t => t.active).length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {tasks.filter(t => t.active).map((task, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{task.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(idx)}
                        title={task.active ? "Pasifleştir" : "Aktifleştir"}
                        style={{
                          background: task.active ? "#10b981" : "#d1d5db",
                          color: task.active ? "white" : "#374151",
                          border: "none",
                          borderRadius: 4,
                          padding: "2px 8px",
                          cursor: "pointer"
                        }}
                      >
                        {task.active ? "✔️" : "❌"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(idx)}
                        style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                      >
                        Sil
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              style={{
                padding: "10px 16px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Kaydet
            </button>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                padding: "10px 16px",
                background: "#f3f4f6",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
