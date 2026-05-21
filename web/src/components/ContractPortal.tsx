import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Loader, Download, Eye, FileText } from 'lucide-react';
import { getAccessToken } from '../lib/token';
import './ContractPortal.css';

const Container = styled.div`
  padding: 20px;
`;

const Header = styled.div`
  margin-bottom: 30px;
  
  h2 {
    color: #1a1a1a;
    margin-bottom: 10px;
  }
  
  p {
    color: #666;
    font-size: 14px;
  }
`;

const ContractsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const ContractCard = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #1a73e8;
    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.15);
  }
`;

const ContractNumber = styled.div`
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
  font-size: 14px;
`;

const ContractInfo = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
  font-size: 13px;
`;

const InfoItem = styled.div`
  p {
    color: #666;
    margin: 0 0 4px 0;
    font-size: 12px;
  }
  
  strong {
    color: #1a1a1a;
    display: block;
  }
`;

const PriceInfo = styled.div`
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 15px;
  
  div {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    
    &:last-child {
      margin-bottom: 0;
      border-top: 1px solid #e0e0e0;
      padding-top: 8px;
      margin-top: 8px;
      font-weight: 600;
      color: #1a73e8;
    }
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    switch (props.$status) {
      case 'generated':
        return '#e3f2fd';
      case 'sent':
        return '#fff3e0';
      case 'signed':
        return '#e8f5e9';
      default:
        return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'generated':
        return '#1a73e8';
      case 'sent':
        return '#e65100';
      case 'signed':
        return '#2e7d32';
      default:
        return '#616161';
    }
  }};
  margin-bottom: 12px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1;
  min-width: 80px;
  padding: 8px 12px;
  border: 1px solid ${props => props.$variant === 'primary' ? '#1a73e8' : '#e0e0e0'};
  background: ${props => props.$variant === 'primary' ? '#1a73e8' : 'white'};
  color: ${props => props.$variant === 'primary' ? 'white' : '#1a1a1a'};
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.3s ease;
  
  &:hover {
    ${props => props.$variant === 'primary' 
      ? 'background: #1557b0; border-color: #1557b0;'
      : 'background: #f5f5f5; border-color: #1a73e8;'
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GenerateButton = styled.button`
  padding: 12px 24px;
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  
  &:hover {
    background: #1557b0;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #999;
  
  p {
    margin-bottom: 20px;
    font-size: 14px;
  }
`;

interface Contract {
  id: number;
  contract_number: string;
  contract_type: string;
  total_amount: number;
  final_amount: number;
  status: 'generated' | 'sent' | 'signed';
  delivery_date?: string;
  payment_terms?: string;
  warranty_period?: string;
  signed_at?: string;
  pdf_file_path?: string;
}

interface ContractPortalProps {
  quoteId: number;
  supplierId: number;
  supplierName: string;
}

export const ContractPortal: React.FC<ContractPortalProps> = ({ 
  quoteId, 
  supplierId,
  supplierName 
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/contracts/quote/${quoteId}/contracts`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setContracts(data);
      }
    } catch (error) {
      console.error('Sözleşmeler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (quoteId) {
      loadContracts();
    }
  }, [quoteId, loadContracts]);

  const handleGenerateContract = async () => {
    try {
      setGenerating(true);
      const token = getAccessToken();
      
      const response = await fetch(
        `http://localhost:8000/api/v1/contracts/${quoteId}/${supplierId}/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            contract_type: 'purchase',
            payment_terms: 'Net 30',
            delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            warranty_period: '12 ay',
            notes: `${supplierName} ile yapılan sözleşme`
          })
        }
      );
      
      if (response.ok) {
        await loadContracts();
        alert('✓ Sözleşme başarıyla oluşturuldu');
      } else {
        alert('✗ Sözleşme oluşturulamadı');
      }
    } catch (error) {
      console.error('Sözleşme oluşturma hatası:', error);
      alert('✗ Hata: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async (contractId: number, contractNumber: string) => {
    try {
      const token = getAccessToken();
      const response = await fetch(
        `http://localhost:8000/api/v1/contracts/${contractId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${contractNumber}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('PDF indirme hatası:', error);
    }
  };

  const handleSignContract = async (contractId: number) => {
    if (window.confirm('Sözleşmeyi imzalamak istediğinize emin misiniz?')) {
      try {
        const token = getAccessToken();
        const response = await fetch(
          `http://localhost:8000/api/v1/contracts/${contractId}/sign`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({})
          }
        );
        
        if (response.ok) {
          await loadContracts();
          alert('✓ Sözleşme başarıyla imzalandı');
        }
      } catch (error) {
        console.error('İmza hatası:', error);
      }
    }
  };

  return (
    <Container>
      <Header>
        <div className="contract-portal__header-row">
          <div>
            <h2>📄 Sözleşme Yönetimi</h2>
            <p>{supplierName} ile yapılan satın alma sözleşmeleri</p>
          </div>
          <GenerateButton 
            onClick={handleGenerateContract}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader size={16} className="animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <FileText size={16} />
                Sözleşme Oluştur
              </>
            )}
          </GenerateButton>
        </div>
      </Header>

      {loading ? (
        <div className="contract-portal__loading-state">
          <Loader size={32} className="animate-spin contract-portal__loading-icon" />
          <p>Sözleşmeler yükleniyor...</p>
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState>
          <FileText size={48} className="contract-portal__empty-icon" />
          <p>Henüz sözleşme oluşturulmamıştır</p>
        </EmptyState>
      ) : (
        <ContractsGrid>
          {contracts.map(contract => (
            <ContractCard key={contract.id}>
              <ContractNumber>{contract.contract_number}</ContractNumber>
              
              <StatusBadge $status={contract.status}>
                {contract.status === 'signed' ? '✓ İmzalı' : 
                 contract.status === 'sent' ? '📤 Gönderildi' :
                 '📋 Oluşturuldu'}
              </StatusBadge>

              <ContractInfo>
                <InfoItem>
                  <p>Toplam Tutar</p>
                  <strong>₺{contract.total_amount.toLocaleString('tr-TR')}</strong>
                </InfoItem>
                <InfoItem>
                  <p>Nihai Tutar</p>
                  <strong>₺{contract.final_amount.toLocaleString('tr-TR')}</strong>
                </InfoItem>
                <InfoItem>
                  <p>Teslimat Tarihi</p>
                  <strong>
                    {contract.delivery_date 
                      ? new Date(contract.delivery_date).toLocaleDateString('tr-TR')
                      : '-'
                    }
                  </strong>
                </InfoItem>
                <InfoItem>
                  <p>Garanti Süresi</p>
                  <strong>{contract.warranty_period || '-'}</strong>
                </InfoItem>
              </ContractInfo>

              <PriceInfo>
                <div>
                  <span>Sipariş Tutarı:</span>
                  <span>₺{contract.total_amount.toLocaleString('tr-TR')}</span>
                </div>
                <div>
                  <span>İndirim:</span>
                  <span>-₺{(contract.total_amount - contract.final_amount).toLocaleString('tr-TR')}</span>
                </div>
                <div>
                  <span>Sözleşme Tutarı:</span>
                  <span>₺{contract.final_amount.toLocaleString('tr-TR')}</span>
                </div>
              </PriceInfo>

              <ActionButtons>
                <Button 
                  $variant="secondary"
                  onClick={() => handleDownloadPDF(contract.id, contract.contract_number)}
                  title="PDF'i indir"
                >
                  <Download size={14} />
                  <span>İndir</span>
                </Button>
                {contract.status !== 'signed' && (
                  <Button 
                    $variant="primary"
                    onClick={() => handleSignContract(contract.id)}
                    title="Sözleşmeyi imzala"
                  >
                    <Eye size={14} />
                    <span>İmzala</span>
                  </Button>
                )}
              </ActionButtons>

              {contract.signed_at && (
                <div className="contract-portal__signed-note">
                  ✓ Imzalama Tarihi: {new Date(contract.signed_at).toLocaleString('tr-TR')}
                </div>
              )}
            </ContractCard>
          ))}
        </ContractsGrid>
      )}
    </Container>
  );
};

export default ContractPortal;
