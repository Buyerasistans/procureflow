// @vitest-environment node
import { describe, expect, it } from "vitest";

function resolvePreferredMailAccount(accounts, options) {
  if (options.selectedAccountId && accounts.some((account) => account.id === options.selectedAccountId)) {
    return accounts.find((account) => account.id === options.selectedAccountId) || null;
  }

  const preferredAddress = String(options.workEmail || options.loginEmail || "").trim().toLowerCase();
  if (preferredAddress) {
    const matched = accounts.find((account) => account.email.trim().toLowerCase() === preferredAddress);
    if (matched) {
      return matched;
    }
  }

  return accounts[0] || null;
}

function resolveAdminTab(tab, availableTabs) {
  const normalized = tab === "mail" ? "settings" : String(tab || "");
  if (normalized && availableTabs.includes(normalized)) {
    return normalized;
  }
  return availableTabs[0] || "panel_home";
}

describe("AdvancedSettingsTab mail regressions", () => {
  it("prefers work email over login email when choosing popup mailbox", () => {
    const account = resolvePreferredMailAccount(
      [
        { id: 1, email: "login@test.com", unread_count: 0 },
        { id: 2, email: "work@test.com", unread_count: 3 },
      ],
      {
        workEmail: "work@test.com",
        loginEmail: "login@test.com",
      },
    );

    expect(account?.id).toBe(2);
  });

  it("falls back to first account when work email has no exact mailbox match", () => {
    const account = resolvePreferredMailAccount(
      [
        { id: 9, email: "destek@tenant.com", unread_count: 1 },
        { id: 11, email: "info@tenant.com", unread_count: 0 },
      ],
      {
        workEmail: "someone@tenant.com",
        loginEmail: "personal@example.com",
      },
    );

    expect(account?.id).toBe(9);
  });

  it("keeps explicitly selected account when it still exists", () => {
    const account = resolvePreferredMailAccount(
      [
        { id: 4, email: "a@test.com", unread_count: 0 },
        { id: 6, email: "b@test.com", unread_count: 2 },
      ],
      {
        selectedAccountId: 6,
        workEmail: "a@test.com",
      },
    );

    expect(account?.id).toBe(6);
  });

  it("maps legacy mail tab query to settings so popup flow stays in advanced settings", () => {
    expect(resolveAdminTab("mail", ["panel_home", "settings", "reports"])).toBe("settings");
  });

  it("returns first available tab when requested tab is unavailable", () => {
    expect(resolveAdminTab("unknown", ["panel_home", "settings"])).toBe("panel_home");
  });
});
