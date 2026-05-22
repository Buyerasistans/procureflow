import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ProfilePage from "../pages/ProfilePage";
import {
  channelCampaignsMock,
  channelCommissionReportMock,
  channelConversionMetricsMock,
  channelEmptyCommissionReportMock,
  channelEmptyConversionMetricsMock,
  channelPartnerSummaryMock,
  channelReferralLinksMock,
  channelSocialLinksMock,
  channelTeamHierarchyMock,
  channelTeamPerformanceMock,
} from "./channel-test-data";

const mockUseAuth = vi.fn();
const mockUseProfile = vi.fn();
const mockGetChannelProfileSummary = vi.fn();
const mockGetChannelReferralLinks = vi.fn();
const mockGetChannelConversionMetrics = vi.fn();
const mockGetChannelCommissionReport = vi.fn();
const mockRecalculateChannelCommissions = vi.fn();
const mockGetChannelTeamHierarchy = vi.fn();
const mockGetChannelCampaigns = vi.fn();
const mockGetChannelSocialLinks = vi.fn();
const mockGetChannelTeamPerformance = vi.fn();
const mockGetChannelGamification = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../hooks/useProfile", () => ({
  useProfile: () => mockUseProfile(),
}));

vi.mock("../services/profile.service", async () => {
  const actual = await vi.importActual<typeof import("../services/profile.service")>("../services/profile.service");
  return {
    ...actual,
    getChannelProfileSummary: (...args: unknown[]) => mockGetChannelProfileSummary(...args),
    getChannelReferralLinks: (...args: unknown[]) => mockGetChannelReferralLinks(...args),
    getChannelConversionMetrics: (...args: unknown[]) => mockGetChannelConversionMetrics(...args),
    getChannelCommissionReport: (...args: unknown[]) => mockGetChannelCommissionReport(...args),
    recalculateChannelCommissions: (...args: unknown[]) => mockRecalculateChannelCommissions(...args),
    getChannelTeamHierarchy: (...args: unknown[]) => mockGetChannelTeamHierarchy(...args),
    getChannelCampaigns: (...args: unknown[]) => mockGetChannelCampaigns(...args),
    getChannelSocialLinks: (...args: unknown[]) => mockGetChannelSocialLinks(...args),
    getChannelTeamPerformance: (...args: unknown[]) => mockGetChannelTeamPerformance(...args),
    getChannelGamification: (...args: unknown[]) => mockGetChannelGamification(...args),
  };
});

describe("ProfilePage channel summary cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      profile: {
        id: 12,
        full_name: "Kanal Kullanici",
        email: "channel@example.com",
        work_email: null,
        role: "channel_owner",
        is_active: true,
        approval_limit: 0,
      },
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn().mockResolvedValue(undefined),
    });
    mockGetChannelReferralLinks.mockResolvedValue([]);
    mockGetChannelConversionMetrics.mockResolvedValue(channelEmptyConversionMetricsMock);
    mockGetChannelCommissionReport.mockResolvedValue(channelEmptyCommissionReportMock);
    mockRecalculateChannelCommissions.mockResolvedValue({
      period: "30d",
      generated_entries: 0,
      skipped_existing: 0,
      skipped_missing_amount: 0,
      skipped_missing_contract: 0,
    });
    mockGetChannelTeamHierarchy.mockResolvedValue(channelTeamHierarchyMock);
    mockGetChannelCampaigns.mockResolvedValue(channelCampaignsMock);
    mockGetChannelSocialLinks.mockResolvedValue(channelSocialLinksMock);
    mockGetChannelTeamPerformance.mockResolvedValue(channelTeamPerformanceMock);
    mockGetChannelGamification.mockResolvedValue(null);
  });

  it("channel scope icin Profilim v2 ozet kartlarini gosterir", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 7,
        role: "channel_owner",
        business_role: "channel_owner",
        scope_type: "channel",
      },
    });
    mockGetChannelProfileSummary.mockResolvedValue(channelPartnerSummaryMock);
    mockGetChannelReferralLinks.mockResolvedValue(channelReferralLinksMock);
    mockGetChannelConversionMetrics.mockResolvedValue(channelConversionMetricsMock);
    mockGetChannelCommissionReport.mockResolvedValue(channelCommissionReportMock);

    render(<ProfilePage />);

    await waitFor(() => expect(screen.getByText(/is ortagi ozet karti/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("11")).toBeInTheDocument());
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText(/son 30 gun yeni musteri/i)).toBeInTheDocument();
    expect(screen.getByText(/bu ay net komisyon/i)).toBeInTheDocument();
    expect(screen.getByText(/net tahakkuk/i)).toBeInTheDocument();
    expect(screen.getByText(/link merkezi/i)).toBeInTheDocument();
    expect(screen.getAllByText("CH-AAA111").length).toBeGreaterThan(0);
    expect(screen.getByText(/ag ve donusum/i)).toBeInTheDocument();
    expect(screen.getByText(/tiklama > kayit/i)).toBeInTheDocument();
    expect(screen.getByText(/komisyon period raporu/i)).toBeInTheDocument();
    expect(screen.getAllByText("44").length).toBeGreaterThan(0);
    expect(screen.getByText(/ekip hiyerarşisi/i)).toBeInTheDocument();
    expect(screen.getAllByText(/alt temsilci/i).length).toBeGreaterThan(0);
    expect(mockGetChannelProfileSummary).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/kampanya paneli/i)).toBeInTheDocument();
      expect(screen.getAllByText(/yeni ortak getir 2026/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/sosyal baglanti paneli/i)).toBeInTheDocument();
      expect(screen.getByText(/whatsapp/i)).toBeInTheDocument();
      expect(screen.getByText(/ekip performans tablosu/i)).toBeInTheDocument();
      expect(screen.getByText(/komisyon \(baz\)/i)).toBeInTheDocument();
      expect(mockGetChannelCampaigns).toHaveBeenCalledTimes(1);
      expect(mockGetChannelTeamPerformance).toHaveBeenCalledTimes(1);
    expect(mockGetChannelReferralLinks).toHaveBeenCalledTimes(1);
    expect(mockGetChannelConversionMetrics).toHaveBeenCalledTimes(1);
    expect(mockGetChannelCommissionReport).toHaveBeenCalledTimes(1);
    expect(mockGetChannelTeamHierarchy).toHaveBeenCalledTimes(1);
  });

  it("channel disi scope icin ozet kart endpointini cagirmez", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 22,
        role: "admin",
        business_role: "admin",
        scope_type: "partner",
      },
    });

    render(<ProfilePage />);

    await waitFor(() => expect(screen.getByText(/temel bilgiler/i)).toBeInTheDocument());
    expect(screen.queryByText(/is ortagi ozet karti/i)).not.toBeInTheDocument();
    expect(mockGetChannelProfileSummary).not.toHaveBeenCalled();
    expect(mockGetChannelReferralLinks).not.toHaveBeenCalled();
    expect(mockGetChannelConversionMetrics).not.toHaveBeenCalled();
    expect(mockGetChannelCommissionReport).not.toHaveBeenCalled();
    expect(mockRecalculateChannelCommissions).not.toHaveBeenCalled();
    expect(mockGetChannelTeamHierarchy).not.toHaveBeenCalled();
    expect(mockGetChannelCampaigns).not.toHaveBeenCalled();
    expect(mockGetChannelSocialLinks).not.toHaveBeenCalled();
    expect(mockGetChannelTeamPerformance).not.toHaveBeenCalled();
  });
});
