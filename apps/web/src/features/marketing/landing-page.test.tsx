import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { legalInfo } from '../legal/legal-info';
import { LandingPage } from './landing-page';

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('page d’accueil publique', () => {
  it('présente le service et propose de créer un espace', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre commerce');
    expect(screen.getAllByRole('link', { name: /créer mon espace/i })[0]).toHaveAttribute(
      'href',
      '/auth/inscription',
    );
    expect(screen.getAllByRole('link', { name: /se connecter/i })[0]).toHaveAttribute(
      'href',
      '/auth/connexion',
    );
  });

  it('décrit les fonctions attendues par un visiteur', () => {
    renderPage();

    for (const texte of ['Stock toujours juste', 'Boutique en ligne', 'Rapports clairs']) {
      expect(screen.getByRole('heading', { name: new RegExp(texte) })).toBeInTheDocument();
    }
  });

  it('donne accès aux documents légaux depuis le pied de page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite',
    );
    expect(screen.getByRole('link', { name: 'Conditions générales' })).toHaveAttribute(
      'href',
      '/conditions',
    );
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
      'href',
      '/mentions-legales',
    );
  });

  it('rappelle la gratuité et le contact WhatsApp', () => {
    renderPage();

    expect(screen.getAllByText(/gratuit/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent === `WhatsApp ${legalInfo.phone}`).length,
    ).toBeGreaterThan(0);
  });

  it('ne cite aucun nom d’outil interne', () => {
    const { container } = renderPage();
    const texte = (container.textContent ?? '').toLowerCase();

    for (const mot of ['brevo', 'supabase', 'netlify', 'smtp']) {
      expect(texte).not.toContain(mot);
    }
  });
});
