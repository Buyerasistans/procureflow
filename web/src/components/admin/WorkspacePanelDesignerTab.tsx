import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ACCENT_COLOR_PRESETS,
  buildWorkspacePanelProfileKeyFromParts,
  DEFAULT_WORKSPACE_PANEL_CONFIG,
  ROLE_ICON_PRESETS,
  WORKSPACE_PANEL_MENU_STYLE_OPTIONS,
  WORKSPACE_PANEL_TAB_OPTIONS,
  getWorkspacePanelQuickLinks,
  resolvedAccentColor,
  resolvedIcon,
} from "../../admin/workspace-panels";
import type { AuthUser } from "../../context/auth-types";
import type { TenantUser, WorkspacePanelConfig, WorkspacePanelProfile } from "../../services/admin.service";
import "./WorkspacePanelDesignerTab.css";
import { getAccessToken } from "../../lib/token";
import { PANEL_COLORS, resolvePanelColors, publishPanelTheme } from "../../admin/panel-colors";
import type { SegmentKey, PanelThemeOverrides } from "../../admin/panel-colors";
import { isSuperAdminUser } from "../../auth/permissions";

type Props = {
  config: WorkspacePanelConfig;
  sourceConfig?: WorkspacePanelConfig;
  currentUser?: AuthUser | null;
  personnel?: TenantUser[];
  mode?: "full" | "self";
  lockedProfile?: WorkspacePanelProfile | null;
  saving: boolean;
  onSave: (config: WorkspacePanelConfig) => Promise<void> | void;
};

function emptyProfile(): WorkspacePanelProfile {
  return {
    business_role: "",
    system_role: "",
    title: "",
    nav_label: "",
    workspace_label: "",
    description: "",
    hero_title: "",
    hero_description: "",
    header_bg_color: "#0f172acc",
    header_text_color: "#f8fafc",
    footer_bg_color: "#0f172a99",
    footer_text_color: "#e2e8f0",
    accent_opacity: 0.85,
    secondary_accent_opacity: 0.7,
    primary_accent_stop: 48,
    secondary_accent_start: 72,
    glow_intensity: 0.45,
    allowed_tabs: ["panel_home"],
    quick_links: [],
  };
}

export function WorkspacePanelDesignerTab(props: Props) {
  const { config, currentUser, mode = "full", lockedProfile = null } = props;
  const initialDraft = buildInitialDraft(config, mode, currentUser, lockedProfile);
  const initialSelectedIndex = getInitialSelectedProfileIndex(initialDraft, mode, currentUser, lockedProfile);
  const resetKey = buildDesignerResetKey(config, mode, currentUser, lockedProfile);

  return (
    <WorkspacePanelDesignerTabBody
      key={resetKey}
      {...props}
      initialDraft={initialDraft}
      initialSelectedIndex={initialSelectedIndex}
    />
  );
}

type WorkspacePanelDesignerTabBodyProps = Props & {
  initialDraft: WorkspacePanelConfig;
  initialSelectedIndex: number;
};

