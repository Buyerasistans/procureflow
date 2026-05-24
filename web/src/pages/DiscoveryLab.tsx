import React, { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, MessageSquare, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { getProjects } from '../services/admin.service';
import { getAccessToken } from '../lib/token';
import type { Project } from '../services/admin.service';
import { useAuth } from '../hooks/useAuth';
import { getRoleIcon, getUserDisplayRoleLabel, normalizedBusinessRole } from '../auth/permissions';
import WorkspaceHeroCard from '../components/WorkspaceHeroCard';

// --- TİPLEMELER ---
interface DiscoveryItem {
  layer_name: string;
  total_length: number;
  unit: string;
}

interface AIDecisionQuestion {
  id: number;
  soru: string;
  neden: string;
}

type AnswerDecisionState = 'approved' | 'ignored' | 'needs_review';

interface AIRecipeSuggestion {
  kalem: string;
  miktar_etkisi: string;
}

interface BOMItem {
  material: string;
  quantity: number;
  unit: string;
  source_layer: string;
}

type BOMSelectionState = Record<string, boolean>;

interface AnalysisResponse {
  status: string;
  session_id?: string;
  metadata: {
    katmanlar?: DiscoveryItem[];
  };
  bom?: BOMItem[];
  ai_report: {
    teknik_analiz: string;
    karar_destek_sorulari: AIDecisionQuestion[];
    recete_onerileri?: AIRecipeSuggestion[];
  };
}

interface DiscoveryTimelineEvent {
  timestamp?: string;
  type: string;
  title: string;
  actor?: string;
  details?: Record<string, unknown>;
}

interface DiscoveryTimelineResponse {
  session_id: string;
  status: string;
  quote_id?: number | null;
  timeline: DiscoveryTimelineEvent[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const AUTO_OPEN_QUOTE_PREFERENCE_KEY = 'pf_discovery_lab_auto_open_quote';

function buildAuthHeaders(contentType?: string) {
  const token = getAccessToken();
  return {
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getErrorMessage(detail: unknown) {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  return 'Dosya analizi tamamlanamadi. Lutfen dosyayi kontrol edip tekrar deneyin.';
}

const DiscoveryLab: React.FC = () => {
  const { user } = useAuth();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [decisionState, setDecisionState] = useState<Record<number, 'approved' | 'ignored' | null>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [answerRationales, setAnswerRationales] = useState<Record<number, string>>({});
  const [answerDecisionState, setAnswerDecisionState] = useState<Record<number, AnswerDecisionState>>({});
  const [answerSavedState, setAnswerSavedState] = useState<Record<number, boolean>>({});
  const [savingAnswerQuestionId, setSavingAnswerQuestionId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<DiscoveryTimelineEvent[]>([]);
  const [collapsedBomGroups, setCollapsedBomGroups] = useState<Record<string, boolean>>({});
  const [selectedBomItems, setSelectedBomItems] = useState<BOMSelectionState>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [transferQuoteId, setTransferQuoteId] = useState<number | null>(null);
  const [autoOpenQuoteAfterTransfer, setAutoOpenQuoteAfterTransfer] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(AUTO_OPEN_QUOTE_PREFERENCE_KEY) === 'true';
  });
  const analysisLayers = analysisResult?.metadata.katmanlar ?? [];
  const bomItems = analysisResult?.bom ?? [];
  const groupedBomItems = bomItems.reduce<Record<string, BOMItem[]>>((groups, item) => {
    const sourceLayer = item.source_layer || 'TANIMSIZ_KATMAN';
    groups[sourceLayer] = groups[sourceLayer] ?? [];
    groups[sourceLayer].push(item);
    return groups;
  }, {});

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        setProjectsLoading(true);
        const nextProjects = await getProjects();
        if (cancelled) {
          return;
        }
        const activeProjects = nextProjects.filter((project) => project.is_active);
        setProjects(activeProjects);
        setSelectedProjectId((current) => current ?? activeProjects[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(AUTO_OPEN_QUOTE_PREFERENCE_KEY, String(autoOpenQuoteAfterTransfer));
  }, [autoOpenQuoteAfterTransfer]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);
    setActionNotice(null);
    setAnalysisResult(null);
    setCollapsedBomGroups({});
    setSelectedBomItems({});
    setDecisionState({});
    setAnswerDrafts({});
    setAnswerRationales({});
    setAnswerDecisionState({});
    setAnswerSavedState({});
    setTimeline([]);
    setTransferQuoteId(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/analyze`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
      });

      const payload = (await response.json()) as AnalysisResponse | { detail?: unknown };

      if (!response.ok) {
        throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
      }

      const normalizedPayload: AnalysisResponse = {
        ...(payload as AnalysisResponse),
        metadata: {
          katmanlar: (payload as AnalysisResponse).metadata?.katmanlar ?? [],
        },
        bom: (payload as AnalysisResponse).bom ?? [],
        ai_report: {
          ...(payload as AnalysisResponse).ai_report,
          karar_destek_sorulari: (payload as AnalysisResponse).ai_report?.karar_destek_sorulari ?? [],
          recete_onerileri: (payload as AnalysisResponse).ai_report?.recete_onerileri ?? [],
        },
      };

      const defaultSelectionState = ((payload as AnalysisResponse).bom ?? []).reduce<BOMSelectionState>((selection, item, index) => {
        selection[`${item.source_layer}-${item.material}-${index}`] = true;
        return selection;
      }, {});

      setAnalysisResult(normalizedPayload);
      setSelectedBomItems(defaultSelectionState);
      setDecisionState(
        ((payload as AnalysisResponse).ai_report?.karar_destek_sorulari ?? []).reduce<Record<number, 'approved' | 'ignored' | null>>((map, question) => {
          map[question.id] = null;
          return map;
        }, {})
      );
      setAnswerDecisionState(
        ((payload as AnalysisResponse).ai_report?.karar_destek_sorulari ?? []).reduce<Record<number, AnswerDecisionState>>((map, question) => {
          map[question.id] = 'needs_review';
          return map;
        }, {})
      );
      if (normalizedPayload.session_id) {
        const timelineResponse = await fetch(`${API_BASE_URL}/api/v1/ai-lab/${normalizedPayload.session_id}/timeline`, {
          headers: buildAuthHeaders(),
        });
        const timelinePayload = (await timelineResponse.json()) as DiscoveryTimelineResponse | { detail?: unknown };
        if (timelineResponse.ok) {
          setTransferQuoteId((timelinePayload as DiscoveryTimelineResponse).quote_id ?? null);
          setTimeline((timelinePayload as DiscoveryTimelineResponse).timeline ?? []);
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const persistBomSelection = async (itemKey: string, nextValue: boolean) => {
    if (!analysisResult?.session_id) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/bom-selection`, {
      method: 'POST',
      headers: buildAuthHeaders('application/json'),
      body: JSON.stringify({
        session_id: analysisResult.session_id,
        item_key: itemKey,
        selected: nextValue,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
    }
  };

  const refreshTimeline = async (sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/${sessionId}/timeline`, {
      headers: buildAuthHeaders(),
    });
    const payload = (await response.json()) as DiscoveryTimelineResponse | { detail?: unknown };
    if (!response.ok) {
      throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
    }
    setTransferQuoteId((payload as DiscoveryTimelineResponse).quote_id ?? null);
    setTimeline((payload as DiscoveryTimelineResponse).timeline ?? []);
  };

  const handleConfirm = async () => {
    if (!analysisResult?.session_id) {
      return;
    }
    if (!selectedProjectId) {
      setUploadError('Discovery Lab aktarimi icin once aktif bir proje secin.');
      return;
    }

    setIsConfirming(true);
    setUploadError(null);
    try {
      const selectedBomItemKeys = Object.entries(selectedBomItems)
        .filter(([, isSelected]) => isSelected)
        .map(([itemKey]) => itemKey);

      const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/confirm`, {
        method: 'POST',
        headers: buildAuthHeaders('application/json'),
        body: JSON.stringify({
          session_id: analysisResult.session_id,
          project_id: selectedProjectId,
          selected_bom_item_keys: selectedBomItemKeys,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
      }

      const transferId = (payload as { transfer?: { transfer_id?: string } }).transfer?.transfer_id;
      const quoteId = (payload as { transfer?: { quote_id?: number } }).transfer?.quote_id ?? null;
      setTransferQuoteId(quoteId);
      await refreshTimeline(analysisResult.session_id);
      setActionNotice(transferId ? `Teknik kilit atildi ve satin alma aktarimi kuyruga alindi: ${transferId}` : 'Teknik kilit atildi ve satin alma aktarimi baslatildi.');
      if (quoteId && autoOpenQuoteAfterTransfer && typeof window !== 'undefined') {
        window.location.assign(`/quotes/${quoteId}`);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleBomGroup = (sourceLayer: string) => {
    setCollapsedBomGroups((current) => ({
      ...current,
      [sourceLayer]: !current[sourceLayer],
    }));
  };

  const toggleBomItem = async (itemKey: string) => {
    const nextValue = !(selectedBomItems[itemKey] ?? false);
    setSelectedBomItems((current) => ({
      ...current,
      [itemKey]: nextValue,
    }));

    try {
      await persistBomSelection(itemKey, nextValue);
      if (analysisResult?.session_id) {
        await refreshTimeline(analysisResult.session_id);
      }
      setActionNotice(`BOM secimi guncellendi: ${itemKey}`);
    } catch (error) {
      setSelectedBomItems((current) => ({
        ...current,
        [itemKey]: !nextValue,
      }));
      setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
    }
  };

  const submitDecision = async (questionId: number, decision: 'approved' | 'ignored') => {
    if (!analysisResult?.session_id) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/decision`, {
        method: 'POST',
        headers: buildAuthHeaders('application/json'),
        body: JSON.stringify({
          session_id: analysisResult.session_id,
          question_id: questionId,
          decision,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
      }

      setDecisionState((current) => ({
        ...current,
        [questionId]: decision,
      }));
      await refreshTimeline(analysisResult.session_id);
      setActionNotice(decision === 'approved' ? `AI karari onaylandi: Soru ${questionId}` : `AI karari yoksayildi: Soru ${questionId}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
    }
  };

  const submitAnswer = async (question: AIDecisionQuestion) => {
    if (!analysisResult?.session_id) {
      return;
    }

    const answerText = (answerDrafts[question.id] || '').trim();
    if (!answerText) {
      setUploadError('Kullanıcı yanıtı boş bırakılamaz.');
      return;
    }

    try {
      setSavingAnswerQuestionId(question.id);
      setUploadError(null);
      const response = await fetch(`${API_BASE_URL}/api/v1/ai-lab/answer`, {
        method: 'POST',
        headers: buildAuthHeaders('application/json'),
        body: JSON.stringify({
          session_id: analysisResult.session_id,
          question_id: question.id,
          question_text: question.soru,
          answer_text: answerText,
          decision: answerDecisionState[question.id] || 'needs_review',
          rationale: answerRationales[question.id] || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage((payload as { detail?: unknown }).detail));
      }

      setAnswerSavedState((current) => ({ ...current, [question.id]: true }));
      await refreshTimeline(analysisResult.session_id);
      setActionNotice(`Kullanıcı yanıtı kaydedildi: Soru ${question.id}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : getErrorMessage(null));
    } finally {
      setSavingAnswerQuestionId(null);
    }
  };

  return (
    <div className="bg-gray-50">
      <div className="px-4 pt-4">
        <WorkspaceHeroCard
          title="AI Keşif Laboratuvarı"
          subtitle={`${getRoleIcon(normalizedBusinessRole(user))} Platform Super Admin • ${user ? getUserDisplayRoleLabel(user) : ""}`}
          userName={user?.full_name || user?.email || "-"}
          userEmail={user?.email || ""}
          eyebrow="Platform Yönetim Alanı"
        />
      </div>
      <div className="flex h-[calc(100vh-180px)] overflow-hidden">
      {/* SOL PANEL: KEŞİF LİSTESİ */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Bilişsel Keşif Laboratuvarı</h2>
          {analysisResult && !actionNotice && (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
              <CheckCircle2 size={14} />
              AI TEKNİK ONAYLI
            </div>
          )}
          {actionNotice && (
            <div className="flex items-center gap-3">
              <div className="max-w-sm rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                {actionNotice}
              </div>
              {transferQuoteId ? (
                <a
                  href={`/quotes/${transferQuoteId}`}
                  className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700"
                >
                  Olusan RFQ'yu Ac
                </a>
              ) : null}
            </div>
          )}
        </div>

        {!analysisResult ? (
          <div className="border-3 border-dashed border-gray-300 rounded-2xl h-96 flex flex-col items-center justify-center bg-white transition-all hover:border-blue-400">
            <div className="p-6 bg-blue-50 rounded-full mb-4">
              <Upload size={48} className={isUploading ? "animate-bounce text-blue-500" : "text-blue-400"} />
            </div>
            <p className="text-gray-500 font-medium">
              {isUploading ? "Analiz Ediliyor..." : "Mimari Projeyi (DWG/DXF) Yükleyin"}
            </p>
            {uploadError && (
              <div className="mt-4 max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700">
                {uploadError}
              </div>
            )}
            <input
              type="file"
              aria-label="Mimari proje dosyasi yukleyin"
              className="mt-4 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              onChange={handleFileUpload}
              accept=".dwg,.dxf"
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Teknik Katman Özeti</h3>
                  <p className="text-xs text-gray-500">CAD dosyasindan cikarilan ana metraj katmanlari</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>Aktarim Projesi</span>
                    <select
                      value={selectedProjectId ?? ''}
                      onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : null)}
                      disabled={projectsLoading || projects.length === 0}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      aria-label="Aktarim Projesi"
                    >
                      {projects.length === 0 ? <option value="">Proje bulunamadi</option> : null}
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {analysisLayers.length} katman
                  </span>
                </div>
              </div>
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-4 px-6 text-sm font-semibold text-gray-600">Teknik Katman</th>
                    <th className="py-4 px-6 text-sm font-semibold text-gray-600">Metraj</th>
                    <th className="py-4 px-6 text-sm font-semibold text-gray-600">Birim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analysisLayers.map((l, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-700">{l.layer_name}</td>
                      <td className="py-4 px-6 text-gray-600">{l.total_length}</td>
                      <td className="py-4 px-6 text-gray-500">{l.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">BOM Visualizer</h3>
                  <p className="text-xs text-gray-500">Reçete motorunun teknik katmanlardan urettigi alt malzeme listesi</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {bomItems.length} kalem
                </span>
              </div>

              {bomItems.length > 0 ? (
                <div className="space-y-4 px-4 py-4">
                  {Object.entries(groupedBomItems).map(([sourceLayer, items]) => (
                    <div key={sourceLayer} className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/40">
                      <button
                        type="button"
                        onClick={() => toggleBomGroup(sourceLayer)}
                        className="flex w-full items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-left"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Katman Grubu</p>
                          <p className="mt-1 text-sm font-semibold text-emerald-950">{sourceLayer}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                            {items.length} alt kalem
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                            {collapsedBomGroups[sourceLayer] ? 'Goster' : 'Gizle'}
                          </span>
                        </div>
                      </button>
                      {!collapsedBomGroups[sourceLayer] && (
                        <div className="divide-y divide-emerald-100 bg-white">
                          {items.map((item, index) => {
                            const itemKey = `${sourceLayer}-${item.material}-${index}`;
                            const isSelected = selectedBomItems[itemKey] ?? false;

                            return (
                              <div key={itemKey} className="grid grid-cols-[auto_1.4fr_1fr_auto_auto] gap-4 px-4 py-4 hover:bg-emerald-50/60 transition-colors">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleBomItem(itemKey)}
                                    aria-label={`${item.material} teknik onay`}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </label>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{item.material}</p>
                                  <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">BOM Alt Kalemi</p>
                                </div>
                                <div className="flex items-center text-sm text-gray-600">{item.quantity}</div>
                                <div className="flex items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600">{item.unit}</div>
                                <div className="flex items-center">
                                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                                    isSelected
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {isSelected ? 'Secili' : 'Pasif'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-sm text-gray-500">
                  Teknik recete icin otomatik BOM kalemi olusmadi.
                </div>
              )}
            </div>

            {timeline.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Audit Timeline</h3>
                    <p className="text-xs text-gray-500">Discovery Lab aksiyonlari ve satin alma aktarim gecmisi</p>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {timeline.length} olay
                  </span>
                </div>
                <div className="space-y-3 px-6 py-4">
                  {timeline.map((event, index) => (
                    <div key={`${event.type}-${event.timestamp || index}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      {(() => {
                        const targetKey = event.details?.target_key;
                        const decision = event.details?.decision;
                        const answerText = typeof event.details?.answer_text === 'string' ? event.details.answer_text : null;
                        const questionText = typeof event.details?.question_text === 'string' ? event.details.question_text : null;
                        const rationale = typeof event.details?.rationale === 'string' ? event.details.rationale : null;
                        const actor = typeof event.details?.actor_email === 'string' ? event.details.actor_email : null;

                        return (
                          <>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{event.type}</p>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString('tr-TR') : '-'}
                        </span>
                      </div>
                      {targetKey !== undefined && targetKey !== null && (
                        <p className="mt-2 text-xs text-slate-600">Hedef: {String(targetKey)}</p>
                      )}
                      {decision !== undefined && decision !== null && (
                        <p className="mt-1 text-xs text-slate-600">Karar: {String(decision)}</p>
                      )}
                      {questionText && (
                        <p className="mt-1 text-xs text-slate-600">Soru: {questionText}</p>
                      )}
                      {answerText && (
                        <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                          Yanit: {answerText}
                        </div>
                      )}
                      {rationale && (
                        <p className="mt-1 text-xs text-slate-600">Gerekce: {rationale}</p>
                      )}
                      {actor && (
                        <p className="mt-1 text-xs text-slate-600">Aktor E-postasi: {actor}</p>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SAĞ PANEL: AI ASİSTAN */}
      <div className="w-1/3 bg-white border-l border-gray-200 shadow-2xl p-6 flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2 mb-8 text-blue-600 border-b pb-4">
          <MessageSquare size={24} />
          <h3 className="font-bold text-lg uppercase tracking-tight">AI Teknik Denetçi</h3>
        </div>

        {!analysisResult ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
            <Info size={40} className="mb-2 opacity-20" />
            <p className="text-sm">Analiz raporu hazırlamak için<br/>dosya yüklemesi bekleniyor.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h4 className="text-blue-800 text-xs font-bold uppercase mb-2">Denetim Özeti</h4>
              <p className="text-sm text-blue-900 leading-relaxed">{analysisResult.ai_report.teknik_analiz}</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-gray-400 text-xs font-bold uppercase">Kritik Bulgular</h4>
              {analysisResult.ai_report.karar_destek_sorulari.map((q) => (
                <div key={q.id} className="bg-white border border-gray-100 shadow-sm p-4 rounded-xl hover:border-amber-300 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 mb-1">{q.soru}</p>
                      <p className="text-[11px] text-gray-500 italic mb-3">Neden: {q.neden}</p>
                      <textarea
                        value={answerDrafts[q.id] || ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setAnswerDrafts((current) => ({ ...current, [q.id]: nextValue }));
                          setAnswerSavedState((current) => ({ ...current, [q.id]: false }));
                        }}
                        placeholder="Mimar veya teknik ekip yanitini kaydet"
                        aria-label={`Yanıt ${q.id}`}
                        className="mb-2 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      />
                      <input
                        value={answerRationales[q.id] || ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setAnswerRationales((current) => ({ ...current, [q.id]: nextValue }));
                          setAnswerSavedState((current) => ({ ...current, [q.id]: false }));
                        }}
                        placeholder="Opsiyonel gerekce"
                        aria-label={`Gerekce ${q.id}`}
                        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      />
                      <div className="mb-3 flex gap-2">
                        {[
                          { key: 'needs_review', label: 'Incelemeye Al' },
                          { key: 'approved', label: 'Yanit + Onay' },
                          { key: 'ignored', label: 'Yanit + Pas' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setAnswerDecisionState((current) => ({ ...current, [q.id]: item.key as AnswerDecisionState }))}
                            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                              (answerDecisionState[q.id] || 'needs_review') === item.key
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitDecision(q.id, 'approved')}
                          className={`flex-1 text-white text-[11px] font-bold py-2 rounded-lg transition-colors shadow ${
                            decisionState[q.id] === 'approved' ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          EVET
                        </button>
                        <button
                          type="button"
                          onClick={() => submitDecision(q.id, 'ignored')}
                          className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-colors ${
                            decisionState[q.id] === 'ignored'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-500'
                          }`}
                        >
                          YOKSAY
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => submitAnswer(q)}
                        disabled={savingAnswerQuestionId === q.id || !(answerDrafts[q.id] || '').trim()}
                        className={`mt-2 w-full rounded-lg py-2 text-[11px] font-bold ${
                          savingAnswerQuestionId === q.id || !(answerDrafts[q.id] || '').trim()
                            ? 'bg-slate-200 text-slate-400'
                            : 'bg-sky-600 text-white hover:bg-sky-700'
                        }`}
                      >
                        {savingAnswerQuestionId === q.id ? 'YANIT KAYDEDILIYOR...' : 'YANITI AUDIT LOGA KAYDET'}
                      </button>
                      {decisionState[q.id] && (
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          {decisionState[q.id] === 'approved' ? 'Karar kaydedildi: Onaylandi' : 'Karar kaydedildi: Yoksayildi'}
                        </p>
                      )}
                      {answerSavedState[q.id] && (
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                          Kullanıcı yanıtı audit loga kaydedildi
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {analysisResult.ai_report.karar_destek_sorulari.length === 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  AI teknik denetimde ek karar sorusu olusmadi.
                </div>
              )}
            </div>

            {analysisResult.ai_report.recete_onerileri && analysisResult.ai_report.recete_onerileri.length > 0 && (
              <div className="space-y-2">
                 <h4 className="text-gray-400 text-xs font-bold uppercase">AI Reçete İlavesi</h4>
                 {analysisResult.ai_report.recete_onerileri.map((item, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                     <span className="text-emerald-800 text-xs font-medium">+{item.kalem}</span>
                     <span className="text-emerald-600 text-[10px] font-bold uppercase">Ekleniyor</span>
                   </div>
                 ))}
              </div>
            )}
          </div>
        )}

        <button 
          disabled={!analysisResult || isConfirming}
          onClick={handleConfirm}
          className={`w-full py-4 rounded-xl font-bold mt-6 transition-all shadow-lg ${
            analysisResult && !isConfirming
              ? "bg-green-600 hover:bg-green-700 text-white translate-y-0 active:translate-y-1" 
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isConfirming ? 'AKTARILIYOR...' : 'KEŞFİ ONAYLA VE AKTAR'}
        </button>
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={autoOpenQuoteAfterTransfer}
            onChange={(event) => setAutoOpenQuoteAfterTransfer(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
          />
          Aktarim tamamlaninca olusan RFQ ekranini otomatik ac
        </label>
      </div>
      </div>
    </div>
  );
};

export default DiscoveryLab;
