import { useState, useEffect } from "react";
import { http } from "../lib/http";
import type { Supplier as SupplierRecord } from "../types/supplier";
import "./ProjectSuppliersModal.css";

type SupplierSourceType = "all" | "private" | "platform_network";

type Supplier = Pick<
  SupplierRecord,
  "id" | "company_name" | "email" | "phone" | "category" | "category_tags" | "partner_category_tags" | "effective_category_tags" | "is_active" | "source_type"
>;

interface ProjectSuppliersModalProps {
  projectId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

function getSupplierCategories(supplier: Supplier): string[] {
  if (supplier.effective_category_tags && supplier.effective_category_tags.length > 0) {
    return supplier.effective_category_tags;
  }
  if (supplier.category) {
    return [supplier.category];
  }
  return [];
}

export function ProjectSuppliersModal({ projectId, onClose, onSuccess }: ProjectSuppliersModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<SupplierSourceType>("all");

  useEffect(() => {
    void loadSuppliers(selectedSourceType);
  }, [selectedSourceType]);

  const loadSuppliers = async (sourceType: SupplierSourceType) => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get("/suppliers", {
        params: sourceType === "all" ? undefined : { source_type: sourceType },
      });
      const data = response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Tedarikçiler yüklenemedi: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(
    new Set(suppliers.flatMap((supplier) => getSupplierCategories(supplier))),
  ).sort((a, b) => a.localeCompare(b, "tr"));

  const filteredSuppliers = selectedCategory
    ? suppliers.filter((s) => getSupplierCategories(s).includes(selectedCategory) && s.is_active)
    : suppliers.filter((s) => s.is_active);

  const sourceSummary = {
    all: suppliers.filter((s) => s.is_active).length,
    private: suppliers.filter((s) => s.is_active && (s.source_type || "private") === "private").length,
    platform_network: suppliers.filter((s) => s.is_active && (s.source_type || "private") === "platform_network").length,
  };

  const handleSelectSupplier = (supplierId: number) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]
    );
  };

  const handleSendInvitations = async () => {
    if (selectedSuppliers.length === 0) {
      setError("En az bir tedarikçi seçmelisiniz");
      return;
    }

    try {
      setSending(true);
      setError(null);
      const response = await http.post(
        `/suppliers/projects/${projectId}/suppliers`,
        selectedSuppliers
      );
      const result = response.data;
      setSuccess(result.message || "Davetiyeler gönderildi!");
      setSelectedSuppliers([]);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (err) {
      setError("Tedarikçiler gönderilemedi: " + String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="psm-backdrop" onClick={onClose}>
      <div className="psm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="psm-header">
          <h2>📧 Projeye Tedarikçi Ekle</h2>
          <button type="button" className="psm-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="psm-msg psm-msg--error">{error}</div>}
        {success && <div className="psm-msg psm-msg--success">{success}</div>}

        <h3>Kaynak Seç</h3>
        <div className="psm-filters">
          <button
            type="button"
            className={`psm-filter-btn${selectedSourceType === "all" ? " psm-filter-btn--active" : ""}`}
            onClick={() => setSelectedSourceType("all")}
          >
            Tümü ({sourceSummary.all})
          </button>
          <button
            type="button"
            className={`psm-filter-btn${selectedSourceType === "private" ? " psm-filter-btn--active" : ""}`}
            onClick={() => setSelectedSourceType("private")}
          >
            Private Supplier ({sourceSummary.private})
          </button>
          <button
            type="button"
            className={`psm-filter-btn${selectedSourceType === "platform_network" ? " psm-filter-btn--active" : ""}`}
            onClick={() => setSelectedSourceType("platform_network")}
          >
            Platform Ağı ({sourceSummary.platform_network})
          </button>
        </div>

        <h3>Kategori Seç (Opsiyonel)</h3>
        <div className="psm-filters">
          <button
            type="button"
            className={`psm-filter-btn${!selectedCategory ? " psm-filter-btn--active" : ""}`}
            onClick={() => setSelectedCategory(null)}
          >
            Tümü ({suppliers.filter((s) => s.is_active).length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`psm-filter-btn${selectedCategory === cat ? " psm-filter-btn--active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({suppliers.filter((s) => getSupplierCategories(s).includes(cat) && s.is_active).length})
            </button>
          ))}
        </div>

        <h3>Tedarikçileri Seç</h3>
        {loading ? (
          <div className="psm-loading">Tedarikçiler yükleniyor...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="psm-loading">Bu kategoride tedarikçi bulunamadı</div>
        ) : (
          <div className="psm-supplier-list">
            {filteredSuppliers.map((supplier) => (
              <label
                key={supplier.id}
                className={`psm-supplier-item${selectedSuppliers.includes(supplier.id) ? " psm-supplier-item--selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedSuppliers.includes(supplier.id)}
                  onChange={() => handleSelectSupplier(supplier.id)}
                />
                <div className="psm-supplier-info">
                  <div className="psm-supplier-info__name">{supplier.company_name}</div>
                  <div className="psm-supplier-info__details">
                    <div>📧 {supplier.email}</div>
                    <div>📞 {supplier.phone}</div>
                    {getSupplierCategories(supplier).length > 0 && <div>📂 {getSupplierCategories(supplier).join(", ")}</div>}
                    <div>
                      {supplier.source_type === "platform_network"
                        ? "🌐 Platform Ağı"
                        : "🏢 Private Supplier"}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="psm-actions">
          <button type="button" className="psm-action-btn psm-action-btn--cancel" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="psm-action-btn psm-action-btn--send"
            onClick={handleSendInvitations}
            disabled={selectedSuppliers.length === 0 || sending}
          >
            {sending ? "Gönderiliyor..." : `Davetiye Gönder (${selectedSuppliers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
