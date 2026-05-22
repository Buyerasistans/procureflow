import { useState, useEffect } from "react";
import styled from "styled-components";
import { http } from "../lib/http";
import type { Supplier as SupplierRecord } from "../types/supplier";

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);

  h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 18px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;

  &:hover {
    color: #333;
  }
`;

const FilterSection = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  button {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;

    &.active {
      background-color: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }

    &:hover:not(.active) {
      background-color: #f0f0f0;
    }
  }
`;

const SupplierList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
`;

const SupplierItem = styled.label<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid ${(props) => (props.selected ? "#3b82f6" : "#e0e0e0")};
  border-radius: 4px;
  background-color: ${(props) => (props.selected ? "#f0f7ff" : "white")};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #3b82f6;
  }

  input {
    margin-right: 12px;
    cursor: pointer;
    width: 18px;
    height: 18px;
  }
`;

const SupplierInfo = styled.div`
  flex: 1;

  .name {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .details {
    font-size: 13px;
    color: #666;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;

  button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;

    &.send {
      background-color: #3b82f6;
      color: white;

      &:hover {
        background-color: #2563eb;
      }

      &:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
      }
    }

    &.cancel {
      background-color: #e5e7eb;
      color: #333;

      &:hover {
        background-color: #d1d5db;
      }
    }
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 20px;
`;

const ErrorMessage = styled.div`
  background-color: #fee2e2;
  color: #991b1b;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`;

const SuccessMessage = styled.div`
  background-color: #d1fae5;
  color: #065f46;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`;

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
    <Backdrop onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <h2>📧 Projeye Tedarikçi Ekle</h2>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <h3>Kaynak Seç</h3>
        <FilterSection>
          <button
            className={selectedSourceType === "all" ? "active" : ""}
            onClick={() => setSelectedSourceType("all")}
          >
            Tümü ({sourceSummary.all})
          </button>
          <button
            className={selectedSourceType === "private" ? "active" : ""}
            onClick={() => setSelectedSourceType("private")}
          >
            Private Supplier ({sourceSummary.private})
          </button>
          <button
            className={selectedSourceType === "platform_network" ? "active" : ""}
            onClick={() => setSelectedSourceType("platform_network")}
          >
            Platform Ağı ({sourceSummary.platform_network})
          </button>
        </FilterSection>

        <h3>Kategori Seç (Opsiyonel)</h3>
        <FilterSection>
          <button
            className={!selectedCategory ? "active" : ""}
            onClick={() => setSelectedCategory(null)}
          >
            Tümü ({suppliers.filter((s) => s.is_active).length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={selectedCategory === cat ? "active" : ""}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat} ({suppliers.filter((s) => getSupplierCategories(s).includes(cat) && s.is_active).length})
            </button>
          ))}
        </FilterSection>

        <h3>Tedarikçileri Seç</h3>
        {loading ? (
          <LoadingMessage>Tedarikçiler yükleniyor...</LoadingMessage>
        ) : filteredSuppliers.length === 0 ? (
          <LoadingMessage>Bu kategoride tedarikçi bulunamadı</LoadingMessage>
        ) : (
          <SupplierList>
            {filteredSuppliers.map((supplier) => (
              <SupplierItem
                key={supplier.id}
                selected={selectedSuppliers.includes(supplier.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedSuppliers.includes(supplier.id)}
                  onChange={() => handleSelectSupplier(supplier.id)}
                />
                <SupplierInfo>
                  <div className="name">{supplier.company_name}</div>
                  <div className="details">
                    <div>📧 {supplier.email}</div>
                    <div>📞 {supplier.phone}</div>
                    {getSupplierCategories(supplier).length > 0 && <div>📂 {getSupplierCategories(supplier).join(", ")}</div>}
                    <div>
                      {supplier.source_type === "platform_network"
                        ? "🌐 Platform Ağı"
                        : "🏢 Private Supplier"}
                    </div>
                  </div>
                </SupplierInfo>
              </SupplierItem>
            ))}
          </SupplierList>
        )}

        <ActionButtons>
          <button className="cancel" onClick={onClose}>
            İptal
          </button>
          <button
            className="send"
            onClick={handleSendInvitations}
            disabled={selectedSuppliers.length === 0 || sending}
          >
            {sending ? "Gönderiliyor..." : `Davetiye Gönder (${selectedSuppliers.length})`}
          </button>
        </ActionButtons>
      </Modal>
    </Backdrop>
  );
}
