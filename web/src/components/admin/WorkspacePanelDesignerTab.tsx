import { useEffect, useMemo, useRef, useState } from "react";

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

export function WorkspacePanelDesignerTab({ config, sourceConfig, currentUser, personnel = [], mode = "full", lockedProfile = null, saving, onSave }: Props) {
  const [draft, setDraft] = useState<WorkspacePanelConfig>(() => buildInitialDraft(config, mode, currentUser, lockedProfile));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [importError, setImportError] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<null | "hero_title" | "hero_description">(null);
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [selectedMenuStyle, setSelectedMenuStyle] = useState<"pill" | "accordion" | "drawer" | "tabs">("pill");
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [previewPulse, setPreviewPulse] = useState(false);
  const [selectedOverrideUserIds, setSelectedOverrideUserIds] = useState<string[]>([]);
  const [overrideUserSearchQuery, setOverrideUserSearchQuery] = useState("");
  const [overrideUserFilter, setOverrideUserFilter] = useState<"all" | "selected" | "assigned" | "unassigned">("all");
  const dragTabIndexRef = useRef<number | null>(null);
  const dragLinkIndexRef = useRef<number | null>(null);
  const isSelfMode = mode === "self";

  const selectedProfile = draft.profiles[selectedIndex] || null;
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

  useEffect(() => {
    setSelectedMenuStyle((selectedProfile?.menu_style as "pill" | "accordion" | "drawer" | "tabs") || "pill");
  }, [selectedProfile?.menu_style, selectedIndex]);

  useEffect(() => {
    const nextDraft = buildInitialDraft(config, mode, currentUser, lockedProfile);
    setDraft(nextDraft);
    if (mode === "self" && currentUser && lockedProfile) {
      const targetKey = resolveSelfCustomizationProfileKey(nextDraft, currentUser, lockedProfile);
      const nextIndex = nextDraft.profiles.findIndex((item) => profileKey(item.business_role, item.system_role || null) === targetKey);
      setSelectedIndex(nextIndex >= 0 ? nextIndex : 0);
      return;
    }
    setSelectedIndex(0);
  }, [config, mode, currentUser, lockedProfile]);

  useEffect(() => {
    if (profileLinkedUsers.length === 0) {
      setSelectedOverrideUserIds([]);
      return;
    }
    if (selectedOverrideUserIds.length === 0) {
      const currentUserOption = profileLinkedUsers.find((item) => item.id === currentUser?.id);
      setSelectedOverrideUserIds([String((currentUserOption || profileLinkedUsers[0]).id)]);
      return;
    }
    const allowedSet = new Set(profileLinkedUsers.map((item) => String(item.id)));
    const filteredSelection = selectedOverrideUserIds.filter((item) => allowedSet.has(item));
    if (filteredSelection.length !== selectedOverrideUserIds.length) {
      setSelectedOverrideUserIds(filteredSelection.length > 0 ? filteredSelection : [String(profileLinkedUsers[0].id)]);
    }
  }, [currentUser?.id, profileLinkedUsers, selectedOverrideUserIds]);

  function toggleOverrideUser(userId: string) {
    setSelectedOverrideUserIds((current) => (current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]));
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
          ? `Kullanici override kaydedildi: ${targetUsers.length} kullanici -> ${selectedProfile?.title || selectedProfile?.business_role}`
          : `Kullanici override temizlendi (${targetUsers.length} kullanici).`
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
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ borderRadius: 20, border: "1px solid #dbe3ee", background: "white", padding: 20, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#8a5b2b" }}>Panel Tasarimi</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{isSelfMode ? "Kisisel Template Ayarlari" : "Rol bazli panelleri ayir ve yonet"}</div>
        <div style={{ color: "#64748b", maxWidth: 920 }}>
          {isSelfMode
            ? "Bu alan sadece kendi panel temani duzenlemek icin aciktir. Rol, sekme ve kapsam degistiremezsin; sadece metin ve renk template'ini guncellersin."
            : "Super admin bu alandan her rol profili icin ayri panel adi, aciklama ve gorulecek sekmeleri duzenleyebilir. Yeni bir is rolu eklendiginde burada yeni profil acilarak panel kapsami tanimlanabilir."}
        </div>
        <div style={{ color: "#475569", fontSize: 13, maxWidth: 920 }}>
          Renk uygulama notu: Birinci renk ana vurgu icindir. Ikinci renk opsiyoneldir (Yok secilebilir). 1. renk kapsami ve 2. renk baslangic yuzdesiyle soldan saga dagilim ayarlanir.
        </div>
        {!isSelfMode ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 420px)", gap: 8, alignItems: "start" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Bu Profile Bagli Kullanicilar (Coklu Secim)</span>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
              <input
                value={overrideUserSearchQuery}
                onChange={(event) => setOverrideUserSearchQuery(event.target.value)}
                placeholder="Kullanici adi, e-posta veya role gore ara"
                style={inputStyle}
              />
              <select value={overrideUserFilter} onChange={(event) => setOverrideUserFilter(event.target.value as "all" | "selected" | "assigned" | "unassigned")} style={{ ...inputStyle, width: 150 }}>
                <option value="all">Tumu</option>
                <option value="selected">Secili</option>
                <option value="assigned">Override var</option>
                <option value="unassigned">Override yok</option>
              </select>
            </div>
            <div style={{ border: "1px solid #dbe3ee", borderRadius: 12, background: "#f8fafc", padding: 10, display: "grid", gap: 8, maxHeight: 230, overflow: "auto" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "#1f2937" }}>
                <input
                  type="checkbox"
                  checked={filteredOverrideUsers.length > 0 && filteredOverrideUsers.every((item) => selectedOverrideUserIds.includes(String(item.id)))}
                  onChange={toggleAllOverrideUsers}
                />
                Tumunu Sec / Kaldir
              </label>
              {profileLinkedUsers.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Bu profile bagli kullanici bulunamadi.</div>
              ) : filteredOverrideUsers.length === 0 ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Arama / filtre sonucunda kullanici bulunamadi.</div>
              ) : groupedFilteredOverrideUsers.map((group) => (
                <div key={group.key} style={{ display: "grid", gap: 6, borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", padding: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: "#475569" }}>{group.title}</div>
                  {group.users.map((item) => {
                    const checked = selectedOverrideUserIds.includes(String(item.id));
                    return (
                      <label key={item.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center", gap: 8, fontSize: 12, color: "#0f172a" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOverrideUser(String(item.id))} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.full_name} - {item.email}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: item.hasOverride ? "#1d4ed8" : "#94a3b8" }}>{item.hasOverride ? "Override var" : "Varsayilan"}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </label>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Liste sadece secili profilin rol ve sistem rolune bagli personelleri gosterir. Tiklenen kullanicilara toplu override uygulanir. Oturum kullanicisi: {currentUser?.email || "-"}
          </div>
        </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isSelfMode ? (
            <button type="button" onClick={addProfile} style={{ borderRadius: 999, border: "none", background: "#0f766e", color: "white", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
              + Yeni Rol Profili
            </button>
          ) : null}
          <button type="button" onClick={applyDesignerEditsToSelected} disabled={!selectedProfile} style={{ borderRadius: 999, border: "1px solid #1d4ed8", background: !selectedProfile ? "#cbd5e1" : "#eff6ff", color: !selectedProfile ? "#64748b" : "#1d4ed8", padding: "10px 16px", fontWeight: 800, cursor: !selectedProfile ? "not-allowed" : "pointer" }}>
            {isSelfMode ? "Onizlemeye Uygula" : "Uygula (Secili Profil)"}
          </button>
          {!isSelfMode ? (
            <>
              <button type="button" onClick={() => void assignSelectedProfileToCurrentUser()} disabled={!selectedProfile || (profileLinkedUsers.length === 0 && !currentUser?.email)} style={{ borderRadius: 999, border: "1px solid #0f766e", background: !selectedProfile || (profileLinkedUsers.length === 0 && !currentUser?.email) ? "#cbd5e1" : "#ecfdf5", color: !selectedProfile || (profileLinkedUsers.length === 0 && !currentUser?.email) ? "#64748b" : "#047857", padding: "10px 16px", fontWeight: 800, cursor: !selectedProfile || (profileLinkedUsers.length === 0 && !currentUser?.email) ? "not-allowed" : "pointer" }}>
                Bu Profili Hedef Kullaniciya Ata
              </button>
              <button type="button" onClick={() => void persistOverridesForUsers(profileLinkedUsers, "assign")} disabled={!selectedProfile || profileLinkedUsers.length === 0} style={{ borderRadius: 999, border: "1px solid #7c3aed", background: !selectedProfile || profileLinkedUsers.length === 0 ? "#e2e8f0" : "#f5f3ff", color: !selectedProfile || profileLinkedUsers.length === 0 ? "#64748b" : "#6d28d9", padding: "10px 16px", fontWeight: 800, cursor: !selectedProfile || profileLinkedUsers.length === 0 ? "not-allowed" : "pointer" }}>
                Profili Tum Bagli Kullanicilara Uygula
              </button>
              <button type="button" onClick={() => void persistOverridesForUsers(unassignedLinkedUsers, "assign")} disabled={!selectedProfile || unassignedLinkedUsers.length === 0} style={{ borderRadius: 999, border: "1px solid #0f766e", background: !selectedProfile || unassignedLinkedUsers.length === 0 ? "#e2e8f0" : "#ecfeff", color: !selectedProfile || unassignedLinkedUsers.length === 0 ? "#64748b" : "#0f766e", padding: "10px 16px", fontWeight: 800, cursor: !selectedProfile || unassignedLinkedUsers.length === 0 ? "not-allowed" : "pointer" }}>
                Sadece Override Almamislara Uygula ({unassignedLinkedUsers.length})
              </button>
              <button type="button" onClick={() => void clearCurrentUserOverride()} disabled={selectedOverrideMatchCount === 0} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: selectedOverrideMatchCount > 0 ? "#fff7ed" : "#f8fafc", color: selectedOverrideMatchCount > 0 ? "#9a3412" : "#94a3b8", padding: "10px 16px", fontWeight: 800, cursor: selectedOverrideMatchCount > 0 ? "pointer" : "not-allowed" }}>
                Mevcut Kullanici Override Kaldir
              </button>
            </>
          ) : null}
          <button type="button" onClick={handleSave} disabled={saving} style={{ borderRadius: 999, border: "none", background: saving ? "#94a3b8" : "#2563eb", color: "white", padding: "10px 16px", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Kaydediliyor..." : isSelfMode ? "Kendi Temami Kaydet" : "Panel Ayarlarini Kaydet"}
          </button>
          {!isSelfMode ? (
            <>
              <button type="button" onClick={handleExport} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
                ↓ JSON Export
              </button>
              <button type="button" onClick={restoreMainSettings} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
                Ana Ayarlari Geri Yukle
              </button>
              <button
                type="button"
                onClick={addMissingProfilesFromDefaults}
                disabled={missingDefaultProfiles.length === 0}
                style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: missingDefaultProfiles.length > 0 ? "#ecfeff" : "#f8fafc", color: missingDefaultProfiles.length > 0 ? "#0e7490" : "#94a3b8", padding: "10px 16px", fontWeight: 800, cursor: missingDefaultProfiles.length > 0 ? "pointer" : "not-allowed" }}
              >
                Eksik Profilleri Ekle ({missingDefaultProfiles.length})
              </button>
              <label
                aria-label="JSON dosyasindan profilleri iceri aktar"
                style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", padding: "10px 16px", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                ↑ JSON Import
                <input type="file" accept=".json,application/json" onChange={handleImport} style={{ display: "none" }} aria-hidden="true" />
              </label>
              {importError ? (
                <div role="alert" style={{ borderRadius: 10, background: "#fff1f2", border: "1px solid #fecaca", color: "#be123c", padding: "8px 14px", fontWeight: 700, fontSize: 13 }}>
                  {importError}
                </div>
              ) : null}
              {selectedProfile ? (
                <button type="button" onClick={removeSelected} style={{ borderRadius: 999, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
                  Secili Profili Kaldir
                </button>
              ) : null}
              {selectedProfile ? (
                <button type="button" onClick={duplicateSelected} style={{ borderRadius: 999, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>
                  ⧉ Profili Kopyala
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {applyMessage ? (
          <div style={{ borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", padding: "8px 12px", fontWeight: 700, width: "fit-content" }}>
            {applyMessage}
          </div>
        ) : null}
        {!isSelfMode && (currentUser || selectedOverrideUserIds.length > 0) ? (
          <div style={{ fontSize: 12, color: "#475569" }}>
            <span>Kullanici override:</span>{" "}
            <span style={{ fontWeight: 700 }}>{selectedOverrideUserIds.length} secili kullanici</span>{" "}
            <span>{"->"}</span>{" "}
            <span style={{ fontWeight: 700 }}>{selectedOverrideMatchCount} atama bulundu</span>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isSelfMode ? "minmax(0, 1fr)" : "minmax(260px, 320px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        {!isSelfMode ? (
        <aside style={{ borderRadius: 20, border: "1px solid #e5e7eb", background: "white", padding: 14, display: "grid", gap: 10 }}>
          {draft.profiles.map((profile, index) => {
            const active = index === selectedIndex;
            const cardAccent = resolvedAccentColor(profile);
            const cardIcon = resolvedIcon(profile);
            return (
              <button
                key={`${profile.business_role}-${profile.system_role || "default"}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                style={{
                  textAlign: "left",
                  borderRadius: 16,
                  border: active ? "1px solid #93c5fd" : "1px solid #e5e7eb",
                  background: active ? "#eff6ff" : "#fcfcfd",
                  padding: 14,
                  cursor: "pointer",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{cardIcon}</span>
                    <div style={{ fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.title || "Yeni Panel"}</div>
                  </div>
                  <span title={cardAccent} style={{ width: 12, height: 12, borderRadius: 999, background: cardAccent, border: "1px solid rgba(15,23,42,0.15)", flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 12, color: "#475569" }}>{profile.business_role || "rol"}:{profile.system_role || "*"}</div>
                <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{profile.allowed_tabs.length} sekme</span>
                  <span style={{ color: "#334155" }}>{profile.nav_label || "Menu etiketi yok"}</span>
                </div>
              </button>
            );
          })}
        </aside>
        ) : null}

        <div style={{ borderRadius: 20, border: "1px solid #e5e7eb", background: "white", padding: 18, display: "grid", gap: 14 }}>
          {!selectedProfile ? (
            <div style={{ color: "#64748b" }}>Duzenlemek icin bir rol profili secin.</div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#8a5b2b" }}>Secili Profil</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{selectedProfile.title || "Yeni Panel"}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Profil anahtari: {selectedProfileKey}</div>

              <section
                aria-label="Canli Panel Onizleme"
                style={{
                  borderRadius: 22,
                  overflow: "hidden",
                  border: `1px solid ${previewPalette.border}`,
                  background: previewPalette.canvas,
                  boxShadow: previewPulse ? "0 0 0 3px rgba(37, 99, 235, 0.28), 0 20px 46px rgba(15, 23, 42, 0.14)" : "0 18px 40px rgba(15, 23, 42, 0.08)",
                  transition: "box-shadow 0.22s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: `1px solid ${previewPalette.border}`,
                    background: "rgba(255,255,255,0.6)",
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Canli Onizleme</span>
                  <div role="group" aria-label="Onizleme modu" style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      aria-pressed={previewMode === "desktop"}
                      onClick={() => setPreviewMode("desktop")}
                      style={{
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        padding: "5px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: previewMode === "desktop" ? previewPalette.pillBackground : "transparent",
                        color: previewMode === "desktop" ? previewPalette.pillText : "#94a3b8",
                        transition: "background 0.15s",
                      }}
                    >
                      Masaustu
                    </button>
                    <button
                      type="button"
                      aria-pressed={previewMode === "mobile"}
                      onClick={() => setPreviewMode("mobile")}
                      style={{
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        padding: "5px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        background: previewMode === "mobile" ? previewPalette.pillBackground : "transparent",
                        color: previewMode === "mobile" ? previewPalette.pillText : "#94a3b8",
                        transition: "background 0.15s",
                      }}
                    >
                      Mobil
                    </button>
                  </div>
                </div>
                <div style={previewMode === "mobile" ? { maxWidth: 375, margin: "0 auto" } : {}}>
                {(selectedProfile.header_info || selectedProfile.top_notice || selectedProfile.header_bg_color || selectedProfile.header_text_color) ? (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: selectedProfile.header_bg_color || "#0f172acc",
                      color: selectedProfile.header_text_color || "#f8fafc",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {selectedProfile.header_info || selectedProfile.top_notice || "Header bilgi alani"}
                  </div>
                ) : null}
                <div
                  style={{
                    padding: previewMode === "mobile" ? 14 : 20,
                    color: selectedProfile.hero_text_color || "white",
                    background: previewPalette.hero,
                    boxShadow: `inset 0 -1px 0 rgba(255,255,255,0.12), ${previewPalette.glowShadow}`,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {selectedProfile.top_notice ? (
                    <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", padding: "6px 10px", fontSize: 12, fontWeight: 700, color: selectedProfile.hero_text_color || undefined }}>
                      {selectedProfile.top_notice}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", opacity: 0.82, display: "flex", alignItems: "center", gap: 8, color: selectedProfile.hero_muted_text_color || selectedProfile.hero_text_color || undefined }}>
                    <span style={{ fontSize: 20 }} aria-label="Panel ikonu">{previewIcon}</span>
                    {selectedProfile.workspace_label || "Workspace Etiketi"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", flexDirection: previewMode === "mobile" ? "column" : "row" }}>
                    <div style={{ display: "grid", gap: 6, maxWidth: previewMode === "mobile" ? "100%" : 680 }}>
                      <div style={{ fontSize: previewMode === "mobile" ? 20 : 30, fontWeight: 900, lineHeight: 1.1 }}>
                        {inlineEditField === "hero_title" ? (
                          <input
                            autoFocus
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={commitInlineEdit}
                            onKeyDown={(e) => { if (e.key === "Enter") commitInlineEdit(); if (e.key === "Escape") setInlineEditField(null); }}
                            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 8, color: "white", fontSize: "inherit", fontWeight: "inherit", width: "100%", padding: "2px 6px" }}
                          />
                        ) : (
                          <span
                            title="Düzenlemek için çift tıkla"
                            onDoubleClick={() => startInlineEdit("hero_title")}
                            style={{ cursor: "text", borderBottom: "1px dashed rgba(255,255,255,0.4)" }}
                          >
                            {selectedProfile.hero_title || selectedProfile.title || "Panel Basligi"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: selectedProfile.hero_muted_text_color || "rgba(255,255,255,0.86)" }}>
                        {inlineEditField === "hero_description" ? (
                          <textarea
                            autoFocus
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            onBlur={commitInlineEdit}
                            onKeyDown={(e) => { if (e.key === "Escape") setInlineEditField(null); }}
                            rows={3}
                            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 8, color: "white", fontSize: "inherit", width: "100%", padding: "4px 6px", resize: "vertical" }}
                          />
                        ) : (
                          <span
                            title="Düzenlemek için çift tıkla"
                            onDoubleClick={() => startInlineEdit("hero_description")}
                            style={{ cursor: "text", borderBottom: "1px dashed rgba(255,255,255,0.3)" }}
                          >
                            {selectedProfile.hero_description || selectedProfile.description || "Bu panel icin hero aciklamasi burada gorunur."}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ borderRadius: 999, background: "rgba(255,255,255,0.14)", padding: "6px 10px", fontWeight: 800, fontSize: 12, alignSelf: previewMode === "mobile" ? "flex-start" : undefined, color: selectedProfile.hero_text_color || undefined }}>
                      {selectedProfile.nav_label || "Menu Etiketi"}
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", padding: "4px 10px", fontSize: 11, fontWeight: 700, opacity: 0.92, color: selectedProfile.hero_text_color || undefined }}>
                    Menu stili: {selectedProfile.menu_style || "pill"}
                  </div>
                </div>

<div style={{ padding: previewMode === "mobile" ? "12px" : 18, display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Menu Sirasi</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: previewMode === "mobile" ? "column" : "row" }}>
                        {selectedProfile.allowed_tabs.map((tabKey) => {
                          const option = WORKSPACE_PANEL_TAB_OPTIONS.find((item) => item.key === tabKey);
                          return (
                            <span key={`preview-${tabKey}`} style={{ borderRadius: 999, background: previewPalette.pillBackground, color: previewPalette.pillText, padding: "8px 12px", fontWeight: 700, fontSize: 12, textAlign: previewMode === "mobile" ? "center" : undefined }}>
                              {option?.label || tabKey}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Hizli Link Onizlemesi</div>
                      <div style={{ display: "grid", gridTemplateColumns: previewMode === "mobile" ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        {previewQuickLinks.map((link) => (
                          <div key={`preview-link-${link.label}-${link.href}`} style={{ borderRadius: 16, border: `1px solid ${previewPalette.border}`, background: "white", padding: 14, display: "grid", gap: 6 }}>
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>{link.label}</div>
                            <div style={{ fontSize: 13, color: "#64748b" }}>{link.description}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: previewPalette.link }}>{link.href}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {(selectedProfile.footer_info || selectedProfile.footer_bg_color || selectedProfile.footer_text_color) ? (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: selectedProfile.footer_bg_color || "#0f172a99",
                      color: selectedProfile.footer_text_color || "#e2e8f0",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {selectedProfile.footer_info || "Footer bilgi alani"}
                  </div>
                ) : null}
              </section>

              {/* Ikon ve Vurgu Rengi Secici */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, borderRadius: 16, border: "1px solid #e5e7eb", background: "#f8fafc", padding: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Renk Efekti</div>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>1. Vurgu Siddeti</span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={selectedProfile.accent_opacity ?? 0.85}
                      onChange={(event) => updateSelected({ accent_opacity: Number(event.target.value) })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>2. Vurgu Siddeti</span>
                    <input
                      type="range"
                      min={0.2}
                      max={1}
                      step={0.05}
                      value={selectedProfile.secondary_accent_opacity ?? 0.7}
                      onChange={(event) => updateSelected({ secondary_accent_opacity: Number(event.target.value) })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>1. Renk Kapsam %</span>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={selectedProfile.primary_accent_stop ?? 48}
                      onChange={(event) => updateSelected({ primary_accent_stop: Number(event.target.value) })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>2. Renk Baslangic %</span>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={1}
                      value={selectedProfile.secondary_accent_start ?? 72}
                      onChange={(event) => updateSelected({ secondary_accent_start: Number(event.target.value) })}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Isik Siddeti</span>
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
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Vurgu Rengi (1. Renk)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ACCENT_COLOR_PRESETS.map((preset) => {
                      const current = resolvedAccentColor(selectedProfile);
                      const isSelected = (selectedProfile.accent_color || "") === preset.color || (!selectedProfile.accent_color && current === preset.color);
                      return (
                        <button
                          key={preset.color}
                          type="button"
                          aria-label={`Renk sec: ${preset.label}`}
                          aria-pressed={isSelected}
                          onClick={() => updateSelected({ accent_color: preset.color })}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: isSelected ? "3px solid #0f172a" : "2px solid #e5e7eb",
                            background: preset.color, cursor: "pointer",
                            boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${preset.color}` : "none",
                          }}
                          title={preset.label}
                        />
                      );
                    })}
                    <label
                      aria-label="Ozel renk gir"
                      style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", padding: "0 8px", cursor: "pointer" }}
                    >
                      <input
                        type="color"
                        value={selectedProfile.accent_color || resolvedAccentColor(selectedProfile)}
                        onChange={(event) => updateSelected({ accent_color: event.target.value })}
                        style={{ width: 24, height: 24, border: "none", padding: 0, background: "none", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Özel</span>
                    </label>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Vurgu Rengi (2. Renk)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button
                      type="button"
                      aria-label="2. renk yok"
                      aria-pressed={!selectedProfile.secondary_accent_color}
                      onClick={() => updateSelected({ secondary_accent_color: null })}
                      style={{
                        minWidth: 54,
                        height: 32,
                        borderRadius: 8,
                        border: !selectedProfile.secondary_accent_color ? "2px solid #0f172a" : "1px solid #cbd5e1",
                        background: !selectedProfile.secondary_accent_color ? "#f1f5f9" : "#ffffff",
                        color: "#334155",
                        cursor: "pointer",
                        fontWeight: 800,
                        fontSize: 11,
                      }}
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
                          aria-pressed={isSelected}
                          onClick={() => updateSelected({ secondary_accent_color: preset.color })}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: isSelected ? "3px solid #0f172a" : "2px solid #e5e7eb",
                            background: preset.color,
                            cursor: "pointer",
                            boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${preset.color}` : "none",
                          }}
                          title={preset.label}
                        />
                      );
                    })}
                    <label
                      aria-label="Ikinci ozel renk gir"
                      style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", padding: "0 8px", cursor: "pointer" }}
                    >
                      <input
                        type="color"
                        value={selectedProfile.secondary_accent_color || "#9ca3af"}
                        onChange={(event) => updateSelected({ secondary_accent_color: event.target.value })}
                        style={{ width: 24, height: 24, border: "none", padding: 0, background: "none", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Özel 2</span>
                    </label>
                  </div>
                </div>
                {!isSelfMode ? (
                  <>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Panel Ikonu</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {ROLE_ICON_PRESETS.map((preset) => {
                          const current = resolvedIcon(selectedProfile);
                          const isSelected = (selectedProfile.icon || "") === preset.icon || (!selectedProfile.icon && current === preset.icon);
                          return (
                            <button
                              key={preset.icon}
                              type="button"
                              aria-label={`Ikon sec: ${preset.label}`}
                              aria-pressed={isSelected}
                              onClick={() => updateSelected({ icon: preset.icon })}
                              style={{
                                width: 40, height: 40, borderRadius: 10, border: isSelected ? "2px solid #0f172a" : "1px solid #e5e7eb",
                                background: isSelected ? "#0f172a08" : "white", fontSize: 20, cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: isSelected ? "0 0 0 2px #0f172a40" : "none",
                              }}
                            >
                              {preset.icon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Menu Stili</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {WORKSPACE_PANEL_MENU_STYLE_OPTIONS.map((item) => {
                          const selected = selectedMenuStyle === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setSelectedMenuStyle(item.key)}
                              style={{
                                borderRadius: 12,
                                border: selected ? "1px solid #93c5fd" : "1px solid #dbe3ee",
                                background: selected ? "#eff6ff" : "white",
                                color: "#0f172a",
                                padding: "10px 12px",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "grid",
                                gap: 4,
                              }}
                            >
                              <span style={{ fontWeight: 800 }}>{item.label}</span>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{item.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {isSelfMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Basligi</span>
                  <input value={selectedProfile.hero_title} onChange={(event) => updateSelected({ hero_title: event.target.value })} placeholder="Panel hero basligi" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Ust Bilgi (Top Notice)</span>
                  <input value={selectedProfile.top_notice || ""} onChange={(event) => updateSelected({ top_notice: event.target.value })} placeholder="Ornek: Surum 2026.Q2 yayinda" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Bilgisi</span>
                  <input value={selectedProfile.header_info || ""} onChange={(event) => updateSelected({ header_info: event.target.value })} placeholder="Ornek: SLA: %99.9" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Alt Bilgi (Footer)</span>
                  <input value={selectedProfile.footer_info || ""} onChange={(event) => updateSelected({ footer_info: event.target.value })} placeholder="Ornek: Son guncelleme: Bugun" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Arkaplan Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.header_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.header_bg_color || "#0f172acc"} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} placeholder="#0f172acc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.header_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ header_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.header_text_color || "#f8fafc"} onChange={(event) => updateSelected({ header_text_color: event.target.value })} placeholder="#f8fafc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Footer Arkaplan Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.footer_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.footer_bg_color || "#0f172a99"} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} placeholder="#0f172a99" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Footer Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.footer_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.footer_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} placeholder="#e2e8f0" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.hero_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.hero_text_color || "#f8fafc"} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} placeholder="#f8fafc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Yardimci Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.hero_muted_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.hero_muted_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} placeholder="#e2e8f0" style={inputStyle} />
                  </div>
                </label>
              </div>
              ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Business Role</span>
                  <input value={selectedProfile.business_role} onChange={(event) => updateSelected({ business_role: event.target.value })} placeholder="or: manager" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>System Role</span>
                  <input value={selectedProfile.system_role || ""} onChange={(event) => updateSelected({ system_role: event.target.value })} placeholder="or: tenant_member" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Panel Basligi</span>
                  <input value={selectedProfile.title} onChange={(event) => updateSelected({ title: event.target.value })} placeholder="or: Yonetici Paneli" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Menu Etiketi</span>
                  <input value={selectedProfile.nav_label} onChange={(event) => updateSelected({ nav_label: event.target.value })} placeholder="or: Yonetici" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Workspace Etiketi</span>
                  <input value={selectedProfile.workspace_label} onChange={(event) => updateSelected({ workspace_label: event.target.value })} placeholder="or: Yonetici Calisma Alani" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Basligi</span>
                  <input value={selectedProfile.hero_title} onChange={(event) => updateSelected({ hero_title: event.target.value })} placeholder="Panel hero basligi" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Ust Bilgi (Top Notice)</span>
                  <input value={selectedProfile.top_notice || ""} onChange={(event) => updateSelected({ top_notice: event.target.value })} placeholder="Ornek: Surum 2026.Q2 yayinda" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Bilgisi</span>
                  <input value={selectedProfile.header_info || ""} onChange={(event) => updateSelected({ header_info: event.target.value })} placeholder="Ornek: SLA: %99.9" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Arkaplan Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.header_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.header_bg_color || "#0f172acc"} onChange={(event) => updateSelected({ header_bg_color: event.target.value })} placeholder="#0f172acc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Header Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.header_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ header_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.header_text_color || "#f8fafc"} onChange={(event) => updateSelected({ header_text_color: event.target.value })} placeholder="#f8fafc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Alt Bilgi (Footer)</span>
                  <input value={selectedProfile.footer_info || ""} onChange={(event) => updateSelected({ footer_info: event.target.value })} placeholder="Ornek: Son guncelleme: Bugun" style={inputStyle} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Footer Arkaplan Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.footer_bg_color || "#0f172a").slice(0, 7)} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.footer_bg_color || "#0f172a99"} onChange={(event) => updateSelected({ footer_bg_color: event.target.value })} placeholder="#0f172a99" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Footer Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.footer_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.footer_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ footer_text_color: event.target.value })} placeholder="#e2e8f0" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.hero_text_color || "#f8fafc").slice(0, 7)} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.hero_text_color || "#f8fafc"} onChange={(event) => updateSelected({ hero_text_color: event.target.value })} placeholder="#f8fafc" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Yardimci Yazi Rengi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={(selectedProfile.hero_muted_text_color || "#e2e8f0").slice(0, 7)} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} style={{ width: 52, height: 40, border: "1px solid #dbe3ee", borderRadius: 10, background: "white", cursor: "pointer" }} />
                    <input value={selectedProfile.hero_muted_text_color || "#e2e8f0"} onChange={(event) => updateSelected({ hero_muted_text_color: event.target.value })} placeholder="#e2e8f0" style={inputStyle} />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 8, alignContent: "center" }}>
                  <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Kullanici Kendi Template'ini Duzenleyebilsin</span>
                  <button
                    type="button"
                    onClick={() => updateSelected({ allow_user_self_customization: !selectedProfile.allow_user_self_customization })}
                    style={{ borderRadius: 999, border: selectedProfile.allow_user_self_customization ? "1px solid #16a34a" : "1px solid #cbd5e1", background: selectedProfile.allow_user_self_customization ? "#f0fdf4" : "#ffffff", color: selectedProfile.allow_user_self_customization ? "#166534" : "#475569", padding: "10px 14px", fontWeight: 800, cursor: "pointer", width: "fit-content" }}
                  >
                    {selectedProfile.allow_user_self_customization ? "Acik" : "Kapali"}
                  </button>
                </label>
              </div>
              )}

              {!isSelfMode ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Kisa Aciklama</span>
                <textarea value={selectedProfile.description} onChange={(event) => updateSelected({ description: event.target.value })} rows={3} style={{ ...inputStyle, minHeight: 92 }} />
              </label>
              ) : null}

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Hero Aciklama</span>
                <textarea value={selectedProfile.hero_description} onChange={(event) => updateSelected({ hero_description: event.target.value })} rows={4} style={{ ...inputStyle, minHeight: 112 }} />
              </label>

              {!isSelfMode ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Gorulecek Sekmeler</div>
                <div style={{ display: "grid", gap: 8 }}>
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
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          borderRadius: 14,
                          border: enabled ? "1px solid #86efac" : "1px solid #dbe3ee",
                          background: enabled ? "#f0fdf4" : "white",
                          padding: "10px 12px",
                          cursor: enabled ? "grab" : "default",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            type="button"
                            aria-label={`${tab.label} durumunu degistir`}
                            onClick={() => toggleTab(tab.key)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              border: enabled ? "1px solid #16a34a" : "1px solid #94a3b8",
                              background: enabled ? "#16a34a" : "#ffffff",
                              color: "white",
                              fontSize: 15,
                              fontWeight: 900,
                              display: "grid",
                              placeItems: "center",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            {enabled ? "✓" : ""}
                          </button>
                          <span style={{ minWidth: 58, fontSize: 12, fontWeight: 800, color: enabled ? "#166534" : "#64748b" }}>{enabled ? "Acik" : "Kapali"}</span>
                          <span style={{ color: enabled ? "#16a34a" : "#94a3b8", fontSize: 16, userSelect: "none" }}>{enabled ? "⠿" : "□"}</span>
                          <div style={{ fontWeight: 700, color: enabled ? "#166534" : "#334155" }}>
                            {enabled && tabIndex >= 0 ? `${tabIndex + 1}. ` : ""}
                            {tab.label}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" aria-label={`${tab.label} sekmesini yukari tasi`} onClick={() => moveAllowedTab(tab.key, -1)} disabled={!enabled || tabIndex <= 0} style={miniButtonStyle}>
                            ↑
                          </button>
                          <button type="button" aria-label={`${tab.label} sekmesini asagi tasi`} onClick={() => moveAllowedTab(tab.key, 1)} disabled={!enabled || tabIndex === selectedProfile.allowed_tabs.length - 1} style={miniButtonStyle}>
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
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>Hizli Linkler</div>
                  <button type="button" onClick={addQuickLink} style={{ ...miniButtonStyle, border: "1px solid #86efac", background: "#f0fdf4", color: "#166534" }}>
                    + Hizli Link Ekle
                  </button>
                </div>
                {(selectedProfile.quick_links || []).length === 0 ? (
                  <div style={{ borderRadius: 14, border: "1px dashed #cbd5e1", color: "#64748b", padding: "12px 14px" }}>
                    Bu profil icin ozel hizli link tanimlanmadi. Varsayilan linkler kullanilir.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {(selectedProfile.quick_links || []).map((link, index) => (
                      <div
                        key={`quick-link-${index}`}
                        draggable
                        onDragStart={() => handleLinkDragStart(index)}
                        onDragOver={(e) => handleLinkDragOver(e, index)}
                        onDragEnd={handleLinkDragEnd}
                        style={{ borderRadius: 16, border: "1px solid #dbe3ee", background: "#f8fafc", padding: 14, display: "grid", gap: 10, cursor: "grab" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "#94a3b8", fontSize: 16, userSelect: "none" }}>⠿</span>
                            Hizli Link {index + 1}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" aria-label={`Hizli link ${index + 1} yukari tasi`} onClick={() => moveQuickLink(index, -1)} disabled={index === 0} style={miniButtonStyle}>Yukari</button>
                            <button type="button" aria-label={`Hizli link ${index + 1} asagi tasi`} onClick={() => moveQuickLink(index, 1)} disabled={index === (selectedProfile.quick_links || []).length - 1} style={miniButtonStyle}>Asagi</button>
                            <button type="button" aria-label={`Hizli link ${index + 1} kaldir`} onClick={() => removeQuickLink(index)} style={{ ...miniButtonStyle, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c" }}>Kaldir</button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Link Etiketi</span>
                            <input value={link.label} onChange={(event) => updateQuickLink(index, { label: event.target.value })} placeholder="or: Dashboard" style={inputStyle} />
                          </label>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Href</span>
                            <input value={link.href} onChange={(event) => updateQuickLink(index, { href: event.target.value })} placeholder="or: /dashboard" style={inputStyle} />
                          </label>
                        </div>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontWeight: 700, color: "#334155", fontSize: 12 }}>Link Aciklamasi</span>
                          <textarea value={link.description} onChange={(event) => updateQuickLink(index, { description: event.target.value })} rows={3} style={{ ...inputStyle, minHeight: 88 }} />
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
    </section>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #dbe3ee",
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "white",
} as const;

const miniButtonStyle = {
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#334155",
  cursor: "pointer",
} as const;

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