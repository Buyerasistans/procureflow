// web/src/components/ApprovalDashboard.tsx
import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import styled from "styled-components";

const Container = styled.div`
  padding: 20px;
`;

const Header = styled.div`
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: #1f2937;
  }

  p {
    color: #6b7280;
    margin: 5px 0 0 0;
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
`;

const CardTitle = styled.h3`
  margin: 0;
  color: #1f2937;
  font-size: 16px;
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) => {
    switch (props.status) {
      case "DRAFT":
        return "#f3f4f6";
      case "SUBMITTED":
      case "SENT":
        return "#fef3c7";
      case "PENDING":
        return "#dbeafe";
      case "RESPONDED":
        return "#d1fae5";
      case "APPROVED":
        return "#86efac";
      default:
        return "#f3f4f6";
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "DRAFT":
        return "#374151";
      case "SUBMITTED":
      case "SENT":
        return "#92400e";
      case "PENDING":
        return "#1e40af";
      case "RESPONDED":
        return "#065f46";
      case "APPROVED":
        return "#166534";
      default:
        return "#374151";
    }
  }};
`;

const Details = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
`;

const DetailItem = styled.div`
  display: flex;
  flex-direction: column;

  strong {
    color: #6b7280;
    font-weight: 500;
  }

  span {
    color: #1f2937;
    margin-top: 2px;
  }
`;

const CommentBox = styled.textarea`
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  margin-top: 12px;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Button = styled.button<{ variant?: "success" | "danger" }>`
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  background-color: ${(props) => (props.variant === "danger" ? "#ef4444" : "#10b981")};
  color: white;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #9ca3af;

  p {
    margin: 0;
  }
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

interface PendingApproval {
  approval_id: number;
  quote_id: number;
  quote_title: string;
  quote_status: string;
  total_amount: number;
  company_name: string;
  approval_level: number;
  requested_at: string;
  created_at: string;
}

interface ApprovalDashboardProps {
  apiUrl: string;
  authToken: string;
}

export function ApprovalDashboard({ apiUrl, authToken }: ApprovalDashboardProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeApprovalId, setActiveApprovalId] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);

  const loadPendingApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiUrl}/api/v1/approvals/user/pending`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("Onaylar yüklenemedi");
      const data = await response.json();
      setApprovals(data || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authToken]);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals]);

  const handleApprove = useCallback(async (quoteId: number) => {
    if (!comment.trim()) {
      setError("Tedarikçiye gönderme onayı için not yazmanız gerekir");
      return;
    }
    try {
      setProcessing(quoteId);
      const response = await fetch(`${apiUrl}/api/v1/approvals/${quoteId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: comment.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Onaylama başarısız");
      }

      setSuccess("✅ Tedarikçiye gönderme onayı verildi");
      setActiveApprovalId(null);
      setComment("");
      loadPendingApprovals();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(null);
    }
  }, [apiUrl, authToken, comment, loadPendingApprovals]);

  const handleReject = useCallback(async (quoteId: number) => {
    if (!comment.trim()) {
      setError("Red nedeni yazmanız gerekir");
      return;
    }

    try {
      setProcessing(quoteId);
      const response = await fetch(`${apiUrl}/api/v1/approvals/${quoteId}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Red başarısız");
      }

      setSuccess("✅ Teklif reddedildi");
      setActiveApprovalId(null);
      setComment("");
      loadPendingApprovals();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(null);
    }
  }, [apiUrl, authToken, comment, loadPendingApprovals]);

  if (loading) {
    return <Container>Yükleniyor...</Container>;
  }

  return (
    <Container>
      <Header>
        <h2>📋 Onay Bekleyen Teklifler</h2>
        <p>
          {approvals.length} teklif onay beklemektedir
        </p>
      </Header>

      {error && <ErrorMessage>❌ {error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {approvals.length === 0 ? (
        <EmptyState>
          <p>✅ Onay bekleyen teklif yok</p>
        </EmptyState>
      ) : (
        approvals.map((approval) => (
          <Card key={approval.approval_id}>
            <CardHeader>
              <div>
                <CardTitle>{approval.quote_title}</CardTitle>
                <p style={{ margin: "5px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
                  {approval.company_name}
                </p>
              </div>
              <StatusBadge status={approval.quote_status}>
                {approval.quote_status || "PENDING"}
              </StatusBadge>
            </CardHeader>

            <Details>
              <DetailItem>
                <strong>Toplam Tutar</strong>
                <span>
                  ₺{approval.total_amount.toLocaleString("tr-TR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </DetailItem>
              <DetailItem>
                <strong>Onay Seviyesi</strong>
                <span>
                  {approval.approval_level === 1 ? "🔷 Yönetici" : "🔶 Direktör"}
                </span>
              </DetailItem>
              <DetailItem>
                <strong>İstek Tarihi</strong>
                <span>
                  {new Date(approval.requested_at).toLocaleDateString("tr-TR")}
                </span>
              </DetailItem>
              <DetailItem>
                <strong>Oluşturulma</strong>
                <span>
                  {new Date(approval.created_at).toLocaleDateString("tr-TR")}
                </span>
              </DetailItem>
            </Details>

            {activeApprovalId === approval.approval_id ? (
              <>
                <CommentBox
                  placeholder="Onay veya tekrar gözden geçirme notunu yazınız (zorunlu)..."
                  value={comment}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                />
                <Actions>
                  <Button
                    variant="success"
                    onClick={() => handleApprove(approval.quote_id)}
                    disabled={processing !== null}
                  >
                    {processing === approval.quote_id ? "⏳ İşleniyor..." : "✅ Tedarikçiye Gönder Onayı Ver"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleReject(approval.quote_id)}
                    disabled={processing !== null}
                  >
                    {processing === approval.quote_id ? "⏳ İşleniyor..." : "❌ Teklifi Tekrar Gözden Geçirin"}
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveApprovalId(null);
                      setComment("");
                    }}
                    style={{ backgroundColor: "#6b7280" }}
                  >
                    İptal
                  </Button>
                </Actions>
              </>
            ) : (
              <button
                onClick={() => setActiveApprovalId(approval.approval_id)}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "12px",
                  fontWeight: 600,
                  color: "#1f2937",
                }}
              >
                Karar Ver →
              </button>
            )}
          </Card>
        ))
      )}
    </Container>
  );
}
