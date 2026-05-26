// FILE: web/src/App.tsx
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import ProtectedRoute, { SupplierRoute } from "./components/ProtectedRoute";
import RequirePermission from "./components/RequirePermission";
import AppLayout from "./components/AppLayout";
import PublicSeoManager from "./components/PublicSeoManager";
import PublicTelemetryManager from "./components/PublicTelemetryManager";
import AutoTranslateManager from "./components/AutoTranslateManager";
import SmartFallbackRedirect from "./routes/SmartFallbackRedirect";
import HelpCenter from "./components/HelpCenter";
import { resolveRootLandingByHost } from "./lib/public-intent";

import PublicHomePage from "./pages/PublicHomePage";
import PublicMarketplacePage from "./pages/PublicMarketplacePage";
import DemoRequestPage from "./pages/DemoRequestPage";
import SupplierProgramPage from "./pages/SupplierProgramPage";
import ChannelPartnerRegisterPage from "./pages/ChannelPartnerRegisterPage";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const PlatformLoginPage = lazy(() => import("./pages/PlatformLoginPage"));
const StrategicPartnerLoginPage = lazy(() => import("./pages/StrategicPartnerLoginPage"));
const ChannelLoginPage = lazy(() => import("./pages/ChannelLoginPage"));
const InternalUserActivationPage = lazy(() => import("./pages/InternalUserActivationPage"));
const SupplierLoginPage = lazy(() => import("./pages/SupplierPortalLoginPage"));
const SupplierRegisterPage = lazy(() => import("./pages/SupplierRegisterPage"));
const SupplierDashboard = lazy(() => import("./pages/SupplierDashboard"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const SupplierProfilePage = lazy(() => import("./pages/SupplierProfilePage"));
const SupplierFinancePage = lazy(() => import("./pages/SupplierFinancePage"));
const SupplierWorkspacePage = lazy(() => import("./pages/SupplierWorkspacePage"));
const SupplierEmailChangeConfirmPage = lazy(() => import("./pages/SupplierEmailChangeConfirmPage"));
const AdminSupplierDetailPage = lazy(() => import("./pages/AdminSupplierDetailPage"));
const AdminSupplierFinancePage = lazy(() => import("./pages/AdminSupplierFinancePage"));
const AdminSupplierWorkspacePage = lazy(() => import("./pages/AdminSupplierWorkspacePage"));
const AdminQuoteManagementPage = lazy(() => import("./pages/AdminQuoteManagementPage"));
const PersonnelProfileEditorPage = lazy(() => import("./pages/PersonnelProfileEditorPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const TalentProfilePage = lazy(() => import("./pages/TalentProfilePage"));
const PayoutAdminPage = lazy(() => import("./pages/PayoutAdminPage"));
const TalentAdminControlPage = lazy(() => import("./pages/TalentAdminControlPage"));
const DepartmentDetailPage = lazy(() => import("./pages/DepartmentDetailPage"));
const CompanyDetailPage = lazy(() => import("./pages/CompanyDetailPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const ProjectFilesPage = lazy(() => import("./pages/ProjectFilesPage"));
const QuoteListPage = lazy(() => import("./pages/QuoteListPage"));
const QuoteCreatePage = lazy(() => import("./pages/QuoteCreatePage"));
const QuoteDetailPage = lazy(() => import("./pages/QuoteDetailPage"));
const QuoteComparisonReportPage = lazy(() => import("./pages/QuoteComparisonReportPage"));
const DiscoveryLab = lazy(() => import("./pages/DiscoveryLab"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const PublicPricingAdminPage = lazy(() => import("./pages/PublicPricingAdminPage"));
const ReferralLandingPage = lazy(() => import("./pages/ReferralLandingPage.tsx"));
const KnowledgeLandingPage = lazy(() => import("./pages/KnowledgeLandingPage"));

function LegacyPublicRedirect({ to }: { to: string }) {
  const location = useLocation();
  const search = location.search || "";
  const hash = location.hash || "";
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

function RouteFallback() {
  return (
    <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", color: "#475569", fontSize: 14 }}>
      Sayfa yukleniyor...
    </div>
  );
}

function RootDomainRedirect() {
  const target = resolveRootLandingByHost(window.location.hostname);
  if (target === "/") {
    return <PublicHomePage />;
  }
  return <Navigate to={target} replace />;
}

export default function App() {
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).get("embedded") === "1";

  return (
    <>
      <PublicSeoManager />
      <PublicTelemetryManager />
      <AutoTranslateManager />
      {!isEmbedded && <HelpCenter />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/platform-login" element={<PlatformLoginPage />} />
          <Route path="/strategic-partner-login" element={<StrategicPartnerLoginPage />} />
          <Route path="/channel/login" element={<ChannelLoginPage />} />
          <Route path="/" element={<RootDomainRedirect />} />
          <Route path="/teklifler" element={<PublicMarketplacePage />} />
          <Route path="/offers" element={<PublicMarketplacePage />} />
          <Route path="/tedarikciler" element={<PublicMarketplacePage />} />
          <Route path="/suppliers" element={<PublicMarketplacePage />} />
          <Route path="/cozumler" element={<LegacyPublicRedirect to="/teklifler" />} />
          <Route path="/fiyatlandirma" element={<LegacyPublicRedirect to="/teklifler#planlar" />} />
          <Route path="/demo" element={<DemoRequestPage />} />
          <Route path="/stratejik-ortaklik" element={<PublicMarketplacePage />} />
          <Route path="/strategic-partner" element={<PublicMarketplacePage />} />
          <Route path="/tedarikci-ol" element={<SupplierProgramPage />} />
          <Route path="/become-supplier" element={<SupplierProgramPage />} />
          <Route path="/is-ortagi-programi" element={<PublicMarketplacePage />} />
          <Route path="/partner-program" element={<PublicMarketplacePage />} />
          <Route path="/is-ortagi-basvuru" element={<ChannelPartnerRegisterPage />} />
          <Route path="/partner-apply" element={<ChannelPartnerRegisterPage />} />
          <Route path="/blog" element={<KnowledgeLandingPage />} />
          <Route path="/rehber" element={<KnowledgeLandingPage />} />
          <Route path="/sozluk" element={<KnowledgeLandingPage />} />
          <Route path="/r/:code" element={<ReferralLandingPage />} />
          <Route path="/strategic_partner/:code" element={<ReferralLandingPage />} />
          <Route path="/supplier/:code" element={<ReferralLandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/activate-account" element={<InternalUserActivationPage />} />
          <Route path="/supplier/login" element={<SupplierLoginPage />} />
          <Route path="/supplier/register" element={<SupplierRegisterPage />} />
          <Route path="/supplier/email-change-confirm" element={<SupplierEmailChangeConfirmPage />} />

          <Route element={<SupplierRoute />}>
            <Route path="/supplier/dashboard" element={<SupplierDashboard />} />
            <Route path="/supplier/profile" element={<SupplierProfilePage />} />
            <Route path="/supplier/finance" element={<SupplierFinancePage />} />
            <Route path="/supplier/workspace" element={<SupplierWorkspacePage />} />
            <Route path="/supplier/portal" element={<Navigate to="/supplier/workspace?tab=offers" replace />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/talent/profile" element={<TalentProfilePage />} />
              <Route path="/admin/payout-requests" element={<PayoutAdminPage />} />
              <Route path="/admin/talent-ecosystem" element={<TalentAdminControlPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/quotes" element={<QuoteListPage />} />
              <Route path="/quotes/create" element={<QuoteCreatePage />} />
              <Route path="/quotes/:id" element={<QuoteDetailPage />} />
              <Route path="/quotes/:id/comparison" element={<QuoteComparisonReportPage />} />
              <Route path="/quotes/:id/edit" element={<QuoteDetailPage />} />
              <Route path="/403" element={<ForbiddenPage />} />

              <Route element={<RequirePermission permission="view:workspace-panel" />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/yukseltme-ekstra-ozellikler" element={<AdminPage />} />
              </Route>

              <Route element={<RequirePermission permission="view:admin" />}>
                <Route path="/admin/quotes" element={<AdminQuoteManagementPage />} />
                <Route path="/admin/personnel/:id" element={<PersonnelProfileEditorPage />} />
                <Route path="/admin/departments/:id" element={<DepartmentDetailPage />} />
                <Route path="/admin/companies/:id" element={<CompanyDetailPage />} />
                <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/admin/project-files/:projectId" element={<ProjectFilesPage />} />
                <Route path="/admin/suppliers/:id" element={<AdminSupplierDetailPage />} />
                <Route path="/admin/suppliers/:id/finance" element={<AdminSupplierFinancePage />} />
                <Route path="/admin/suppliers/:id/workspace" element={<AdminSupplierWorkspacePage />} />
                <Route path="/discovery-lab" element={<DiscoveryLab />} />
                <Route path="/admin/public-pricing" element={<PublicPricingAdminPage />} />
              </Route>

              <Route element={<RequirePermission permission="view:reports" />}>
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/app" element={<SmartFallbackRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
