import React, { useState } from "react";
import type { TeamHierarchyNode } from "../../services/profile.service";

interface TeamHierarchyTreeProps {
  nodes: TeamHierarchyNode[];
  rootUserId: number;
}

const ROLE_LABELS: Record<string, string> = {
  "channel.account_owner": "Hesap Sahibi",
  "channel.team_lead": "Ekip Lideri",
  "channel.agent": "Temsilci",
  "channel.junior_agent": "Junior Temsilci",
};

const ROLE_COLORS: Record<string, string> = {
  "channel.account_owner": "#1e40af",
  "channel.team_lead": "#047857",
  "channel.agent": "#b45309",
  "channel.junior_agent": "#6b7280",
};

function buildTree(
  nodes: TeamHierarchyNode[],
  rootUserId: number
): TeamHierarchyNode[] {
  // Köke göre DFS sırası
  const childMap: Record<number, TeamHierarchyNode[]> = {};
  for (const node of nodes) {
    const parentKey = node.parent_user_id ?? -1;
    if (!childMap[parentKey]) childMap[parentKey] = [];
    childMap[parentKey].push(node);
  }

  const ordered: TeamHierarchyNode[] = [];
  function visit(userId: number) {
    const node = nodes.find((n) => n.user_id === userId);
    if (!node) return;
    ordered.push(node);
    const children = childMap[userId] ?? [];
    for (const child of children) {
      visit(child.user_id);
    }
  }
  visit(rootUserId);

  // Kök bulunamazsa düz liste döndür
  if (ordered.length === 0) return nodes;
  return ordered;
}

interface NodeRowProps {
  node: TeamHierarchyNode;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function NodeRow({ node, hasChildren, isExpanded, onToggle }: NodeRowProps) {
  const roleLabel =
    ROLE_LABELS[node.role_profile_code] ?? node.role_profile_code;
  const roleColor = ROLE_COLORS[node.role_profile_code] ?? "#6b7280";
  const indent = node.depth * 24;

  return (
    <div
      data-testid="hierarchy-node"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 4px",
        borderBottom: "1px solid #f3f4f6",
        paddingLeft: indent + 4,
      }}
    >
      {/* Genişlet/Daralt butonu */}
      <button
        onClick={hasChildren ? onToggle : undefined}
        aria-label={hasChildren ? (isExpanded ? "Daralt" : "Genislet") : undefined}
        style={{
          width: 20,
          height: 20,
          border: "none",
          background: "transparent",
          cursor: hasChildren ? "pointer" : "default",
          color: hasChildren ? "#6b7280" : "transparent",
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        {hasChildren ? (isExpanded ? "▼" : "▶") : "•"}
      </button>

      {/* Rol etiketi */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#fff",
          backgroundColor: roleColor,
          borderRadius: 4,
          padding: "2px 6px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {roleLabel}
      </span>

      {/* İsim */}
      <span
        style={{
          fontSize: 13,
          fontWeight: node.depth === 0 ? 700 : 400,
          color: node.is_active ? "#111827" : "#9ca3af",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {node.display_name}
        {!node.is_active && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "#ef4444" }}>
            (pasif)
          </span>
        )}
      </span>

      {/* Referral sayısı */}
      {node.referral_count > 0 && (
        <span
          style={{
            fontSize: 11,
            color: "#047857",
            fontWeight: 600,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {node.referral_count} referral
        </span>
      )}
    </div>
  );
}

export function TeamHierarchyTree({ nodes, rootUserId }: TeamHierarchyTreeProps) {
  const orderedNodes = buildTree(nodes, rootUserId);

  // expandedSet — collapsed olan node'ların child'larını gizler
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  const childMap: Record<number, boolean> = {};
  for (const node of orderedNodes) {
    if (node.parent_user_id !== null && node.parent_user_id !== undefined) {
      childMap[node.parent_user_id] = true;
    }
  }

  function toggleCollapse(userId: number) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function isHidden(node: TeamHierarchyNode): boolean {
    // Kendi üst zincirinde collapsed olan varsa gizle
    let current = node.parent_user_id;
    while (current !== null && current !== undefined) {
      if (collapsedIds.has(current)) return true;
      const parent = orderedNodes.find((n) => n.user_id === current);
      current = parent?.parent_user_id ?? null;
    }
    return false;
  }

  if (orderedNodes.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13 }}>
        Henüz ekip üyesi yok.
      </p>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        overflow: "hidden",
        fontSize: 13,
      }}
      aria-label="Ekip Hiyerarsi Agaci"
    >
      {orderedNodes.map((node) =>
        isHidden(node) ? null : (
          <NodeRow
            key={node.user_id}
            node={node}
            hasChildren={!!childMap[node.user_id]}
            isExpanded={!collapsedIds.has(node.user_id)}
            onToggle={() => toggleCollapse(node.user_id)}
          />
        )
      )}
    </div>
  );
}

export default TeamHierarchyTree;
