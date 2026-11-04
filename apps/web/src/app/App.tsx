import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { SiteFooter } from '../components/site-footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../features/auth/auth-context';
import { AuthCallbackPage } from '../features/auth/auth-callback-page';
import { ForgotPasswordPage } from '../features/auth/forgot-password-page';
import { ResetPasswordPage } from '../features/auth/reset-password-page';
import { SignInPage } from '../features/auth/sign-in-page';
import { SignUpPage } from '../features/auth/sign-up-page';
import { VerifyEmailPage } from '../features/auth/verify-email-page';
import { LegalNoticePage, PrivacyPolicyPage, TermsPage } from '../features/legal/legal-pages';
import { OnboardingPage } from '../features/onboarding/onboarding-page';
import { CategoriesPage } from '../features/workspace/categories-page';
import { LocationsPage } from '../features/workspace/locations-page';
import { MovementsPage } from '../features/workspace/movements-page';
import { ProductsPage } from '../features/workspace/products-page';
import { StockPage } from '../features/workspace/stock-page';
import { WorkspaceLayout } from '../features/workspace/workspace-layout';
import { NewSalePage } from '../features/sales/new-sale-page';
import { QuickSalePage } from '../features/sales/quick-sale-page';
import { ReportsPage } from '../features/reports/reports-page';
import { SalesPage } from '../features/sales/sales-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { StorefrontPage } from '../features/storefront/storefront-page';
import { PublicShopPage } from '../features/storefront/public-shop-page';
import { TeamPage } from '../features/team/team-page';

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas" role="status" aria-label="Chargement">
      <LoaderCircle className="size-8 animate-spin text-mint" aria-hidden="true" />
    </div>
  );
}

function HomeRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  return <Navigate to={session ? '/workspace' : '/auth/connexion'} replace />;
}

function RequireVerifiedUser({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/auth/connexion" replace />;
  if (!user?.email_confirmed_at) return <Navigate to="/auth/verification" replace />;
  return children;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <main className="grid flex-1 place-items-center px-5 py-12">
        <div className="text-center">
          <p className="text-sm font-bold text-mint">404</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Cette page n’existe pas</h1>
          <p className="mt-3 text-slate-600">Le lien est peut-être incomplet ou la page a été déplacée.</p>
          <Button asChild variant="mint" className="mt-6">
            <Link to="/">Revenir à mon espace</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/auth/connexion" element={<SignInPage />} />
        <Route path="/auth/inscription" element={<SignUpPage />} />
        <Route path="/auth/verification" element={<VerifyEmailPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
        <Route path="/auth/reinitialisation" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <RequireVerifiedUser>
              <OnboardingPage />
            </RequireVerifiedUser>
          }
        />
        {/* Pages publiques et légales : accessibles sans compte. */}
        <Route path="/mentions-legales" element={<LegalNoticePage />} />
        <Route path="/confidentialite" element={<PrivacyPolicyPage />} />
        <Route path="/conditions" element={<TermsPage />} />
        {/* Boutique publique : aucun compte requis, hors de l'espace de travail. */}
        <Route path="/b/:slug" element={<PublicShopPage />} />
        <Route
          path="/workspace"
          element={
            <RequireVerifiedUser>
              <WorkspaceLayout />
            </RequireVerifiedUser>
          }
        >
          <Route index element={<Navigate to="accueil" replace />} />
          <Route path="accueil" element={<DashboardPage />} />
          <Route path="ventes" element={<SalesPage />} />
          <Route path="ventes/nouvelle" element={<NewSalePage />} />
          <Route path="ventes/caisse" element={<QuickSalePage />} />
          <Route path="rapports" element={<ReportsPage />} />
          <Route path="produits" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="emplacements" element={<LocationsPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="mouvements" element={<MovementsPage />} />
          <Route path="equipe" element={<TeamPage />} />
          <Route path="commandes" element={<StorefrontPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
