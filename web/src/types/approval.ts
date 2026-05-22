export interface ApprovalRoleInfo {
  required_business_role?: string | null;
  required_business_role_label?: string | null;
  /** @deprecated legacy mirror columns, being phased out */
  required_role?: string | null;
  required_role_mirror?: string | null;
  required_role_label?: string | null;
}

export interface QuotePendingApprovalLike extends ApprovalRoleInfo {
  id: number;
  level: number;
  status: string;
  requested_at?: string;
  completed_at?: string;
  approver_name?: string | null;
  comment?: string | null;
}

export interface ApprovalDetailLike extends ApprovalRoleInfo {
  level: number;
  status: string;
  requested_at?: string;
  completed_at?: string;
  approved_by_id?: number | null;
  approved_by_name?: string | null;
  comment?: string | null;
}