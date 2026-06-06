import React, { useState } from "react";
import type { CSSProperties } from "react";
import type { TeamHierarchyNode } from "../../services/profile.service";
import "./TeamHierarchyTree.css";

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
  const roleLabel = ROLE_LABELS[node.role_profile_code] ?? node.role_profile_code;
  const roleColor = ROLE_COLORS[node.role_profile_code] ?? "#6b7280";
  const indent = node.depth * 24;

  return (
    <div
      data-testid="hierarchy-node"
      className="tht-node"
      style={{ "--tht-indent": (indent + 4) + "px" } as CSSProperties}
    >
      <button
        onClick={hasChildren ? onToggle : undefined}
        aria-label={hasChildren ? (isExpanded ? "Daralt" : "Genislet") : undefined}
        className={`tht-toggle-btn${hasChildren ? " tht-toggle-btn--has-children" : ""}`}
      >
        {hasChildren ? (isExpanded ? "▼" : "▶") : "•"}
      </button>

      <span
        className="tht-role-badge"
        style={{ "--tht-role-color": roleColor } as CSSProperties}
      >
        {roleLabel}
      </span>

      <span className={`tht-name${node.depth === 0 ? " tht-name--root" : ""}${!node.is_active ? " tht-name--inactive" : ""}`}>
        {node.display_name}
        {!node.is_active && (
          <span className="tht-pasif-badge">(pasif)</span>
        )}
      </span>

      {node.referral_count > 0 && (
        <span className="tht-referral">{node.referral_count} referral</span>
      )}
    </div>
  );
}

export function TeamHierarchyTree({ nodes, rootUserId }: TeamHierarchyTreeProps) {
  const orderedNodes = buildTree(nodes, rootUserId);

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
    let current = node.parent_user_id;
    while (current !== null && current !== undefined) {
      if (collapsedIds.has(current)) return true;
      const parent = orderedNodes.find((n) => n.user_id === current);
      current = parent?.parent_user_id ?? null;
    }
    return false;
  }

  if (orderedNodes.length === 0) {
    return <p className="tht-empty">Henüz ekip üyesi yok.</p>;
  }

  return (
    <div className="tht-tree" aria-label="Ekip Hiyerarsi Agaci">
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
