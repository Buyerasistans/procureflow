import type { TenantUser } from "../services/admin.service";

const ALL_DEPARTMENTS_MARKER = "__ALL_DEPARTMENTS__";

export function getUserDepartmentIds(user: TenantUser): number[] {
  const ids = new Set<number>();
  if (typeof user.department_id === "number") {
    ids.add(user.department_id);
  }
  user.company_assignments?.forEach((assignment) => {
    if (typeof assignment.department_id === "number") {
      ids.add(assignment.department_id);
    }
  });
  return [...ids];
}

export function getUserCompanyIds(user: TenantUser): number[] {
  const ids = new Set<number>();
  user.company_assignments?.forEach((assignment) => {
    if (typeof assignment.company_id === "number") {
      ids.add(assignment.company_id);
    }
  });
  return [...ids];
}

export function userMatchesDepartment(user: TenantUser, departmentId?: number | null): boolean {
  if (typeof departmentId !== "number") {
    return true;
  }
  const hasAllDepartmentsAssignment = Boolean(
    user.company_assignments?.some((assignment) => assignment.sub_items?.includes(ALL_DEPARTMENTS_MARKER)),
  );
  if (hasAllDepartmentsAssignment) {
    return true;
  }
  return getUserDepartmentIds(user).includes(departmentId);
}

export function userMatchesCompany(user: TenantUser, companyId?: number | null): boolean {
  if (typeof companyId !== "number") {
    return true;
  }
  const companyIds = getUserCompanyIds(user);
  return companyIds.length === 0 || companyIds.includes(companyId);
}

export function filterUsersByAssignmentScope(
  users: TenantUser[],
  scope?: { companyId?: number | null; departmentId?: number | null },
): TenantUser[] {
  return users.filter((user) => {
    if (!userMatchesCompany(user, scope?.companyId)) {
      return false;
    }
    if (!userMatchesDepartment(user, scope?.departmentId)) {
      return false;
    }
    return true;
  });
}