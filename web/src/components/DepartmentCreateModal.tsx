import { useEffect, useState } from "react";
import { createDepartment, updateDepartment, type Department } from "../services/admin.service";
import { modalStyles } from "../styles/modalStyles";

interface DepartmentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Department | null;
  onRequestSubmit?: (payload: { name: string; description?: string }) => Promise<void>;
}

export function DepartmentCreateModal({
  isOpen,
  onClose,
  onSuccess,
  editData = null,
  onRequestSubmit,
}: DepartmentCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // İş ve hizmetler için state
  const [tasks, setTasks] = useState<{ name: string; active: boolean }[]>([]);
  const [taskInput, setTaskInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (editData) {
      setName(editData.name || "");
      setDescription(extractDepartmentDescription(editData.description || ""));
      setTasks(parseTasks(editData.description || ""));
      setError("");
      return;
    }

    resetForm();
  }, [isOpen, editData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) throw new Error("Departman adı gerekli");

      // İş/hizmetleri açıklamaya ekle
      const taskSummary = tasks.length
        ? `\nİş/Hizmetler:\n` + tasks.map(t => `- ${t.name} [${t.active ? "Aktif" : "Pasif"}]`).join("\n")
        : "";

      const payload = {
        name,
        description: (description || "") + taskSummary,
      };

      if (editData) {
        await updateDepartment(editData.id, payload);
      } else {
        await createDepartment(payload);
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Departman oluşturulamadı");
      console.error("Departman oluşturma hatası:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestSubmit() {
    setError("");
    setLoading(true);

    try {
      if (!name.trim()) throw new Error("Departman adı gerekli");
      if (!onRequestSubmit) throw new Error("Talep akisi hazir degil");

      const taskSummary = tasks.length
        ? `\nİş/Hizmetler:\n` + tasks.map(t => `- ${t.name} [${t.active ? "Aktif" : "Pasif"}]`).join("\n")
        : "";

      await onRequestSubmit({
        name,
        description: ((description || "") + taskSummary).trim() || undefined,
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Departman talebi oluşturulamadı");
      console.error("Departman talep hatası:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setError("");
    setTasks([]);
    setTaskInput("");
  }

  function handleAddTask() {
    const val = taskInput.trim();
    if (!val) return;
    setTasks([...tasks, { name: val, active: true }]);
    setTaskInput("");
  }

  function parseTasks(rawDescription: string) {
    return rawDescription
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => {
        const match = line.match(/^-\s*(.+?)(?:\s*\[(Aktif|Pasif)\])?$/i);
        if (!match) {
          return { name: line.replace(/^-\s*/, "").trim(), active: true };
        }
        return {
          name: match[1].trim(),
          active: (match[2] || "Aktif").toLowerCase() === "aktif",
        };
      });
  }

  function extractDepartmentDescription(rawDescription: string) {
    return rawDescription
      .split("\n")
      .filter((line) => !line.trim().startsWith("İş/Hizmetler:") && !line.trim().startsWith("- "))
      .join("\n")
      .trim();
  }

  function handleToggleTask(idx: number) {
    setTasks(tasks.map((t, i) => i === idx ? { ...t, active: !t.active } : t));
  }

  function handleRemoveTask(idx: number) {
    setTasks(tasks.filter((_, i) => i !== idx));
  }

  if (!isOpen) return null;

  return (
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.container}>
        {/* Header */}
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{editData ? "📋 Departman Düzenle" : "📋 Yeni Departman Oluştur"}</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={modalStyles.content}>
          {/* Error */}
          {error && <div style={modalStyles.errorMessage}>{error}</div>}

          {/* Departman Adı */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Departman Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn: Satın Alma"
              style={modalStyles.input}
            />
          </div>

          {/* Açıklama */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Departman hakkında bilgi..."
              rows={3}
              style={modalStyles.textarea}
            />
          </div>

          {/* Alt Açılım / İş-Hizmet Ekleme Alanı */}
          <div style={modalStyles.fullWidth}>
            <label style={modalStyles.label}>Alt Açılımlar / İş-Hizmetler</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={taskInput}
                onChange={e => setTaskInput(e.target.value)}
                placeholder="Alt açılım veya iş/hizmet adı"
                style={modalStyles.input}
              />
              <button type="button" onClick={handleAddTask} style={modalStyles.primaryButton}>
                Ekle
              </button>
            </div>
            {tasks.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {tasks.map((task, idx) => (
                  <li key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0, padding: 10, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontWeight: 600, flex: 1 }}>{task.name}</span>
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

          {/* Buttons */}
          <div style={modalStyles.footer}>
            {!editData && onRequestSubmit ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRequestSubmit()}
                style={loading ? modalStyles.secondaryButton : { ...modalStyles.secondaryButton, borderColor: "#bfdbfe", color: "#1d4ed8", fontWeight: 700 }}
              >
                {loading ? "⏳ Gönderiliyor..." : "📝 Onaya Gönder"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              style={
                loading
                  ? modalStyles.primaryButtonDisabled
                  : modalStyles.primaryButton
              }
            >
              {loading ? "⏳ Kaydediliyor..." : editData ? "✅ Departmanı Güncelle" : "✅ Departman Oluştur"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={modalStyles.secondaryButton}
            >
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
