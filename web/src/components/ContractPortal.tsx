import React, { useState, useEffect, useCallback } from 'react';
import { Loader, Download, Eye, FileText } from 'lucide-react';
import { getAccessToken } from '../lib/token';
import './ContractPortal.css';

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
    <div className="cp-container">
      <div className="cp-header">
        <div className="contract-portal__header-row">
          <div>
            <h2>📄 Sözleşme Yönetimi</h2>
            <p>{supplierName} ile yapılan satın alma sözleşmeleri</p>
          </div>
          <button
            type="button"
            className="cp-generate-btn"
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
          </button>
        </div>
      </div>

      {loading ? (
        <div className="contract-portal__loading-state">
          <Loader size={32} className="animate-spin contract-portal__loading-icon" />
          <p>Sözleşmeler yükleniyor...</p>
        </div>
      ) : contracts.length === 0 ? (
        <div className="cp-empty">
          <FileText size={48} className="contract-portal__empty-icon" />
          <p>Henüz sözleşme oluşturulmamıştır</p>
        </div>
      ) : (
        <div className="cp-grid">
          {contracts.map(contract => (
            <div className="cp-card" key={contract.id}>
              <div className="cp-card__number">{contract.contract_number}</div>

              <span className={`cp-badge cp-badge--${contract.status}`}>
                {contract.status === 'signed' ? '✓ İmzalı' :
                 contract.status === 'sent' ? '📤 Gönderildi' :
                 '📋 Oluşturuldu'}
              </span>

              <div className="cp-card__info">
                <div className="cp-info-item">
                  <p>Toplam Tutar</p>
                  <strong>₺{contract.total_amount.toLocaleString('tr-TR')}</strong>
                </div>
                <div className="cp-info-item">
                  <p>Nihai Tutar</p>
                  <strong>₺{contract.final_amount.toLocaleString('tr-TR')}</strong>
                </div>
                <div className="cp-info-item">
                  <p>Teslimat Tarihi</p>
                  <strong>
                    {contract.delivery_date
                      ? new Date(contract.delivery_date).toLocaleDateString('tr-TR')
                      : '-'
                    }
                  </strong>
                </div>
                <div className="cp-info-item">
                  <p>Garanti Süresi</p>
                  <strong>{contract.warranty_period || '-'}</strong>
                </div>
              </div>

              <div className="cp-price-info">
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
              </div>

              <div className="cp-actions">
                <button
                  type="button"
                  className="cp-btn"
                  onClick={() => handleDownloadPDF(contract.id, contract.contract_number)}
                  title="PDF'i indir"
                >
                  <Download size={14} />
                  <span>İndir</span>
                </button>
                {contract.status !== 'signed' && (
                  <button
                    type="button"
                    className="cp-btn cp-btn--primary"
                    onClick={() => handleSignContract(contract.id)}
                    title="Sözleşmeyi imzala"
                  >
                    <Eye size={14} />
                    <span>İmzala</span>
                  </button>
                )}
              </div>

              {contract.signed_at && (
                <div className="contract-portal__signed-note">
                  ✓ Imzalama Tarihi: {new Date(contract.signed_at).toLocaleString('tr-TR')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractPortal;
