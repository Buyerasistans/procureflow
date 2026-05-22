import { useEffect, useState } from "react";
import { createDepartment, updateDepartment, type Department } from "../services/admin.service";
import "./DepartmentCreateModal.css";

interface DepartmentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: Department | null;
  onRequestSubmit?: (payload: { name: string; description?: string }) => Promise<void>;
}

interface TaskItem {
  name: string;
  active: boolean;
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
  const [tasks, setTasks] = useState<TaskItem[]>([]);
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

      const payload = buildPayload();

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

      const payload = buildPayload();
      await onRequestSubmit(payload);

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

  function buildPayload() {
    const taskSummary = tasks.length
      ? `\nİş/Hizmetler:\n${tasks.map((task) => `- ${task.name} [${task.active ? "Aktif" : "Pasif"}]`).join("\n")}`
      : "";

    return {
      name,
      description: ((description || "") + taskSummary).trim() || undefined,
    };
  }

  function resetForm() {
    setName("");
    setDescription("");
    setError("");
    setTasks([]);
    setTaskInput("");
  }

  function handleAddTask() {
    const value = taskInput.trim();
    if (!value) return;
    setTasks([...tasks, { name: value, active: true }]);
    setTaskInput("");
  }

  function parseTasks(rawDescription: string): TaskItem[] {
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

  function handleToggleTask(index: number) {
    setTasks(tasks.map((task, currentIndex) => (currentIndex === index ? { ...task, active: !task.active } : task)));
  }

  function handleRemoveTask(index: number) {
    setTasks(tasks.filter((_, currentIndex) => currentIndex !== index));
  }

  if (!isOpen) return null;

  return (
    <div className="department-create-modal__backdrop">
      <div className="department-create-modal__container">
        <div className="department-create-modal__header">
          <h2 className="department-create-modal__title">
            {editData ? "📋 Departman Düzenle" : "📋 Yeni Departman Oluştur"}
          </h2>
          <button type="button" onClick={onClose} className="department-create-modal__close-button" aria-label="Kapat">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="department-create-modal__content">
          {error ? <div className="department-create-modal__error">{error}</div> : null}

          <div className="department-create-modal__field">
            <label className="department-create-modal__label">Departman Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn: Satın Alma"
              className="department-create-modal__input"
            />
          </div>

          <div className="department-create-modal__field">
            <label className="department-create-modal__label">Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Departman hakkında bilgi..."
              rows={3}
              className="department-create-modal__textarea"
            />
          </div>

          <div className="department-create-modal__field">
            <label className="department-create-modal__label">Alt Açılımlar / İş-Hizmetler</label>
            <div className="department-create-modal__task-row">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Alt açılım veya iş/hizmet adı"
                className="department-create-modal__input"
              />
              <button type="button" onClick={handleAddTask} className="department-create-modal__button department-create-modal__button--secondary">
                Ekle
              </button>
            </div>

            {tasks.length > 0 ? (
              <ul className="department-create-modal__task-list">
                {tasks.map((task, index) => (
                  <li key={`${task.name}-${index}`} className="department-create-modal__task-item">
                    <span className="department-create-modal__task-name">{task.name}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTask(index)}
                      title={task.active ? "Pasifleştir" : "Aktifleştir"}
                      className={`department-create-modal__task-toggle ${
                        task.active
                          ? "department-create-modal__task-toggle--active"
                          : "department-create-modal__task-toggle--inactive"
                      }`}
                    >
                      {task.active ? "✔️" : "❌"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(index)}
                      className="department-create-modal__task-remove"
                    >
                      Sil
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="department-create-modal__footer">
            {!editData && onRequestSubmit ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRequestSubmit()}
                className={`department-create-modal__button department-create-modal__button--request ${
                  loading ? "department-create-modal__button--primary-disabled" : ""
                }`}
              >
                {loading ? "⏳ Gönderiliyor..." : "📝 Onaya Gönder"}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`department-create-modal__button ${
                loading ? "department-create-modal__button--primary-disabled" : "department-create-modal__button--primary"
              }`}
            >
              {loading ? "⏳ Kaydediliyor..." : editData ? "✅ Departmanı Güncelle" : "✅ Departman Oluştur"}
            </button>

            <button type="button" onClick={onClose} className="department-create-modal__button department-create-modal__button--secondary">
              ❌ İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
