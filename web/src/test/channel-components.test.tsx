import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { PartnerSummaryCard } from "../components/channel/PartnerSummaryCard";
import { ReferralLinkCenter } from "../components/channel/ReferralLinkCenter";
import { ConversionOverviewPanel } from "../components/channel/ConversionOverviewPanel";
import { GamificationPanel } from "../components/channel/GamificationPanel";
import { CommissionApprovalPanel } from "../components/channel/CommissionApprovalPanel";
import { CommissionDashboardPanel } from "../components/channel/CommissionDashboardPanel";
import {
  adminCommissionDashboardMock,
  adminLedgerMock,
  channelCommissionReportMock,
  channelConversionMetricsMock,
  channelGamificationMock,
  channelPartnerSummaryMock,
  channelReferralLinksMock,
} from "./channel-test-data";

describe("Channel component level coverage", () => {
  it("PartnerSummaryCard ozet metriklerini gosterir", () => {
    render(<PartnerSummaryCard summary={channelPartnerSummaryMock} loading={false} />);

    expect(screen.getByText(/is ortagi ozet karti/i)).toBeInTheDocument();
    expect(screen.getByText(/son 30 gun yeni musteri/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.600 ₺/)).toBeInTheDocument();
  });

  it("ReferralLinkCenter link kartlarini gosterir", () => {
    render(
      <ReferralLinkCenter
        loading={false}
        links={channelReferralLinksMock}
      />
    );

    expect(screen.getByText(/link merkezi/i)).toBeInTheDocument();
    expect(screen.getAllByText("CH-AAA111").length).toBeGreaterThan(0);
    expect(screen.getByText(/kopyala/i)).toBeInTheDocument();
  });

  it("ConversionOverviewPanel donusum ve komisyon bloklarini birlestirir", () => {
    const onSync = vi.fn();

    render(
      <ConversionOverviewPanel
        conversionMetrics={channelConversionMetricsMock}
        conversionLoading={false}
        commissionReport={channelCommissionReportMock}
        commissionLoading={false}
        commissionSyncLoading={false}
        onCommissionSync={onSync}
      />
    );

    expect(screen.getByText(/ag ve donusum/i)).toBeInTheDocument();
    expect(screen.getByText(/tiklama > kayit/i)).toBeInTheDocument();
    expect(screen.getByText(/komisyon period raporu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /komisyonu senkronize et/i })).toBeInTheDocument();
  });
});

describe("Sprint-5 channel components", () => {
  it("GamificationPanel seviye ve rozet bilgilerini gosterir", () => {
    render(<GamificationPanel data={channelGamificationMock} loading={false} />);
    expect(screen.getByText(/performans ve seviye/i)).toBeInTheDocument();
    expect(screen.getByText(/gumus/i)).toBeInTheDocument();
    expect(screen.getByText(/performans skoru/i)).toBeInTheDocument();
    expect(screen.getByText(/ilk referans/i)).toBeInTheDocument();
    expect(screen.getByText(/25 referans/i)).toBeInTheDocument();
  });

  it("GamificationPanel yuklenirken yükleniyor mesaji gosterir", () => {
    render(<GamificationPanel data={null} loading={true} />);
    expect(screen.getByText(/yukleniyor/i)).toBeInTheDocument();
  });

  it("CommissionApprovalPanel ledger satirlarini gosterir", () => {
    const onRefresh = vi.fn();
    render(
      <CommissionApprovalPanel
        items={adminLedgerMock.items}
        loading={false}
        onRefresh={onRefresh}
      />
    );
    expect(screen.getByText(/komisyon onay akisi/i)).toBeInTheDocument();
    expect(screen.getByText("partner_signup")).toBeInTheDocument();
  });

  it("CommissionDashboardPanel toplam tutarlari gosterir", () => {
    render(
      <CommissionDashboardPanel
        data={adminCommissionDashboardMock}
        loading={false}
      />
    );
    expect(screen.getByText(/komisyon ozet paneli/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bekleyen/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/acente a/i).length).toBeGreaterThan(0);
  });
});
