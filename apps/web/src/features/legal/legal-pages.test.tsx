import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { legalInfo } from './legal-info';
import { LegalNoticePage, PrivacyPolicyPage, TermsPage } from './legal-pages';

const pages = [
  { name: 'mentions légales', Page: LegalNoticePage, title: 'Mentions légales' },
  { name: 'politique de confidentialité', Page: PrivacyPolicyPage, title: 'Politique de confidentialité' },
  { name: 'conditions générales', Page: TermsPage, title: 'Conditions générales' },
];

function renderPage(Page: () => ReactElement) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

describe('pages légales', () => {
  it.each(pages)('affiche $name signée par l’éditeur', ({ Page, title }) => {
    const { container } = renderPage(Page);

    expect(screen.getAllByRole('heading', { level: 1 })[0]).toHaveTextContent(title);
    expect(container.textContent).toContain(legalInfo.publisher);
    expect(container.textContent).toContain(legalInfo.phone);
    expect(screen.getByText(new RegExp(`Dernière mise à jour`))).toBeInTheDocument();
  });

  it.each(pages)('donne accès aux autres documents depuis le pied de page ($name)', ({ Page }) => {
    renderPage(Page);

    const nav = screen.getByRole('navigation', { name: 'Informations légales' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/mentions-legales');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite');
    expect(screen.getByRole('link', { name: 'Conditions générales' })).toHaveAttribute('href', '/conditions');
  });

  it.each(pages)('ne révèle aucun nom d’outil interne ($name)', ({ Page }) => {
    const { container } = renderPage(Page);
    const texte = (container.textContent ?? '').toLowerCase();

    for (const mot of ['brevo', 'supabase', 'netlify', 'smtp', 'vault', 'mailpit', 'api key']) {
      expect(texte).not.toContain(mot);
    }
  });

  it.each(pages)('ne cite aucune ville dans la signature ($name)', ({ Page }) => {
    const { container } = renderPage(Page);

    expect((container.textContent ?? '').toLowerCase()).not.toContain('niamey');
  });

  it('annonce clairement la gratuité du service', () => {
    renderPage(TermsPage);

    expect(screen.getByText(/entièrement gratuit/i)).toBeInTheDocument();
  });
});
