import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DiscoveryLab from '../pages/DiscoveryLab';

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
}));

vi.mock('../lib/token', () => ({
  getAccessToken: () => 'token',
}));

const fetchMock = vi.fn();
const alertMock = vi.fn();
const assignMock = vi.fn();

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
            { type: 'bom_selection', title: 'BOM Secimi Guncellendi', details: { target_key: 'PF_DUVAR_ISLAK-Su yalitimi harci-0', decision: 'deselected' } },
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
              title: 'Kullanici Yaniti Kaydedildi',
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
            { type: 'ai_decision', title: 'AI Teknik Karari Kaydedildi', details: { target_key: 'question:1', decision: 'approved' } },
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
            { type: 'technical_lock', title: 'Teknik Kilit ve Satin Alma Aktarimi', details: { target_key: 'DL-TRANSFER1', decision: 'confirmed' } },
          ],
        }),
      });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy dxf'], 'ornek.dxf', { type: 'application/dxf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
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
    expect(screen.getByLabelText('Aktarim Projesi')).toHaveValue('11');
    expect(screen.getAllByText('PF_DUVAR_ISLAK')).toHaveLength(2);
    expect(screen.getByText('Zemin yalitimi eklensin mi?')).toBeInTheDocument();
    expect(screen.getByText('+Hijyenik Derz')).toBeInTheDocument();
    expect(screen.getByText('BOM Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Katman Grubu')).toBeInTheDocument();
    expect(screen.getByText('2 alt kalem')).toBeInTheDocument();
    expect(screen.getByText('Gizle')).toBeInTheDocument();
    expect(screen.getByText('Su yalitimi harci')).toBeInTheDocument();
    expect(screen.getAllByText('BOM Alt Kalemi')).toHaveLength(2);
    expect(screen.getAllByText('Secili')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Su yalitimi harci teknik onay'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'http://localhost:8000/api/v1/ai-lab/bom-selection',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText('Pasif')).toBeInTheDocument();
    expect(screen.getByText('Audit Timeline')).toBeInTheDocument();
    expect(screen.getByText('BOM Secimi Guncellendi')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Yanıt 1'), { target: { value: 'Sahada kontrol edelim.' } });
    fireEvent.change(screen.getByLabelText('Gerekce 1'), { target: { value: 'Kesit doğrulaması gerekli.' } });
    fireEvent.click(screen.getByRole('button', { name: /yaniti audit loga kaydet/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
        'http://localhost:8000/api/v1/ai-lab/answer',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText(/Kullanici yaniti audit loga kaydedildi/i)).toBeInTheDocument();
    expect(screen.getByText('Kullanici Yaniti Kaydedildi')).toBeInTheDocument();
    expect(screen.getByText(/Soru: Zemin yalitimi eklensin mi\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Yanit: Sahada kontrol edelim\./i)).toBeInTheDocument();
    expect(screen.getByText(/Gerekce: Kesit doğrulaması gerekli\./i)).toBeInTheDocument();
    expect(screen.getByText(/Aktor E-postasi: admin@procureflow.dev/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EVET' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        7,
        'http://localhost:8000/api/v1/ai-lab/decision',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(screen.getByText('Karar kaydedildi: Onaylandi')).toBeInTheDocument();
    expect(screen.getByText('AI Teknik Karari Kaydedildi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /katman grubu.*pf_duvar_islak.*gizle/i }));

    expect(screen.queryByText('Su yalitimi harci')).not.toBeInTheDocument();
    expect(screen.getByText('Goster')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/aktarim tamamlaninca olusan rfq ekranini otomatik ac/i));

    fireEvent.click(screen.getByRole('button', { name: 'KEŞFİ ONAYLA VE AKTAR' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        9,
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
    expect(screen.getByText(/Teknik kilit atildi ve satin alma aktarimi kuyruga alindi: DL-TRANSFER1/i)).toBeInTheDocument();
    expect(screen.getByText('Teknik Kilit ve Satin Alma Aktarimi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /olusan rfq'yu ac/i })).toHaveAttribute('href', '/quotes/77');
    expect(assignMock).toHaveBeenCalledWith('/quotes/77');
    expect(localStorage.getItem('pf_discovery_lab_auto_open_quote')).toBe('true');
  });

  it('backend hata dondurdugunde kullaniciya mesaj gosterir', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: 'Yalnizca .dwg veya .dxf dosyalari desteklenir',
      }),
    });

    const { container } = render(<DiscoveryLab />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['invalid'], 'ornek.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText('Yalnizca .dwg veya .dxf dosyalari desteklenir')
    ).toBeInTheDocument();
    expect(screen.queryByText('KEŞFİ ONAYLA VE AKTAR')).toBeInTheDocument();
  });

  it('otomatik rfq acma tercihini localStorage uzerinden yukler', async () => {
    localStorage.setItem('pf_discovery_lab_auto_open_quote', 'true');

    render(<DiscoveryLab />);

    expect(await screen.findByLabelText(/aktarim tamamlaninca olusan rfq ekranini otomatik ac/i)).toBeChecked();
  });
});