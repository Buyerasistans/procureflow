import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DiscoveryLab from '../pages/DiscoveryLab';
import { getProjects } from '../services/admin.service';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, email: 'test@test.com', role: 'admin', system_role: 'tenant_admin' }, loading: false }),
}));

vi.mock('../services/admin.service', () => ({
  getProjects: vi.fn().mockResolvedValue([
    {
      id: 11,
      name: 'Merkez Projesi',
      code: 'MRK-01',
      is_active: true,
      created_at: '2026-04-15T10:00:00Z',
      updated_at: '2026-04-15T10:00:00Z',
    },
  ]),
  getCommercialRequests: vi.fn().mockResolvedValue([]),
  getSubscriptionAddons: vi.fn().mockResolvedValue([]),

}));

vi.mock('../lib/token', () => ({
  getAccessToken: () => 'token',
}));

const fetchMock = vi.fn();
const alertMock = vi.fn();
const assignMock = vi.fn();
const mockedGetProjects = vi.mocked(getProjects);

function mockConverterHealth(found = true) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      converter_found: found,
      resolver_source: found ? 'default_install:ODA' : 'unavailable',
      executable_name: found ? 'ODAFileConverter.exe' : null,
      request_id: 'health-1',
    }),
  });
}

describe('DiscoveryLab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', alertMock);
    Object.defineProperty(window, 'location', {
      value: { assign: assignMock },
      writable: true,
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    alertMock.mockReset();
    assignMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('yuklenen dosyayi backend analiz endpointine gonderir ve sonucu gosterir', async () => {
    mockConverterHealth();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          session_id: 'session-123',
          metadata: {
            katmanlar: [
              { layer_name: 'PF_DUVAR_ISLAK', total_length: 45.2, unit: 'mt' },
            ],
          },
          bom: [
            { material: 'Su yalitimi harci', quantity: 75, unit: 'kg', source_layer: 'PF_DUVAR_ISLAK' },
            { material: 'Seramik yapistirici', quantity: 120, unit: 'kg', source_layer: 'PF_DUVAR_ISLAK' },
          ],
          ai_report: {
            teknik_analiz: 'Canli analiz tamamlandi.',
            karar_destek_sorulari: [
              { id: 1, soru: 'Zemin yalitimi eklensin mi?', neden: 'Islak hacim tespit edildi.' },
            ],
            recete_onerileri: [
              { kalem: 'Hijyenik Derz', miktar_etkisi: '12 kg' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'session-123', status: 'analyzed', quote_id: null, timeline: [] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'session-123',
          status: 'analyzed',
          quote_id: null,
          timeline: [
            { type: 'bom_selection', title: 'BOM Seçimi Güncellendi', details: { target_key: 'PF_DUVAR_ISLAK-Su yalitimi harci-0', decision: 'deselected' } },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', audit_id: 90 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'session-123',
          status: 'analyzed',
          quote_id: null,
          timeline: [
            {
              type: 'user_answer',
              title: 'Kullanıcı Yanıtı Kaydedildi',
              details: {
                target_key: 'question:1',
                decision: 'needs_review',
                question_text: 'Zemin yalitimi eklensin mi?',
                answer_text: 'Sahada kontrol edelim.',
                rationale: 'Kesit doğrulaması gerekli.',
                actor_email: 'admin@procureflow.dev',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'session-123',
          status: 'analyzed',
          quote_id: null,
          timeline: [
            { type: 'ai_decision', title: 'AI Teknik Kararı Kaydedildi', details: { target_key: 'question:1', decision: 'approved' } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          transfer: { transfer_id: 'DL-TRANSFER1', status: 'queued_for_procurement', quote_id: 77 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'session-123',
          status: 'technical_locked',
          quote_id: 77,
          timeline: [
            { type: 'technical_lock', title: 'Teknik Kilit ve Satın Alma Aktarımı', details: { target_key: 'DL-TRANSFER1', decision: 'confirmed' } },
          ],
        }),
      });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy dxf'], 'ornek.dxf', { type: 'application/dxf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ai-lab/analyze',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/ai-lab/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        body: expect.any(FormData),
      })
    );

    expect(await screen.findByText('Canli analiz tamamlandi.')).toBeInTheDocument();
    expect(screen.getByLabelText('Aktarım Projesi')).toHaveValue('11');
    expect(screen.getAllByText('PF_DUVAR_ISLAK')).toHaveLength(2);
    expect(screen.getByText('Zemin yalitimi eklensin mi?')).toBeInTheDocument();
    expect(screen.getByText('+ Hijyenik Derz')).toBeInTheDocument();
    expect(screen.getByText('BOM Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Katman Grubu')).toBeInTheDocument();
    expect(screen.getByText('2 alt kalem')).toBeInTheDocument();
    expect(screen.getByText('Gizle')).toBeInTheDocument();
    expect(screen.getByText('Su yalitimi harci')).toBeInTheDocument();
    expect(screen.getAllByText('BOM Alt Kalemi')).toHaveLength(2);
    expect(screen.getAllByText('Seçili')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Su yalitimi harci teknik onay'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        'http://localhost:8000/api/v1/ai-lab/bom-selection',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText('Pasif')).toBeInTheDocument();
    expect(screen.getByText('Audit Timeline')).toBeInTheDocument();
    expect(screen.getByText('BOM Seçimi Güncellendi')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Yanıt 1'), { target: { value: 'Sahada kontrol edelim.' } });
    fireEvent.change(screen.getByLabelText('Gerekçe 1'), { target: { value: 'Kesit doğrulaması gerekli.' } });
    fireEvent.click(screen.getByRole('button', { name: /yaniti audit loga kaydet/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        6,
        'http://localhost:8000/api/v1/ai-lab/answer',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText(/Kullanıcı yanıtı audit loga kaydedildi/i)).toBeInTheDocument();
    expect(screen.getByText('Kullanıcı Yanıtı Kaydedildi')).toBeInTheDocument();
    expect(screen.getByText(/Soru: Zemin yalitimi eklensin mi\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Yanıt: Sahada kontrol edelim\./i)).toBeInTheDocument();
    expect(screen.getByText(/Gerekçe: Kesit doğrulaması gerekli\./i)).toBeInTheDocument();
    expect(screen.getByText(/Aktör E-postası: admin@procureflow.dev/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EVET' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        8,
        'http://localhost:8000/api/v1/ai-lab/decision',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText('Karar kaydedildi: Onaylandı')).toBeInTheDocument();
    expect(screen.getByText('AI Teknik Kararı Kaydedildi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /katman grubu.*pf_duvar_islak.*gizle/i }));

    expect(screen.queryByText('Su yalitimi harci')).not.toBeInTheDocument();
    expect(screen.getByText('Göster')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/aktarım tamamlanınca oluşan rfq ekranını otomatik aç/i));

    fireEvent.click(screen.getByRole('button', { name: 'KEŞFİ ONAYLA VE AKTAR' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        10,
        'http://localhost:8000/api/v1/ai-lab/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            session_id: 'session-123',
            project_id: 11,
            selected_bom_item_keys: ['PF_DUVAR_ISLAK-Seramik yapistirici-1'],
          }),
        })
      );
    });
    expect(await screen.findByText(/Teknik kilit atıldı ve satın alma aktarımı kuyruğa alındı: DL-TRANSFER1/i)).toBeInTheDocument();
    expect(await screen.findByText('Teknik Kilit ve Satın Alma Aktarımı')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /oluşan rfq'yu aç/i })).toHaveAttribute('href', '/quotes/77');
    expect(assignMock).toHaveBeenCalledWith('/quotes/77');
    expect(localStorage.getItem('pf_discovery_lab_auto_open_quote')).toBe('true');
  });

  it('dosya islenirken kullaniciya belirgin ilerleme durumu gosterir', async () => {
    mockConverterHealth();
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['large dwg'], 'buyuk-proje.dwg', { type: 'application/acad' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Analiz devam ediyor...')).toBeInTheDocument();
    expect(screen.getAllByText('Dosya sunucuya aktarılıyor...')).toHaveLength(2);
    expect(screen.getByText('İşlem devam ediyor')).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('aktif proje yoksa aktarimda otomatik Discovery Lab projesi kullanir', async () => {
    mockedGetProjects.mockResolvedValueOnce([]);
    mockConverterHealth();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          session_id: 'session-auto-project',
          metadata: {
            katmanlar: [
              { layer_name: 'PF_DUVAR', total_length: 12, unit: 'mt' },
            ],
          },
          bom: [],
          ai_report: {
            teknik_analiz: 'Analiz tamamlandı.',
            karar_destek_sorulari: [],
            recete_onerileri: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'session-auto-project', status: 'analyzed', quote_id: null, timeline: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          transfer: { transfer_id: 'DL-AUTO', status: 'queued_for_procurement', quote_id: 88 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'session-auto-project',
          status: 'technical_locked',
          quote_id: 88,
          timeline: [
            { type: 'technical_lock', title: 'Teknik Kilit ve Satın Alma Aktarımı', details: { target_key: 'DL-AUTO', decision: 'confirmed' } },
          ],
        }),
      });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['dxf'], 'auto.dxf', { type: 'application/dxf' })] } });

    expect(await screen.findByText('Otomatik Discovery Lab projesi oluşturulacak')).toBeInTheDocument();
    expect(screen.getByText(/varsayılan Discovery Lab projesi otomatik oluşturulacak/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'KEŞFİ ONAYLA VE AKTAR' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/ai-lab/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            session_id: 'session-auto-project',
            project_id: null,
            selected_bom_item_keys: [],
          }),
        })
      );
    });
    expect(await screen.findByText(/Teknik kilit atıldı ve satın alma aktarımı kuyruğa alındı: DL-AUTO/i)).toBeInTheDocument();
  });

  it('backend hata döndürdüğünde kullanıcıya güvenli mesaj gösterir', async () => {
    mockConverterHealth(false);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: {
          code: 'UNSUPPORTED_CAD_EXTENSION',
          message: 'Yalnızca .dwg veya .dxf dosyaları desteklenir.',
          request_id: 'req-1',
        },
      }),
    });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['invalid'], 'ornek.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Yalnızca .dwg veya .dxf dosyaları desteklenir. Referans: req-1')
    ).toBeInTheDocument();
    expect(screen.queryByText('KEŞFİ ONAYLA VE AKTAR')).toBeInTheDocument();
  });

  it('raw teknik hata detayını kullanıcıya göstermez', async () => {
    mockConverterHealth();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: "Ayrıntı: name '_resolve_oda_executable' is not defined",
      }),
    });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dwg'], 'ornek.dwg', { type: 'application/acad' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Dosya analizi tamamlanamadı. Lütfen dosyayı kontrol edip tekrar deneyin.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/_resolve_oda_executable/i)).not.toBeInTheDocument();
  });

  it('otomatik rfq açma tercihini localStorage üzerinden yükler', async () => {
    localStorage.setItem('pf_discovery_lab_auto_open_quote', 'true');
    mockConverterHealth();

    render(<DiscoveryLab />);

    expect(await screen.findByLabelText(/aktarım tamamlanınca oluşan rfq ekranını otomatik aç/i)).toBeChecked();
  });
});