function WorkspacePanelDesignerTabBody({ config, sourceConfig, currentUser, personnel = [], mode = "full", saving, onSave, initialDraft, initialSelectedIndex }: WorkspacePanelDesignerTabBodyProps) {
  const [draft, setDraft] = useState<WorkspacePanelConfig>(() => initialDraft);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [importError, setImportError] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<null | "hero_title" | "hero_description">(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [previewPulse, setPreviewPulse] = useState(false);
  const [selectedOverrideUserIdsDraft, setSelectedOverrideUserIds] = useState<string[]>([]);
  const [overrideUserSearchQuery, setOverrideUserSearchQuery] = useState("");
  const [overrideUserFilter, setOverrideUserFilter] = useState<"all" | "selected" | "assigned" | "unassigned">("all");
  const dragTabIndexRef = useRef<number | null>(null);
  const dragLinkIndexRef = useRef<number | null>(null);
  const isSelfMode = mode === "self";

  // ── Renk Şeması Durumu ────────────────────────────────────────────────────
  type ColorField = 'accent' | 'accentDark' | 'accentTint' | 'chipBg' | 'secondary' | 'onAccent';
  const [colorDraft, setColorDraft] = useState<PanelThemeOverrides>({});
  const [colorLoadStatus, setColorLoadStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [canEditColors, setCanEditColors] = useState<boolean>(() => isSuperAdminUser(currentUser));
  const [colorSaveStatus, setColorSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [colorSaveMsg, setColorSaveMsg] = useState<string | null>(null);

  const resolvedColors = useMemo(() => resolvePanelColors(colorDraft), [colorDraft]);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    setColorLoadStatus('loading');
    fetch(`${apiBase}/api/v1/admin/panel-theme`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ segments: PanelThemeOverrides; canEdit: boolean }>;
      })
      .then((data) => {
        setColorDraft(data.segments ?? {});
        setCanEditColors(Boolean(data.canEdit));
        setColorLoadStatus('done');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== 'AbortError') setColorLoadStatus('error');
      });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfile = draft.profiles[selectedIndex] || null;
  const selectedMenuStyle = normalizeMenuStyle(selectedProfile?.menu_style);
  const selectedProfileKey = useMemo(() => {
    if (!selectedProfile) return "";
    return `${selectedProfile.business_role || "rol"}:${selectedProfile.system_role || "*"}`;
  }, [selectedProfile]);
  const previewQuickLinks = useMemo(() => getWorkspacePanelQuickLinks(selectedProfile), [selectedProfile]);
  const previewPalette = useMemo(
    () => getPreviewPalette(
      selectedProfile?.business_role,
      selectedProfile?.accent_color,
      selectedProfile?.secondary_accent_color,
      selectedProfile?.accent_opacity,
      selectedProfile?.secondary_accent_opacity,
      selectedProfile?.primary_accent_stop,
      selectedProfile?.secondary_accent_start,
      selectedProfile?.glow_intensity,
    ),
    [
      selectedProfile?.business_role,
      selectedProfile?.accent_color,
      selectedProfile?.secondary_accent_color,
      selectedProfile?.accent_opacity,
      selectedProfile?.secondary_accent_opacity,
      selectedProfile?.primary_accent_stop,
      selectedProfile?.secondary_accent_start,
      selectedProfile?.glow_intensity,
    ]
  );
  const previewScopeClass = useMemo(() => `wpd-preview-scope-${sanitizeCssClass(selectedProfileKey || "empty")}`, [selectedProfileKey]);
  const previewDynamicCss = useMemo(() => {
    if (!selectedProfile) return "";
    return `
.${previewScopeClass} {
  --wpd-preview-border: ${safeCssPaletteValue(previewPalette.border)};
  --wpd-preview-canvas: ${safeCssPaletteValue(previewPalette.canvas)};
  --wpd-preview-hero: ${safeCssPaletteValue(previewPalette.hero)};
  --wpd-preview-glow: ${safeCssPaletteValue(previewPalette.glowShadow)};
  --wpd-preview-pill-bg: ${safeCssPaletteValue(previewPalette.pillBackground)};
  --wpd-preview-pill-text: ${safeCssPaletteValue(previewPalette.pillText)};
  --wpd-preview-link: ${safeCssPaletteValue(previewPalette.link)};
  --wpd-header-bg: ${safeCssColorValue(selectedProfile.header_bg_color || "#0f172acc")};
  --wpd-header-text: ${safeCssColorValue(selectedProfile.header_text_color || "#f8fafc")};
  --wpd-footer-bg: ${safeCssColorValue(selectedProfile.footer_bg_color || "#0f172a99")};
  --wpd-footer-text: ${safeCssColorValue(selectedProfile.footer_text_color || "#e2e8f0")};
  --wpd-hero-text: ${safeCssColorValue(selectedProfile.hero_text_color || "#ffffff")};
  --wpd-hero-muted-text: ${safeCssColorValue(selectedProfile.hero_muted_text_color || selectedProfile.hero_text_color || "rgba(255,255,255,0.86)")};
}`;
  }, [
    previewPalette.border,
    previewPalette.canvas,
    previewPalette.glowShadow,
    previewPalette.hero,
    previewPalette.link,
    previewPalette.pillBackground,
    previewPalette.pillText,
    previewScopeClass,
    selectedProfile,
  ]);
  useWorkspaceDesignerDynamicStyles(previewDynamicCss);
  const profileLinkedUsers = useMemo(() => {
    if (!selectedProfile) return [];
    const roleKey = String(selectedProfile.business_role || "").trim().toLowerCase();
    const systemRoleKey = String(selectedProfile.system_role || "").trim().toLowerCase();
    return personnel.filter((item) => {
      const itemRole = String((item as { business_role?: string | null }).business_role || item.role || "").trim().toLowerCase();
      const itemSystemRole = String(item.system_role || "").trim().toLowerCase();
      if (itemRole !== roleKey) return false;
      if (!systemRoleKey) return true;
      return itemSystemRole === systemRoleKey;
    });
  }, [personnel, selectedProfile]);
  const selectedOverrideUserIds = useMemo(() => {
    if (profileLinkedUsers.length === 0) return [];
    const allowedSet = new Set(profileLinkedUsers.map((item) => String(item.id)));
    const filteredSelection = selectedOverrideUserIdsDraft.filter((item) => allowedSet.has(item));
    if (filteredSelection.length > 0) return filteredSelection;
    const currentUserOption = profileLinkedUsers.find((item) => item.id === currentUser?.id);
    return [String((currentUserOption || profileLinkedUsers[0]).id)];
  }, [currentUser?.id, profileLinkedUsers, selectedOverrideUserIdsDraft]);
  const selectedOverrideUsers = useMemo(() => {
    const selectedSet = new Set(selectedOverrideUserIds);
    return profileLinkedUsers.filter((item) => selectedSet.has(String(item.id)));
  }, [profileLinkedUsers, selectedOverrideUserIds]);
  const selectedOverrideMatchCount = useMemo(() => {
    if (selectedOverrideUsers.length === 0) return 0;
    const selectedSet = new Set(selectedOverrideUsers.map((item) => String(item.id)));
    return (draft.user_overrides || []).filter((item) => {
      if (item.user_id != null && selectedSet.has(String(item.user_id))) return true;
      if (!item.user_email) return false;
      return selectedOverrideUsers.some((userItem) => String(userItem.email || "").trim().toLowerCase() === String(item.user_email || "").trim().toLowerCase());
    }).length;
  }, [draft.user_overrides, selectedOverrideUsers]);
  const profileLinkedUsersWithOverrideState = useMemo(() => {
    return profileLinkedUsers.map((item) => {
      const matchedOverride = (draft.user_overrides || []).find((overrideItem) => {
        if (overrideItem.user_id != null && overrideItem.user_id === item.id) return true;
        if (overrideItem.user_email && item.email && String(overrideItem.user_email).trim().toLowerCase() === String(item.email).trim().toLowerCase()) return true;
        return false;
      });
      return {
        ...item,
        hasOverride: Boolean(matchedOverride),
        overrideProfileKey: matchedOverride?.profile_key || null,
      };
    });
  }, [draft.user_overrides, profileLinkedUsers]);
  const filteredOverrideUsers = useMemo(() => {
    const search = overrideUserSearchQuery.trim().toLowerCase();
    return profileLinkedUsersWithOverrideState.filter((item) => {
      if (overrideUserFilter === "selected" && !selectedOverrideUserIds.includes(String(item.id))) return false;
      if (overrideUserFilter === "assigned" && !item.hasOverride) return false;
      if (overrideUserFilter === "unassigned" && item.hasOverride) return false;
      if (!search) return true;
      const haystack = `${item.full_name || ""} ${item.email || ""} ${item.role || ""} ${item.system_role || ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [overrideUserFilter, overrideUserSearchQuery, profileLinkedUsersWithOverrideState, selectedOverrideUserIds]);
  const groupedFilteredOverrideUsers = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; users: typeof filteredOverrideUsers }>();
    filteredOverrideUsers.forEach((item) => {
      const tenantText = item.tenant_id == null ? "Tenant: -" : `Tenant: ${item.tenant_id}`;
      const roleText = String((item as { business_role?: string | null }).business_role || item.role || "-").trim() || "-";
      const systemRoleText = String(item.system_role || "-").trim() || "-";
      const key = `${tenantText}|${roleText}|${systemRoleText}`;
      const title = `${tenantText} | Rol: ${roleText} | Sistem Rol: ${systemRoleText}`;
      const existing = groups.get(key);
      if (existing) {
        existing.users.push(item);
      } else {
        groups.set(key, { key, title, users: [item] });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredOverrideUsers]);
  const unassignedLinkedUsers = useMemo(() => profileLinkedUsersWithOverrideState.filter((item) => !item.hasOverride), [profileLinkedUsersWithOverrideState]);
  const previewIcon = useMemo(() => resolvedIcon(selectedProfile), [selectedProfile]);
  const dbProfileKeySet = useMemo(() => {
    if (!sourceConfig) return null;
    return new Set((sourceConfig?.profiles || []).map((item) => profileKey(item.business_role, item.system_role || null)));
  }, [sourceConfig]);
  const missingDefaultProfiles = useMemo(() => {
    if (!dbProfileKeySet) return [];
    return DEFAULT_WORKSPACE_PANEL_CONFIG.profiles.filter((item) => !dbProfileKeySet.has(profileKey(item.business_role, item.system_role || null)));
  }, [dbProfileKeySet]);

  function toggleOverrideUser(userId: string) {
    setSelectedOverrideUserIds((current) => {
      const baseSelection = current.length > 0 ? current : selectedOverrideUserIds;
      return baseSelection.includes(userId) ? baseSelection.filter((item) => item !== userId) : [...baseSelection, userId];
    });
  }

  function toggleAllOverrideUsers() {
    if (profileLinkedUsers.length === 0) return;
    const allIds = profileLinkedUsers.map((item) => String(item.id));
    const allSelected = allIds.every((item) => selectedOverrideUserIds.includes(item));
    setSelectedOverrideUserIds(allSelected ? [] : allIds);
  }

  async function persistOverridesForUsers(targetUsers: TenantUser[], action: "assign" | "clear") {
    if (!selectedProfile && action === "assign") return;
    if (targetUsers.length === 0) {
      setApplyMessage("Bu islem icin en az bir kullanici secin.");
      window.setTimeout(() => setApplyMessage(null), 2200);
      return;
    }
    const profileKeyValue = selectedProfile
      ? buildWorkspacePanelProfileKeyFromParts(selectedProfile.business_role, selectedProfile.system_role || null)
      : null;
    const nextDraft = (() => {
      const current = draft;
      const selectedIds = new Set(targetUsers.map((item) => String(item.id)));
      const selectedEmails = new Set(targetUsers.map((item) => String(item.email || "").trim().toLowerCase()).filter(Boolean));
      const filtered = (current.user_overrides || []).filter((item) => {
        if (item.user_id != null && selectedIds.has(String(item.user_id))) return false;
        if (item.user_email && selectedEmails.has(String(item.user_email).trim().toLowerCase())) return false;
        return true;
      });
      return {
        ...current,
        user_overrides: action === "assign"
          ? [
              ...filtered,
              ...targetUsers.map((item) => ({
                user_id: typeof item.id === "number" ? item.id : null,
                user_email: String(item.email || "").trim().toLowerCase() || null,
                profile_key: profileKeyValue || "",
                note: "panel-designer-bulk-user-override",
              })),
            ]
          : filtered,
      };
    })();
    setDraft(nextDraft);
    try {
      await onSave(buildPersistedConfig(nextDraft));
      setApplyMessage(
        action === "assign"
          ? `Kullanıcı override kaydedildi: ${targetUsers.length} kullanıcı -> ${selectedProfile?.title || selectedProfile?.business_role}`
          : `Kullanıcı override temizlendi (${targetUsers.length} kullanıcı).`
      );
    } catch (error) {
      setApplyMessage(action === "assign" ? `Override kaydedilemedi: ${String(error)}` : `Override temizlenemedi: ${String(error)}`);
    }
    window.setTimeout(() => setApplyMessage(null), 3200);
  }

  function updateSelected(patch: Partial<WorkspacePanelProfile>) {
    setDraft((current) => ({
      ...current,
      profiles: current.profiles.map((item, index) => (
        index === selectedIndex ? { ...item, ...patch } : item
      )),
    }));
  }

  function addProfile() {
    setDraft((current) => ({
      ...current,
      profiles: [...current.profiles, emptyProfile()],
    }));
    setSelectedIndex(draft.profiles.length);
  }

  function restoreMainSettings() {
    setDraft(config);
    setSelectedIndex(0);
    setImportError(null);
    setInlineEditField(null);
  }

  function addMissingProfilesFromDefaults() {
    if (missingDefaultProfiles.length === 0) return;
    setDraft((current) => {
      const existing = new Set(current.profiles.map((item) => profileKey(item.business_role, item.system_role || null)));
      const appendable = missingDefaultProfiles.filter((item) => !existing.has(profileKey(item.business_role, item.system_role || null)));
      return {
        ...current,
        profiles: [...current.profiles, ...appendable],
      };
    });
  }

  function duplicateSelected() {
    if (!selectedProfile) return;
    const copy: WorkspacePanelProfile = {
      ...selectedProfile,
      title: selectedProfile.title ? `${selectedProfile.title} (Kopya)` : "Kopya Panel",
      business_role: selectedProfile.business_role ? `${selectedProfile.business_role}_copy` : "",
    };
    setDraft((current) => ({
      ...current,
      profiles: [...current.profiles, copy],
    }));
    setSelectedIndex(draft.profiles.length);
  }

  function removeSelected() {
    if (!selectedProfile) return;
    setDraft((current) => ({
      ...current,
      profiles: current.profiles.filter((_, index) => index !== selectedIndex),
    }));
    setSelectedIndex((current) => Math.max(0, current - 1));
  }

  function toggleTab(tabKey: string) {
    if (!selectedProfile) return;
    const nextTabs = selectedProfile.allowed_tabs.includes(tabKey)
      ? selectedProfile.allowed_tabs.filter((item) => item !== tabKey)
      : [...selectedProfile.allowed_tabs, tabKey];
    updateSelected({ allowed_tabs: nextTabs });
  }

  function moveAllowedTab(tabKey: string, direction: -1 | 1) {
    if (!selectedProfile) return;
    const currentIndex = selectedProfile.allowed_tabs.indexOf(tabKey);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= selectedProfile.allowed_tabs.length) return;
    const nextTabs = [...selectedProfile.allowed_tabs];
    const [moved] = nextTabs.splice(currentIndex, 1);
    nextTabs.splice(nextIndex, 0, moved);
    updateSelected({ allowed_tabs: nextTabs });
  }

  function handleTabDragStart(index: number) {
    dragTabIndexRef.current = index;
  }
  function handleTabDragOver(event: React.DragEvent, overIndex: number) {
    event.preventDefault();
    const fromIndex = dragTabIndexRef.current;
    if (fromIndex === null || fromIndex === overIndex || !selectedProfile) return;
    const nextTabs = [...selectedProfile.allowed_tabs];
    const [moved] = nextTabs.splice(fromIndex, 1);
    nextTabs.splice(overIndex, 0, moved);
    dragTabIndexRef.current = overIndex;
    updateSelected({ allowed_tabs: nextTabs });
  }
  function handleTabDragEnd() {
    dragTabIndexRef.current = null;
  }

  function handleLinkDragStart(index: number) {
    dragLinkIndexRef.current = index;
  }
  function handleLinkDragOver(event: React.DragEvent, overIndex: number) {
    event.preventDefault();
    const fromIndex = dragLinkIndexRef.current;
    if (fromIndex === null || fromIndex === overIndex || !selectedProfile) return;
    const nextLinks = [...(selectedProfile.quick_links || [])];
    const [moved] = nextLinks.splice(fromIndex, 1);
    nextLinks.splice(overIndex, 0, moved);
    dragLinkIndexRef.current = overIndex;
    updateSelected({ quick_links: nextLinks });
  }
  function handleLinkDragEnd() {
    dragLinkIndexRef.current = null;
  }

  function startInlineEdit(field: "hero_title" | "hero_description") {
    if (!selectedProfile) return;
    setInlineEditField(field);
    setInlineEditValue(selectedProfile[field] || "");
  }

  function commitInlineEdit() {
    if (!inlineEditField) return;
    updateSelected({ [inlineEditField]: inlineEditValue });
    setInlineEditField(null);
  }

  function addQuickLink() {
    if (!selectedProfile) return;
    updateSelected({
      quick_links: [
        ...(selectedProfile.quick_links || []),
        { label: "", href: "", description: "" },
      ],
    });
  }

  function updateQuickLink(index: number, patch: { label?: string; href?: string; description?: string }) {
    if (!selectedProfile) return;
    updateSelected({
      quick_links: (selectedProfile.quick_links || []).map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  function removeQuickLink(index: number) {
    if (!selectedProfile) return;
    updateSelected({
      quick_links: (selectedProfile.quick_links || []).filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function moveQuickLink(index: number, direction: -1 | 1) {
    if (!selectedProfile) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= (selectedProfile.quick_links || []).length) return;
    const nextQuickLinks = [...(selectedProfile.quick_links || [])];
    const [moved] = nextQuickLinks.splice(index, 1);
    nextQuickLinks.splice(nextIndex, 0, moved);
    updateSelected({ quick_links: nextQuickLinks });
  }

  function buildPersistedConfig(nextDraft: WorkspacePanelConfig): WorkspacePanelConfig {
    return {
      version: nextDraft.version || 1,
      user_overrides: (nextDraft.user_overrides || [])
        .map((item) => ({
          user_id: typeof item.user_id === "number" ? item.user_id : null,
          user_email: item.user_email?.trim().toLowerCase() || null,
          profile_key: item.profile_key?.trim().toLowerCase() || "",
          note: item.note?.trim() || null,
        }))
        .filter((item) => item.profile_key),
      profiles: nextDraft.profiles.map((item) => ({
        ...item,
        business_role: item.business_role.trim().toLowerCase(),
        system_role: item.system_role?.trim().toLowerCase() || null,
        top_notice: item.top_notice?.trim() || null,
        header_info: item.header_info?.trim() || null,
        footer_info: item.footer_info?.trim() || null,
        header_bg_color: item.header_bg_color || null,
        header_text_color: item.header_text_color || null,
        footer_bg_color: item.footer_bg_color || null,
        footer_text_color: item.footer_text_color || null,
        hero_text_color: item.hero_text_color || null,
        hero_muted_text_color: item.hero_muted_text_color || null,
        allow_user_self_customization: Boolean(item.allow_user_self_customization),
        menu_style: item.menu_style || "pill",
        accent_color: item.accent_color || null,
        secondary_accent_color: item.secondary_accent_color || null,
        accent_opacity: normalizeRange(item.accent_opacity, 0.2, 1, 0.85),
        secondary_accent_opacity: normalizeRange(item.secondary_accent_opacity, 0.2, 1, 0.7),
        primary_accent_stop: normalizeRange(item.primary_accent_stop, 20, 80, 48),
        secondary_accent_start: normalizeRange(item.secondary_accent_start, 40, 100, 72),
        glow_intensity: normalizeRange(item.glow_intensity, 0, 1, 0.45),
        allowed_tabs: Array.from(new Set(item.allowed_tabs.filter(Boolean))),
        quick_links: (item.quick_links || [])
          .map((link) => ({
            label: link.label.trim(),
            href: link.href.trim(),
            description: link.description.trim(),
          }))
          .filter((link) => link.label && link.href && link.description),
      })),
    };
  }

  async function applyDesignerEditsToSelected() {
    if (!selectedProfile) return;
    const appliedPatch: Partial<WorkspacePanelProfile> = {
      menu_style: selectedMenuStyle,
      icon: selectedProfile.icon || resolvedIcon(selectedProfile),
      accent_color: selectedProfile.accent_color || resolvedAccentColor(selectedProfile),
      secondary_accent_color: selectedProfile.secondary_accent_color || null,
      accent_opacity: normalizeRange(selectedProfile.accent_opacity, 0.2, 1, 0.85),
      secondary_accent_opacity: normalizeRange(selectedProfile.secondary_accent_opacity, 0.2, 1, 0.7),
      primary_accent_stop: normalizeRange(selectedProfile.primary_accent_stop, 20, 80, 48),
      secondary_accent_start: normalizeRange(selectedProfile.secondary_accent_start, 40, 100, 72),
      glow_intensity: normalizeRange(selectedProfile.glow_intensity, 0, 1, 0.45),
    };
    const nextDraft: WorkspacePanelConfig = {
      ...draft,
      profiles: draft.profiles.map((item, index) => (index === selectedIndex ? { ...item, ...appliedPatch } : item)),
    };
    setDraft(nextDraft);
    try {
      await onSave(buildPersistedConfig(nextDraft));
      setPreviewPulse(true);
      setApplyMessage(`Secili profil kaydedildi ve uygulandi: ${selectedProfile.title || selectedProfile.business_role || "Yeni Panel"}`);
    } catch (error) {
      setApplyMessage(`Uygulama hatasi: ${String(error)}`);
    }
    window.setTimeout(() => setPreviewPulse(false), 360);
    window.setTimeout(() => setApplyMessage(null), 3200);
  }

  async function handleSave() {
    await onSave(buildPersistedConfig(draft));
  }

  async function assignSelectedProfileToCurrentUser() {
    const targetUsers = selectedOverrideUsers.length > 0
      ? selectedOverrideUsers
      : (currentUser ? [{ id: typeof currentUser.id === "number" ? currentUser.id : 0, email: currentUser.email || "", full_name: currentUser.full_name || "" } as TenantUser] : []);
    await persistOverridesForUsers(targetUsers, "assign");
  }

  async function clearCurrentUserOverride() {
    const targetUsers = selectedOverrideUsers.length > 0
      ? selectedOverrideUsers
      : (currentUser ? [{ id: typeof currentUser.id === "number" ? currentUser.id : 0, email: currentUser.email || "", full_name: currentUser.full_name || "" } as TenantUser] : []);
    await persistOverridesForUsers(targetUsers, "clear");
  }

  function handleExport() {
    const payload = JSON.stringify({ version: draft.version || 1, profiles: draft.profiles, user_overrides: draft.user_overrides || [] }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workspace-panel-config-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const updateColorField = useCallback((segKey: SegmentKey, field: ColorField, value: string | null) => {
    setColorDraft((prev) => {
      const prevSeg = prev[segKey] || {};
      if (value === null || value === '') {
        const nextSeg = Object.fromEntries(Object.entries(prevSeg).filter(([k]) => k !== field));
        return { ...prev, [segKey]: nextSeg as PanelThemeOverrides[SegmentKey] };
      }
      return { ...prev, [segKey]: { ...prevSeg, [field]: value } };
    });
  }, []);

  const resetSegmentColors = useCallback((segKey: SegmentKey) => {
    setColorDraft((prev) => {
      const next = { ...prev };
      delete next[segKey];
      return next;
    });
  }, []);

  const saveColorTheme = useCallback(async () => {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
    setColorSaveStatus('saving');
    setColorSaveMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/panel-theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAccessToken() ?? ''}`,
        },
        body: JSON.stringify({ segments: colorDraft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { segments: PanelThemeOverrides };
      setColorDraft(data.segments ?? {});
      publishPanelTheme(colorDraft);
      setColorSaveStatus('ok');
      setColorSaveMsg('Renk şeması kaydedildi ve yayınlandı.');
    } catch (e) {
      setColorSaveStatus('error');
      setColorSaveMsg(`Kayıt hatası: ${String(e)}`);
    }
    window.setTimeout(() => {
      setColorSaveStatus('idle');
      setColorSaveMsg(null);
    }, 3200);
  }, [colorDraft]);

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || ""));
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.profiles)) {
          setImportError("Gecersiz format: 'profiles' dizisi bulunamadi.");
          return;
        }
        const invalidProfile = parsed.profiles.find(
          (item: unknown) =>
            typeof item !== "object" || item === null ||
            !("business_role" in item) || typeof (item as Record<string, unknown>).business_role !== "string",
        );
        if (invalidProfile !== undefined) {
          setImportError("Gecersiz profil: her profilde 'business_role' (string) alanı zorunludur.");
          return;
        }
        setDraft({ version: parsed.version || 1, profiles: parsed.profiles, user_overrides: Array.isArray(parsed.user_overrides) ? parsed.user_overrides : [] });
        setSelectedIndex(0);
        setImportError(null);
      } catch {
        setImportError("JSON parse hatasi: dosya gecerli bir JSON degil.");
      }
    };
    reader.readAsText(file);
    // Ayni dosyayi tekrar secebilmek icin value sifirla
    event.target.value = "";
  }

  return (
    <section className="wpd-root">
      <div className="wpd-card">
        <div className="wpd-eyebrow">Panel Tasarimi</div>
        <div className="wpd-page-title">{isSelfMode ? "Kişisel Template Ayarları" : "Rol bazlı panelleri ayır ve yönet"}</div>
        <div className="wpd-page-copy">
          {isSelfMode
            ? "Bu alan sadece kendi panel temani duzenlemek icin aciktir. Rol, sekme ve kapsam degistiremezsin; sadece metin ve renk template'ini guncellersin."
            : "Super admin bu alandan her rol profili için ayrı panel adı, açıklama ve görülecek sekmeleri düzenleyebilir. Yeni bir iş rolü eklendiğinde burada yeni profil açılarak panel kapsamı tanımlanabilir."}
        </div>
        <div className="wpd-page-note">
          Renk uygulama notu: Birinci renk ana vurgu icindir. Ikinci renk opsiyoneldir (Yok secilebilir). 1. renk kapsami ve 2. renk baslangic yuzdesiyle soldan saga dagilim ayarlanir.
        </div>
        {!isSelfMode ? (
        <div className="wpd-user-picker">
          <label className="wpd-field">
            <span className="wpd-field-label">Bu Profile Bağlı Kullanıcılar (Çoklu Seçim)</span>
            <div className="wpd-user-search-row">
              <input
                value={overrideUserSearchQuery}
                onChange={(event) => setOverrideUserSearchQuery(event.target.value)}
                placeholder="Kullanıcı adı, e-posta veya role göre ara"
                className="wpd-input"
              />
              <select value={overrideUserFilter} onChange={(event) => setOverrideUserFilter(event.target.value as "all" | "selected" | "assigned" | "unassigned")} className="wpd-select wpd-select--filter" aria-label="Kullanıcı override filtresi">
                <option value="all">Tümü</option>
                <option value="selected">Secili</option>
                <option value="assigned">Override var</option>
                <option value="unassigned">Override yok</option>
              </select>
            </div>
            <div className="wpd-user-list">
              <label className="wpd-checkbox-row">
                <input
                  type="checkbox"
                  checked={filteredOverrideUsers.length > 0 && filteredOverrideUsers.every((item) => selectedOverrideUserIds.includes(String(item.id)))}
                  onChange={toggleAllOverrideUsers}
                />
                Tümünü Seç / Kaldır
              </label>
              {profileLinkedUsers.length === 0 ? (
                <div className="wpd-empty">Bu profile bagli kullanici bulunamadi.</div>
              ) : filteredOverrideUsers.length === 0 ? (
                <div className="wpd-empty">Arama / filtre sonucunda kullanici bulunamadi.</div>
              ) : groupedFilteredOverrideUsers.map((group) => (
                <div key={group.key} className="wpd-user-group">
                  <div className="wpd-user-group-title">{group.title}</div>
                  {group.users.map((item) => {
                    const checked = selectedOverrideUserIds.includes(String(item.id));
                    return (
                      <label key={item.id} className="wpd-user-option">
                        <input type="checkbox" checked={checked} onChange={() => toggleOverrideUser(String(item.id))} />
                        <span className="wpd-truncate">{item.full_name} - {item.email}</span>
                        <span className={cx("wpd-user-status", item.hasOverride && "wpd-user-status--active")}>{item.hasOverride ? "Override var" : "Varsayilan"}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </label>
          <div className="wpd-user-help">
            Liste sadece secili profilin rol ve sistem rolune bagli personelleri gosterir. Tiklenen kullanicilara toplu override uygulanir. Oturum kullanicisi: {currentUser?.email || "-"}
          </div>
        </div>
        ) : null}
        <div className="wpd-actions">
          {!isSelfMode ? (
            <button type="button" onClick={addProfile} className="wpd-button wpd-button--create">
              + Yeni Rol Profili
            </button>
          ) : null}
          <button type="button" onClick={applyDesignerEditsToSelected} disabled={!selectedProfile} className="wpd-button wpd-button--apply">
            {isSelfMode ? "Onizlemeye Uygula" : "Uygula (Secili Profil)"}
          </button>
          {!isSelfMode ? (
            <>
              <button type="button" onClick={() => void assignSelectedProfileToCurrentUser()} disabled={!selectedProfile || (profileLinkedUsers.length === 0 && !currentUser?.email)} className="wpd-button wpd-button--assign">
                Bu Profili Hedef Kullanıcıya Ata
              </button>
              <button type="button" onClick={() => void persistOverridesForUsers(profileLinkedUsers, "assign")} disabled={!selectedProfile || profileLinkedUsers.length === 0} className="wpd-button wpd-button--bulk">
                Profili Tüm Bağlı Kullanıcılara Uygula
              </button>
              <button type="button" onClick={() => void persistOverridesForUsers(unassignedLinkedUsers, "assign")} disabled={!selectedProfile || unassignedLinkedUsers.length === 0} className="wpd-button wpd-button--cyan">
                Sadece Override Almamislara Uygula ({unassignedLinkedUsers.length})
              </button>
              <button type="button" onClick={() => void clearCurrentUserOverride()} disabled={selectedOverrideMatchCount === 0} className="wpd-button wpd-button--warning">
                Mevcut Kullanıcı Override Kaldır
              </button>
            </>
          ) : null}
          <button type="button" onClick={handleSave} disabled={saving} className="wpd-button wpd-button--primary">
            {saving ? "Kaydediliyor..." : isSelfMode ? "Kendi Temami Kaydet" : "Panel Ayarlarini Kaydet"}
          </button>
          {!isSelfMode ? (
            <>
              <button type="button" onClick={handleExport} className="wpd-button">
                ↓ JSON Export
              </button>
              <button type="button" onClick={restoreMainSettings} className="wpd-button">
                Ana Ayarlari Geri Yukle
              </button>
              <button
                type="button"
                onClick={addMissingProfilesFromDefaults}
                disabled={missingDefaultProfiles.length === 0}
                className="wpd-button wpd-button--cyan"
              >
                Eksik Profilleri Ekle ({missingDefaultProfiles.length})
              </button>
              <label
                aria-label="JSON dosyasindan profilleri iceri aktar"
                className="wpd-upload-button"
              >
                ↑ JSON Import
                <input type="file" accept=".json,application/json" onChange={handleImport} className="wpd-hidden-input" aria-hidden="true" aria-label="JSON import dosyasi" title="JSON import dosyasi" />
              </label>
              {importError ? (
                <div role="alert" className="wpd-alert-error">
                  {importError}
                </div>
              ) : null}
              {selectedProfile ? (
                <button type="button" onClick={removeSelected} className="wpd-button wpd-button--danger">
                  Secili Profili Kaldir
                </button>
              ) : null}
              {selectedProfile ? (
                <button type="button" onClick={duplicateSelected} className="wpd-button wpd-button--copy">
                  ⧉ Profili Kopyala
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {applyMessage ? (
          <div className="wpd-apply-message">
            {applyMessage}
          </div>
        ) : null}
        {!isSelfMode && (currentUser || selectedOverrideUserIds.length > 0) ? (
          <div className="wpd-override-summary">
            <span>Kullanıcı override:</span>{" "}
            <span className="wpd-strong">{selectedOverrideUserIds.length} secili kullanici</span>{" "}
            <span>{"->"}</span>{" "}
            <span className="wpd-strong">{selectedOverrideMatchCount} atama bulundu</span>
          </div>
        ) : null}
      </div>

      <div className={cx("wpd-layout", isSelfMode && "wpd-layout--self")}>
        {!isSelfMode ? (
        <aside className="wpd-sidebar">
          {draft.profiles.map((profile, index) => {
            const active = index === selectedIndex;
            const cardAccent = resolvedAccentColor(profile);
            const cardIcon = resolvedIcon(profile);
            return (
              <button
                key={`${profile.business_role}-${profile.system_role || "default"}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={cx("wpd-profile-card", active && "wpd-profile-card--active")}
              >
                <div className="wpd-profile-head">
                  <div className="wpd-profile-title-row">
                    <span className="wpd-profile-icon">{cardIcon}</span>
                    <div className="wpd-profile-title wpd-truncate">{profile.title || "Yeni Panel"}</div>
                  </div>
                  <span title={cardAccent} className="wpd-profile-accent" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5.5" fill={cardAccent} stroke="rgba(15,23,42,0.15)" /></svg></span>
                </div>
                <div className="wpd-override-summary">{profile.business_role || "rol"}:{profile.system_role || "*"}</div>
                <div className="wpd-profile-stats">
                  <span>{profile.allowed_tabs.length} sekme</span>
                  <span>{profile.nav_label || "Menu etiketi yok"}</span>
                </div>
              </button>
            );
          })}
        </aside>
        ) : null}

        <div className="wpd-editor-card">
          {!selectedProfile ? (
            <div className="wpd-editor-empty">Duzenlemek icin bir rol profili secin.</div>
          ) : (
            <>
              <div className="wpd-section-kicker wpd-section-kicker--warm">Secili Profil</div>
              <div className="wpd-editor-title">{selectedProfile.title || "Yeni Panel"}</div>
              <div className="wpd-profile-key">Profil anahtari: {selectedProfileKey}</div>

              <section
                aria-label="Canli Panel Onizleme"
                className={cx("wpd-preview", previewScopeClass, previewPulse && "wpd-preview--pulse")}
              >
                <div
                  className="wpd-preview-toolbar"
                >
                  <span className="wpd-preview-kicker">Canli Onizleme</span>
                  <div role="group" aria-label="Onizleme modu" className="wpd-segmented">
                    <button
                      type="button"
                      aria-pressed={previewMode === "desktop" ? "true" : "false"}
                      onClick={() => setPreviewMode("desktop")}
                      className={cx("wpd-segment-button", previewMode === "desktop" && "wpd-segment-button--active")}
                    >
                      Masaustu
                    </button>
                    <button
                      type="button"
                      aria-pressed={previewMode === "mobile" ? "true" : "false"}
                      onClick={() => setPreviewMode("mobile")}
                      className={cx("wpd-segment-button", previewMode === "mobile" && "wpd-segment-button--active")}
                    >
                      Mobil
                    </button>
                  </div>
                </div>
                <div className={cx(previewMode === "mobile" && "wpd-preview-device--mobile")}>
                {(selectedProfile.header_info || selectedProfile.top_notice || selectedProfile.header_bg_color || selectedProfile.header_text_color) ? (
                  <div
                    className="wpd-preview-notice"
                  >
                    {selectedProfile.header_info || selectedProfile.top_notice || "Header bilgi alani"}
                  </div>
                ) : null}
                <div
                  className={cx("wpd-preview-hero", previewMode === "mobile" && "wpd-preview-hero--mobile")}
                >
                  {selectedProfile.top_notice ? (
                    <div className="wpd-preview-top-notice">
                      {selectedProfile.top_notice}
                    </div>
                  ) : null}
                  <div className="wpd-preview-workspace">
                    <span className="wpd-preview-workspace-icon" aria-label="Panel ikonu">{previewIcon}</span>
                    {selectedProfile.workspace_label || "Workspace Etiketi"}
                  </div>
                  <div className={cx("wpd-preview-hero-row", previewMode === "mobile" && "wpd-preview-hero-row--mobile")}>
                    <div className={cx("wpd-preview-copy", previewMode === "mobile" && "wpd-preview-copy--mobile")}>
                      <div className={cx("wpd-preview-title", previewMode === "mobile" && "wpd-preview-title--mobile")}>
                        {inlineEditField === "hero_title" ? (
                          <input
                            autoFocus
                            aria-label="Hero basligini duzenle"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={commitInlineEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") commitInlineEdit(); if (e.key === "Escape") setInlineEditField(null); }}
                            className="wpd-inline-input"
                          />
                        ) : (
                          <span
                            title="Düzenlemek için çift tıkla"
                            onDoubleClick={() => startInlineEdit("hero_title")}
                            className="wpd-inline-edit"
                          >
                            {selectedProfile.hero_title || selectedProfile.title || "Panel Basligi"}
                          </span>
                        )}
                      </div>
                      <div className="wpd-preview-description">
                        {inlineEditField === "hero_description" ? (
                          <textarea
                            autoFocus
                            aria-label="Hero aciklamasini duzenle"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={commitInlineEdit}
                            onKeyDown={(e) => { if (e.key === "Escape") setInlineEditField(null); }}
                            rows={3}
                            className="wpd-inline-textarea"
                          />
                        ) : (
                          <span
                            title="Düzenlemek için çift tıkla"
                            onDoubleClick={() => startInlineEdit("hero_description")}
                            className="wpd-inline-edit wpd-inline-edit--muted"
                          >
                            {selectedProfile.hero_description || selectedProfile.description || "Bu panel icin hero aciklamasi burada gorunur."}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={cx("wpd-preview-badge", previewMode === "mobile" && "wpd-preview-badge--mobile")}>
                      {selectedProfile.nav_label || "Menu Etiketi"}
                    </div>
                  </div>
                  <div className="wpd-preview-menu-style">
                    Menu stili: {selectedProfile.menu_style || "pill"}
                  </div>
                </div>

<div className={cx("wpd-preview-body", previewMode === "mobile" && "wpd-preview-body--mobile")}>
                    <div className="wpd-option-stack">
                      <div className="wpd-control-kicker">Menu Sirasi</div>
                      <div className={cx("wpd-preview-tabs", previewMode === "mobile" && "wpd-preview-tabs--mobile")}>
                        {selectedProfile.allowed_tabs.map((tabKey) => {
                          const option = WORKSPACE_PANEL_TAB_OPTIONS.find((item) => item.key === tabKey);
                          return (
                            <span key={`preview-${tabKey}`} className={cx("wpd-preview-pill", previewMode === "mobile" && "wpd-preview-pill--mobile")}>
                              {option?.label || tabKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="wpd-control-section">
                      <div className="wpd-control-kicker">Hizli Link Onizlemesi</div>
                      <div className={cx("wpd-preview-link-grid", previewMode === "mobile" && "wpd-preview-link-grid--mobile")}>
                        {previewQuickLinks.map((link) => (
                          <div key={`preview-link-${link.label}-${link.href}`} className="wpd-preview-link">
                            <div className="wpd-preview-link-title">{link.label}</div>
                            <div className="wpd-preview-link-description">{link.description}</div>
                            <div className="wpd-preview-link-href">{link.href}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {(selectedProfile.footer_info || selectedProfile.footer_bg_color || selectedProfile.footer_text_color) ? (
                  <div
                    className="wpd-preview-footer"
                  >
                    {selectedProfile.footer_info || "Footer bilgi alani"}
                  </div>
                ) : null}
              </section>

              {/* Ikon ve Vurgu Rengi Secici */}
              <div className="wpd-control-panel">
                <div className="wpd-control-section">
                  <div className="wpd-control-kicker">Renk Efekti</div>
                  <label className="wpd-field">
                    <span className="wpd-field-label">1. Vurgu Siddeti</span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={selectedProfile.accent_opacity ?? 0.85}
                      onChange={(event) => updateSelected({ accent_opacity: Number(event.target.value) })}
                    />
                  </label>
                  <label className="wpd-field">
                    <span className="wpd-field-label">2. Vurgu Siddeti</span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={selectedProfile.secondary_accent_opacity ?? 0.7}
                      onChange={(event) => updateSelected({ secondary_accent_opacity: Number(event.target.value) })}
                    />
                  </label>
                  <label className="wpd-field">
                    <span className="wpd-field-label">1. Renk Kapsam %</span>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={selectedProfile.primary_accent_stop ?? 48}
                      onChange={(event) => updateSelected({ primary_accent_stop: Number(event.target.value) })}
                    />
                  </label>
                  <label className="wpd-field">
                    <span className="wpd-field-label">2. Renk Başlangıç %</span>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={1}
                      value={selectedProfile.secondary_accent_start ?? 72}
                      onChange={(event) => updateSelected({ secondary_accent_start: Number(event.target.value) })}
                    />
                  </label>
                  <label className="wpd-field">
                    <span className="wpd-field-label">Isik Siddeti</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedProfile.glow_intensity ?? 0.45}
                      onChange={(event) => updateSelected({ glow_intensity: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <div className="wpd-control-section">
                  <div className="wpd-control-kicker">Vurgu Rengi (1. Renk)</div>
                  <div className="wpd-swatch-row">
                    {ACCENT_COLOR_PRESETS.map((preset) => {
                      const current = resolvedAccentColor(selectedProfile);
                      const isSelected = (selectedProfile.accent_color || "") === preset.color || (!selectedProfile.accent_color && current === preset.color);
                      return (
                        <button
                          key={preset.color}
                          type="button"
                          aria-label={`Renk sec: ${preset.label}`}
                          aria-pressed={isSelected ? "true" : "false"}
                          onClick={() => updateSelected({ accent_color: preset.color })}
                          className={cx("wpd-swatch-button", isSelected && "wpd-swatch-button--selected")}
                          title={preset.label}
                        >
                          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect x="0" y="0" width="32" height="32" rx="6" fill={preset.color} /></svg>
                        </button>
                      );
                    })}
                    <label
                      aria-label="Ozel renk gir"
                      className="wpd-color-label"
                    >
                      <input
                        type="color"
                        value={selectedProfile.accent_color || resolvedAccentColor(selectedProfile)}
                        onChange={(event) => updateSelected({ accent_color: event.target.value })}
                        className="wpd-color-input"
                      />
                      <span className="wpd-color-label-text">Özel</span>
                    </label>
                  </div>
                </div>
                <div className="wpd-control-section">
                  <div className="wpd-control-kicker">Vurgu Rengi (2. Renk)</div>
                  <div className="wpd-swatch-row">
                    <button
                      type="button"
                      aria-label="2. renk yok"
                      aria-pressed={!selectedProfile.secondary_accent_color ? "true" : "false"}
                      onClick={() => updateSelected({ secondary_accent_color: null })}
                      className={cx("wpd-swatch-none", !selectedProfile.secondary_accent_color && "wpd-swatch-none--selected")}
                      title="Ikinci renk kullanma"
                    >
                      Yok
                    </button>
                    {ACCENT_COLOR_PRESETS.map((preset) => {
                      const current = selectedProfile.secondary_accent_color || "";
                      const isSelected = current === preset.color;
                      return (
                        <button
                          key={`secondary-${preset.color}`}
                          type="button"
                          aria-label={`2. renk sec: ${preset.label}`}
                          aria-pressed={isSelected ? "true" : "false"}
                          onClick={() => updateSelected({ secondary_accent_color: preset.color })}
                          className={cx("wpd-swatch-button", isSelected && "wpd-swatch-button--selected")}
                          title={preset.label}
                        >
                          <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect x="0" y="0" width="32" height="32" rx="6" fill={preset.color} /></svg>
                        </button>
                      );
                    })}
                    <label
                      aria-label="Ikinci ozel renk gir"
                      className="wpd-color-label"
                    >
                      <input
                        type="color"
                        value={selectedProfile.secondary_accent_color || "#9ca3af"}
                        onChange={(event) => updateSelected({ secondary_accent_color: event.target.value })}
                        className="wpd-color-input"
                      />
                      <span className="wpd-color-label-text">Özel 2</span>
                    </label>
                  </div>
                </div>
                {!isSelfMode ? (
                  <>
                    <div className="wpd-control-section">
                      <div className="wpd-control-kicker">Panel Ikonu</div>
                      <div className="wpd-swatch-row">
                        {ROLE_ICON_PRESETS.map((preset) => {
                          const current = resolvedIcon(selectedProfile);
                          const isSelected = (selectedProfile.icon || "") === preset.icon || (!selectedProfile.icon && current === preset.icon);
                          return (
                            <button
                              key={preset.icon}
                              type="button"
                              aria-label={`Ikon sec: ${preset.label}`}
                              aria-pressed={isSelected ? "true" : "false"}
                              onClick={() => updateSelected({ icon: preset.icon })}
                              className={cx("wpd-icon-button", isSelected && "wpd-icon-button--selected")}
                            >
                              {preset.icon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="wpd-control-section">
                      <div className="wpd-control-kicker">Menu Stili</div>
                      <div className="wpd-option-stack">
                        {WORKSPACE_PANEL_MENU_STYLE_OPTIONS.map((item) => {
                          const selected = selectedMenuStyle === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => updateSelected({ menu_style: item.key })}
                              className={cx("wpd-menu-option", selected && "wpd-menu-option--selected")}
                            >
                              <span className="wpd-strong">{item.label}</span>
                              <span className="wpd-menu-option-description">{item.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {isSelfMode ? (() => {
                const restricted = selectedProfile.restricted_customization_sections || [];
                const textsLocked = restricted.includes("texts");
                const colorsLocked = restricted.includes("colors");
                return (
                <div className="wpd-form-grid">
                  {!textsLocked && (
                    <>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Hero Basligi</span>
                        <input value={selectedProfile.hero_title} onChange={(event) => updateSelected({ hero_title: event.target.value })} placeholder="Panel hero basligi" className="wpd-input" />
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Ust Bilgi (Top Notice)</span>
                        <input value={selectedProfile.top_notice || ""} onChange={(event) => updateSelected({ top_notice: event.target.value })} placeholder="Ornek: Surum 2026.Q2 yayinda" className="wpd-input" />
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Header Bilgisi</span>
                        <input value={selectedProfile.header_info || ""} onChange={(event) => updateSelected({ header_info: event.target.value })} placeholder="Ornek: SLA: %99.9" className="wpd-input" />
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Alt Bilgi (Footer)</span>
                        <input value={selectedProfile.footer_info || ""} onChange={(event) => updateSelected({ footer_info: event.target.value })} placeholder="Ornek: Son guncelleme: Bugun" className="wpd-input" />
                      </label>
                    </>
                  )}
                  {!colorsLocked && (
                    <>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Header Arkaplan Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.header_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.header_bg_color || "#0f172acc"} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} placeholder="#0f172acc" className="wpd-input" />
                        </div>
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Header Yazi Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.header_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ header_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.header_text_color || "#f8fafc"} onChange={(event) => updateSelected({ header_text_color: event.target.value })} placeholder="#f8fafc" className="wpd-input" />
                        </div>
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Footer Arkaplan Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.footer_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.footer_bg_color || "#0f172a99"} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} placeholder="#0f172a99" className="wpd-input" />
                        </div>
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Footer Yazi Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.footer_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.footer_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} placeholder="#e2e8f0" className="wpd-input" />
                        </div>
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Hero Yazi Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.hero_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.hero_text_color || "#f8fafc"} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} placeholder="#f8fafc" className="wpd-input" />
                        </div>
                      </label>
                      <label className="wpd-field">
                        <span className="wpd-field-label">Hero Yardimci Yazi Rengi</span>
                        <div className="wpd-color-field-row">
                          <input type="color" value={(selectedProfile.hero_muted_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                          <input value={selectedProfile.hero_muted_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} placeholder="#e2e8f0" className="wpd-input" />
                        </div>
                      </label>
                    </>
                  )}
                  {textsLocked && colorsLocked && (
                    <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                      Bu panel için kişisel düzenleme kısıtlanmıştır. Platform yöneticinizle iletişime geçin.
                    </p>
                  )}
                </div>
                );
              })() : (
              <div className="wpd-form-grid">
                <label className="wpd-field">
                  <span className="wpd-field-label">Business Role</span>
                  <input value={selectedProfile.business_role} onChange={(event) => updateSelected({ business_role: event.target.value })} placeholder="or: manager" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">System Role</span>
                  <input value={selectedProfile.system_role || ""} onChange={(event) => updateSelected({ system_role: event.target.value })} placeholder="or: tenant_member" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Panel Basligi</span>
                  <input value={selectedProfile.title} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="örn: Yönetici Paneli" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Menu Etiketi</span>
                  <input value={selectedProfile.nav_label} onChange={(event) => updateSelected({ nav_label: event.target.value })} placeholder="örn: Yönetici" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Workspace Etiketi</span>
                  <input value={selectedProfile.workspace_label} onChange={(event) => updateSelected({ workspace_label: event.target.value })} placeholder="örn: Yönetici Calisma Alani" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Hero Basligi</span>
                  <input value={selectedProfile.hero_title} onChange={(event) => updateSelected({ hero_title: event.target.value })} placeholder="Panel hero basligi" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Ust Bilgi (Top Notice)</span>
                  <input value={selectedProfile.top_notice || ""} onChange={(event) => updateSelected({ top_notice: event.target.value })} placeholder="Ornek: Surum 2026.Q2 yayinda" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Header Bilgisi</span>
                  <input value={selectedProfile.header_info || ""} onChange={(event) => updateSelected({ header_info: event.target.value })} placeholder="Ornek: SLA: %99.9" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Header Arkaplan Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.header_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.header_bg_color || "#0f172acc"} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} placeholder="#0f172acc" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Header Yazi Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.header_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ header_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.header_text_color || "#f8fafc"} onChange={(event) => updateSelected({ header_text_color: event.target.value })} placeholder="#f8fafc" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Alt Bilgi (Footer)</span>
                  <input value={selectedProfile.footer_info || ""} onChange={(event) => updateSelected({ footer_info: event.target.value })} placeholder="Ornek: Son guncelleme: Bugun" className="wpd-input" />
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Footer Arkaplan Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.footer_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.footer_bg_color || "#0f172a99"} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} placeholder="#0f172a99" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Footer Yazi Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.footer_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.footer_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} placeholder="#e2e8f0" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Hero Yazi Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.hero_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.hero_text_color || "#f8fafc"} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} placeholder="#f8fafc" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field">
                  <span className="wpd-field-label">Hero Yardimci Yazi Rengi</span>
                  <div className="wpd-color-field-row">
                    <input type="color" value={(selectedProfile.hero_muted_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} className="wpd-color-input wpd-color-input--large" />
                    <input value={selectedProfile.hero_muted_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} placeholder="#e2e8f0" className="wpd-input" />
                  </div>
                </label>
                <label className="wpd-field wpd-field--toggle">
                  <span className="wpd-field-label">Kullanıcı Kendi Template'ini Düzenleyebilsin</span>
                  <button
                    type="button"
                    onClick={() => updateSelected({ allow_user_self_customization: !selectedProfile.allow_user_self_customization })}
                    className={cx("wpd-toggle-button", selectedProfile.allow_user_self_customization && "wpd-toggle-button--on")}
                  >
                    {selectedProfile.allow_user_self_customization ? "Açık" : "Kapalı"}
                  </button>
                </label>
                {selectedProfile.allow_user_self_customization && (
                  <div className="wpd-control-section">
                    <div className="wpd-section-title">Kişisel Düzenleme Kısıtlamaları</div>
                    <div className="wpd-option-stack">
                      {([
                        { key: "texts", label: "Metin Düzenleme (Başlık / Bildirimler)" },
                        { key: "colors", label: "Renk Değişikliği (Header / Footer / Hero)" },
                        { key: "quick_links", label: "Hızlı Bağlantılar" },
                      ] as const).map(({ key, label }) => {
                        const restricted = (selectedProfile.restricted_customization_sections || []).includes(key);
                        return (
                          <div key={key} className="wpd-tab-row">
                            <div className="wpd-tab-main">
                              <button
                                type="button"
                                onClick={() => {
                                  const current = selectedProfile.restricted_customization_sections || [];
                                  const next = restricted ? current.filter((s) => s !== key) : [...current, key];
                                  updateSelected({ restricted_customization_sections: next });
                                }}
                                className={cx("wpd-check-button", restricted && "wpd-check-button--enabled")}
                              >
                                {restricted ? "✓" : ""}
                              </button>
                              <span className={cx("wpd-tab-status", restricted && "wpd-tab-status--enabled")}>
                                {restricted ? "Kısıtlı" : "Serbest"}
                              </span>
                              <div className={cx("wpd-tab-title", restricted && "wpd-tab-title--enabled")}>{label}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              )}

              {!isSelfMode ? (
              <label className="wpd-field">
                <span className="wpd-field-label">Kısa Açıklama</span>
                <textarea value={selectedProfile.description} onChange={(event) => updateSelected({ description: event.target.value })} rows={3} className="wpd-textarea wpd-textarea--medium" />
              </label>
              ) : null}

              <label className="wpd-field">
                <span className="wpd-field-label">Hero Açıklama</span>
                <textarea value={selectedProfile.hero_description} onChange={(event) => updateSelected({ hero_description: event.target.value })} rows={4} className="wpd-textarea wpd-textarea--tall" />
              </label>

              {!isSelfMode ? (
              <div className="wpd-control-section">
                <div className="wpd-section-title">Gorulecek Sekmeler</div>
                <div className="wpd-option-stack">
                  {WORKSPACE_PANEL_TAB_OPTIONS.map((tab) => {
                    const enabled = selectedProfile.allowed_tabs.includes(tab.key);
                    const tabIndex = selectedProfile.allowed_tabs.indexOf(tab.key);
                    return (
                      <div
                        key={tab.key}
                        draggable={enabled}
                        onDragStart={() => {
                          if (enabled && tabIndex >= 0) handleTabDragStart(tabIndex);
                        }}
                        onDragOver={(e) => {
                          if (enabled && tabIndex >= 0) handleTabDragOver(e, tabIndex);
                        }}
                        onDragEnd={handleTabDragEnd}
                        className={cx("wpd-tab-row", enabled && "wpd-tab-row--enabled")}
                      >
                        <div className="wpd-tab-main">
                          <button
                            type="button"
                            aria-label={`${tab.label} durumunu degistir`}
                            onClick={() => toggleTab(tab.key)}
                            className={cx("wpd-check-button", enabled && "wpd-check-button--enabled")}
                          >
                            {enabled ? "✓" : ""}
                          </button>
                          <span className={cx("wpd-tab-status", enabled && "wpd-tab-status--enabled")}>{enabled ? "Açık" : "Kapalı"}</span>
                          <span className={cx("wpd-drag-glyph", enabled && "wpd-drag-glyph--enabled")}>{enabled ? "⠿" : "□"}</span>
                          <div className={cx("wpd-tab-title", enabled && "wpd-tab-title--enabled")}>
                            {enabled && tabIndex >= 0 ? `${tabIndex + 1}. ` : ""}
                            {tab.label}
                          </div>
                        </div>
                        <div className="wpd-color-field-row">
                          <button type="button" aria-label={`${tab.label} sekmesini yukari tasi`} onClick={() => moveAllowedTab(tab.key, -1)} disabled={!enabled || tabIndex <= 0} className="wpd-mini-button">
                            ↑
                          </button>
                          <button type="button" aria-label={`${tab.label} sekmesini asagi tasi`} onClick={() => moveAllowedTab(tab.key, 1)} disabled={!enabled || tabIndex === selectedProfile.allowed_tabs.length - 1} className="wpd-mini-button">
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : null}

              {!isSelfMode ? (
              <div className="wpd-control-section">
                <div className="wpd-section-head">
                  <div className="wpd-section-title">Hizli Linkler</div>
                  <button type="button" onClick={addQuickLink} className="wpd-mini-button wpd-mini-button--success">
                    + Hizli Link Ekle
                  </button>
                </div>
                {(selectedProfile.quick_links || []).length === 0 ? (
                  <div className="wpd-empty-box">
                    Bu profil icin ozel hizli link tanimlanmadi. Varsayilan linkler kullanilir.
                  </div>
                ) : (
                  <div className="wpd-link-list">
                    {(selectedProfile.quick_links || []).map((link, index) => (
                      <div
                        key={`quick-link-${index}`}
                        draggable
                        onDragStart={() => handleLinkDragStart(index)}
                        onDragOver={(e) => handleLinkDragOver(e, index)}
                        onDragEnd={handleLinkDragEnd}
                        className="wpd-quick-link-card"
                      >
                        <div className="wpd-link-card-head">
                          <div className="wpd-link-card-title">
                            <span className="wpd-drag-glyph">⠿</span>
                            Hizli Link {index + 1}
                          </div>
                          <div className="wpd-color-field-row">
                            <button type="button" aria-label={`Hizli link ${index + 1} yukari tasi`} onClick={() => moveQuickLink(index, -1)} disabled={index === 0} className="wpd-mini-button">Yukari</button>
                            <button type="button" aria-label={`Hizli link ${index + 1} asagi tasi`} onClick={() => moveQuickLink(index, 1)} disabled={index === (selectedProfile.quick_links || []).length - 1} className="wpd-mini-button">Asagi</button>
                            <button type="button" aria-label={`Hizli link ${index + 1} kaldir`} onClick={() => removeQuickLink(index)} className="wpd-mini-button wpd-mini-button--danger">Kaldir</button>
                          </div>
                        </div>
                        <div className="wpd-form-grid">
                          <label className="wpd-field">
                            <span className="wpd-field-label">Link Etiketi</span>
                            <input value={link.label} onChange={(event) => updateQuickLink(index, { label: event.target.value })} placeholder="or: Dashboard" className="wpd-input" />
                          </label>
                          <label className="wpd-field">
                            <span className="wpd-field-label">Href</span>
                            <input value={link.href} onChange={(event) => updateQuickLink(index, { href: event.target.value })} placeholder="or: /dashboard" className="wpd-input" />
                          </label>
                        </div>
                        <label className="wpd-field">
                          <span className="wpd-field-label">Link Açıklaması</span>
                          <textarea value={link.description} onChange={(event) => updateQuickLink(index, { description: event.target.value })} rows={3} className="wpd-textarea wpd-textarea--short" />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ── Renk Şeması Kartı ─────────────────────────────────────────────── */}
      <div className="wpd-card pcs-root">
        <div className="wpd-eyebrow">Renk Şeması</div>
        <div className="wpd-page-title">Segment Renk Ayarları</div>
        <div className="wpd-page-copy">
          Her segment için ana renk, koyu ton, açık zemin ve ikincil rengi özelleştirin.
          Değişiklikler "Kaydet ve Yayınla" sonrası tüm panellere anında yansır.
        </div>
        {colorLoadStatus === 'loading' && (
          <div className="wpd-empty">Renk ayarları yükleniyor…</div>
        )}
        {colorLoadStatus === 'error' && (
          <div role="alert" className="wpd-alert-error">Renk ayarları yüklenemedi. Sayfayı yenileyin.</div>
        )}
        {colorLoadStatus === 'done' && !canEditColors && (
          <div className="pcs-readonly-note">
            Bu bölümü düzenlemek için yetki gerekli (Super Admin veya <strong>panel_design.edit</strong> izni).
          </div>
        )}
        {colorLoadStatus === 'done' && (
          <>
            <div className="pcs-segments">
              {(Object.keys(PANEL_COLORS) as SegmentKey[]).map((segKey) => {
                const defaults = PANEL_COLORS[segKey];
                const resolved = resolvedColors[segKey];
                const override = colorDraft[segKey] || {};
                const hasOverride = Object.keys(override).length > 0;
                return (
                  <div key={segKey} className="pcs-segment-card">
                    <div className="pcs-segment-head">
                      <div className="pcs-segment-info">
                        <div className="pcs-swatches" aria-hidden="true">
                          <svg className="pcs-swatch" width="24" height="24" viewBox="0 0 24 24" title={`Accent: ${resolved.accent}`}>
                            <rect width="24" height="24" rx="5" fill={resolved.accent} />
                          </svg>
                          <svg className="pcs-swatch pcs-swatch--sm" width="16" height="24" viewBox="0 0 16 24" title={`Koyu: ${resolved.accentDark}`}>
                            <rect width="16" height="24" rx="4" fill={resolved.accentDark} />
                          </svg>
                          <svg className="pcs-swatch pcs-swatch--sm" width="16" height="24" viewBox="0 0 16 24" title={`Tint: ${resolved.accentTint}`}>
                            <rect width="16" height="24" rx="4" fill={resolved.accentTint} stroke="rgba(15,23,42,0.08)" strokeWidth="1" />
                          </svg>
                          {resolved.secondary && (
                            <svg className="pcs-swatch pcs-swatch--sm" width="16" height="24" viewBox="0 0 16 24" title={`İkincil: ${resolved.secondary}`}>
                              <rect width="16" height="24" rx="4" fill={resolved.secondary} />
                            </svg>
                          )}
                          <svg className="pcs-swatch pcs-swatch--on" width="32" height="24" viewBox="0 0 32 24" title={`Üst metin: ${resolved.onAccent}`}>
                            <rect width="32" height="24" rx="5" fill={resolved.accent} />
                            <text x="16" y="17" textAnchor="middle" fill={resolved.onAccent} fontSize="11" fontWeight="700">Aa</text>
                          </svg>
                        </div>
                        <div>
                          <div className="pcs-seg-name">{defaults.label}</div>
                          <div className="pcs-seg-key">{segKey}{hasOverride ? ' · özel' : ''}</div>
                        </div>
                      </div>
                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => resetSegmentColors(segKey)}
                          disabled={!canEditColors}
                          className="wpd-button wpd-button--warning pcs-reset-btn"
                        >
                          Varsayılana Dön
                        </button>
                      )}
                    </div>

                    <div className="pcs-color-fields">
                      {([
                        { field: 'accent', label: 'Accent (Ana Renk)' },
                        { field: 'accentDark', label: 'Koyu (Gradient / Derinlik)' },
                        { field: 'accentTint', label: 'Tint (Açık Zemin)' },
                        { field: 'onAccent', label: 'Üst Metin Rengi' },
                      ] as const).map(({ field, label }) => {
                        const val = (override[field] as string | undefined) ?? defaults[field];
                        return (
                          <label key={field} className="wpd-field">
                            <span className="wpd-field-label">{label}</span>
                            <div className="wpd-color-field-row">
                              <input
                                type="color"
                                value={val.slice(0, 7)}
                                disabled={!canEditColors}
                                onChange={(e) => updateColorField(segKey, field, e.target.value)}
                                className="wpd-color-input wpd-color-input--large"
                                aria-label={`${defaults.label} ${label}`}
                              />
                              <input
                                value={val}
                                disabled={!canEditColors}
                                onChange={(e) => updateColorField(segKey, field, e.target.value || null)}
                                placeholder={defaults[field]}
                                className="wpd-input"
                              />
                            </div>
                          </label>
                        );
                      })}
                      <label className="wpd-field">
                        <span className="wpd-field-label">İkincil Renk</span>
                        <div className="wpd-color-field-row">
                          <input
                            type="color"
                            value={((override.secondary as string | null | undefined) ?? defaults.secondary ?? '#9ca3af').slice(0, 7)}
                            disabled={!canEditColors}
                            onChange={(e) => updateColorField(segKey, 'secondary', e.target.value)}
                            className="wpd-color-input wpd-color-input--large"
                            aria-label={`${defaults.label} ikincil renk`}
                          />
                          <input
                            value={(override.secondary as string | null | undefined) ?? defaults.secondary ?? ''}
                            disabled={!canEditColors}
                            onChange={(e) => updateColorField(segKey, 'secondary', e.target.value || null)}
                            placeholder={defaults.secondary ?? 'Yok (varsayılan)'}
                            className="wpd-input"
                          />
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="wpd-actions">
              <button
                type="button"
                onClick={() => void saveColorTheme()}
                disabled={!canEditColors || colorSaveStatus === 'saving'}
                className="wpd-button wpd-button--primary"
              >
                {colorSaveStatus === 'saving' ? 'Kaydediliyor…' : 'Kaydet ve Yayınla'}
              </button>
            </div>
            {colorSaveMsg && (
              <div role="alert" className={colorSaveStatus === 'error' ? 'wpd-alert-error' : 'wpd-apply-message'}>
                {colorSaveMsg}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function buildDesignerResetKey(
  config: WorkspacePanelConfig,
  mode: "full" | "self",
  currentUser?: AuthUser | null,
  lockedProfile?: WorkspacePanelProfile | null,
) {
  const lockedKey = lockedProfile ? profileKey(lockedProfile.business_role, lockedProfile.system_role || null) : "";
  return `${mode}:${currentUser?.id || ""}:${lockedKey}:${JSON.stringify(config)}`;
}

function getInitialSelectedProfileIndex(
  draft: WorkspacePanelConfig,
  mode: "full" | "self",
  currentUser?: AuthUser | null,
  lockedProfile?: WorkspacePanelProfile | null,
) {
  if (mode !== "self" || !currentUser || !lockedProfile) return 0;
  const targetKey = resolveSelfCustomizationProfileKey(draft, currentUser, lockedProfile);
  const nextIndex = draft.profiles.findIndex((item) => profileKey(item.business_role, item.system_role || null) === targetKey);
  return nextIndex >= 0 ? nextIndex : 0;
}

function normalizeMenuStyle(value: WorkspacePanelProfile["menu_style"]): "pill" | "accordion" | "drawer" | "tabs" {
  if (value === "accordion" || value === "drawer" || value === "tabs") return value;
  return "pill";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeCssClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

// Strict whitelist: only CSS color values accepted (for user-supplied profile fields).
// Rejects url(), expression(), @import, arbitrary CSS, etc.
function safeCssColorValue(value: string): string {
  const s = String(value).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;                  // hex: #rgb #rgba #rrggbb #rrggbbaa
  if (/^(rgb|rgba|hsl|hsla)\([^)]{1,120}\)$/.test(s)) return s;  // functional colors
  if (/^[a-zA-Z]{2,30}$/.test(s)) return s;                      // named: transparent, none, blue
  return "transparent";
}

// Wider whitelist: for computed palette values that may include gradients or box-shadows.
// These values are always built from already-validated hex inputs in getPreviewPalette().
function safeCssPaletteValue(value: string): string {
  const s = String(value).trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([^)]{1,120}\)$/.test(s)) return s;
  if (s === "none" || s === "transparent") return s;
  // linear-gradient: anchored regex ensures nothing can escape the parentheses
  if (/^linear-gradient\([^;]{1,500}\)$/.test(s)) return s;
  // box-shadow "0 0 Npx rgba(...)" used for glowShadow
  if (/^0 0 \d{1,3}px (rgba\([^)]{1,80}\)|#[0-9a-fA-F]{3,8})$/.test(s)) return s;
  return "transparent";
}

function useWorkspaceDesignerDynamicStyles(cssText: string) {
  useEffect(() => {
    if (!cssText || typeof document === "undefined" || !("adoptedStyleSheets" in document)) return undefined;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    const currentSheets = document.adoptedStyleSheets;
    document.adoptedStyleSheets = [...currentSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
    };
  }, [cssText]);
}

function buildInitialDraft(
  config: WorkspacePanelConfig,
  mode: "full" | "self",
  currentUser?: AuthUser | null,
  lockedProfile?: WorkspacePanelProfile | null,
): WorkspacePanelConfig {
  if (mode !== "self" || !currentUser || !lockedProfile) {
    return config;
  }
  const clonedProfiles = [...(config.profiles || [])];
  const clonedOverrides = [...(config.user_overrides || [])];
  const targetKey = resolveSelfCustomizationProfileKey({ ...config, profiles: clonedProfiles, user_overrides: clonedOverrides }, currentUser, lockedProfile);
  const existingIndex = clonedProfiles.findIndex((item) => profileKey(item.business_role, item.system_role || null) === targetKey);
  if (existingIndex < 0) {
    clonedProfiles.push(createSelfCustomizationProfile(currentUser, lockedProfile));
  }
  const filteredOverrides = clonedOverrides.filter((item) => {
    if (typeof currentUser.id === "number" && item.user_id != null) return item.user_id !== currentUser.id;
    if (currentUser.email && item.user_email) return String(item.user_email).trim().toLowerCase() !== String(currentUser.email).trim().toLowerCase();
    return true;
  });
  filteredOverrides.push({
    user_id: typeof currentUser.id === "number" ? currentUser.id : null,
    user_email: String(currentUser.email || "").trim().toLowerCase() || null,
    profile_key: targetKey,
    note: "self-customization",
  });
  return {
    ...config,
    profiles: clonedProfiles,
    user_overrides: filteredOverrides,
  };
}

function resolveSelfCustomizationProfileKey(
  config: WorkspacePanelConfig,
  currentUser: AuthUser,
  lockedProfile: WorkspacePanelProfile,
): string {
  const currentUserId = typeof currentUser.id === "number" ? currentUser.id : null;
  const currentUserEmail = String(currentUser.email || "").trim().toLowerCase();
  const existingOverride = (config.user_overrides || []).find((item) => {
    if (currentUserId != null && item.user_id != null && item.user_id === currentUserId) return true;
    if (currentUserEmail && item.user_email && String(item.user_email).trim().toLowerCase() === currentUserEmail) return true;
    return false;
  });
  if (existingOverride?.profile_key) return existingOverride.profile_key;
  const selfProfile = createSelfCustomizationProfile(currentUser, lockedProfile);
  return profileKey(selfProfile.business_role, selfProfile.system_role || null);
}

function createSelfCustomizationProfile(currentUser: AuthUser, baseProfile: WorkspacePanelProfile): WorkspacePanelProfile {
  const suffix = typeof currentUser.id === "number"
    ? `u${currentUser.id}`
    : String(currentUser.email || "self").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 18).toLowerCase();
  const normalizedBusiness = `${String(baseProfile.business_role || "profile").slice(0, 80)}__${suffix}`.slice(0, 100);
  const normalizedSystem = `${String(baseProfile.system_role || "self").slice(0, 80)}__${suffix}`.slice(0, 100);
  return {
    ...baseProfile,
    business_role: normalizedBusiness,
    system_role: normalizedSystem,
  };
}

function profileKey(businessRole?: string | null, systemRole?: string | null): string {
  return `${String(businessRole || "").trim().toLowerCase()}:${String(systemRole || "").trim().toLowerCase()}`;
}

function normalizeRange(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(15,23,42,${alpha})`;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPreviewPalette(
  businessRole?: string | null,
  accentColor?: string | null,
  secondaryAccentColor?: string | null,
  accentOpacity?: number | null,
  secondaryAccentOpacity?: number | null,
  primaryAccentStop?: number | null,
  secondaryAccentStart?: number | null,
  glowIntensity?: number | null,
) {
  const normalized = String(businessRole || "").trim().toLowerCase();
  const opacity = normalizeRange(accentOpacity, 0.2, 1, 0.85);
  const secondOpacity = normalizeRange(secondaryAccentOpacity, 0.2, 1, 0.7);
  const firstStop = normalizeRange(primaryAccentStop, 20, 80, 48);
  const secondStart = normalizeRange(secondaryAccentStart, 40, 100, 72);
  const glow = normalizeRange(glowIntensity, 0, 1, 0.45);

  // Kullanici ozel renk sectiyse, o rengi hero gradient olarak kullan
  if (accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
    const hasSecondary = !!(secondaryAccentColor && /^#[0-9A-Fa-f]{6}$/.test(secondaryAccentColor));
    const second = hasSecondary
      ? secondaryAccentColor
      : accentColor;
    const glowShadow = `0 0 ${Math.round(24 + glow * 26)}px ${hexToRgba(accentColor, 0.2 + glow * 0.45)}`;
    return {
      hero: hasSecondary
        ? `linear-gradient(95deg, ${hexToRgba(accentColor, opacity)} 0%, ${hexToRgba(accentColor, opacity)} ${firstStop}%, ${hexToRgba(second, secondOpacity)} ${secondStart}%, ${hexToRgba(second, Math.max(0.22, secondOpacity - 0.2))} 100%)`
        : `linear-gradient(95deg, ${hexToRgba(accentColor, opacity)} 0%, ${hexToRgba(accentColor, Math.max(0.25, opacity - 0.18))} 100%)`,
      canvas: "#f8fafc",
      border: `${accentColor}33`,
      pillBackground: `${accentColor}18`,
      pillText: accentColor,
      link: accentColor,
      glowShadow,
    };
  }
  if (normalized.includes("supplier")) {
    return {
      hero: "linear-gradient(95deg, #0f3d3e 0%, #136f63 56%, #7ed6c4 100%)",
      canvas: "#f2fbf8",
      border: "#b7e4da",
      pillBackground: "#dcfce7",
      pillText: "#166534",
      link: "#0f766e",
      glowShadow: "0 0 26px rgba(20, 184, 166, 0.28)",
    };
  }
  if (normalized.includes("channel")) {
    return {
      hero: "linear-gradient(95deg, #312e81 0%, #1d4ed8 56%, #93c5fd 100%)",
      canvas: "#f5f8ff",
      border: "#c7d2fe",
      pillBackground: "#dbeafe",
      pillText: "#1d4ed8",
      link: "#1d4ed8",
      glowShadow: "0 0 24px rgba(59, 130, 246, 0.24)",
    };
  }
  if (normalized.includes("super") || normalized.includes("platform")) {
    return {
      hero: "linear-gradient(95deg, #1d1f3f 0%, #2c4172 56%, #7ca7d8 100%)",
      canvas: "#f6f8fc",
      border: "#cbd5e1",
      pillBackground: "#dbeafe",
      pillText: "#1e3a8a",
      link: "#2563eb",
      glowShadow: "0 0 22px rgba(59, 130, 246, 0.2)",
    };
  }
  return {
    hero: "linear-gradient(95deg, #16302b 0%, #294d45 56%, #d8b16a 100%)",
    canvas: "#fffaf2",
    border: "#e7dcc4",
    pillBackground: "#fef3c7",
    pillText: "#92400e",
    link: "#b45309",
    glowShadow: "0 0 22px rgba(180, 83, 9, 0.18)",
  };
}
