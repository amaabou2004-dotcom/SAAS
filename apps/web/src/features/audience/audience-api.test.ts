import { readAudienceSummary } from './audience-api';
import { isTrackablePath } from './use-page-view';

describe('lecture des chiffres d’audience', () => {
  it('accepte une réponse complète', () => {
    const result = readAudienceSummary({
      days: 30,
      first_day: '2026-11-01',
      totals: { views: 42, visitors: 18 },
      today: { views: 7, visitors: 5 },
      yesterday: { views: 4, visitors: 3 },
      daily: [{ day: '2026-11-05', views: 7, visitors: 5 }],
      paths: [{ path: '/', views: 30 }],
    });

    expect(result.totals).toEqual({ views: 42, visitors: 18 });
    expect(result.firstDay).toBe('2026-11-01');
    expect(result.daily).toHaveLength(1);
    expect(result.paths[0]).toEqual({ path: '/', views: 30 });
  });

  it('ne casse pas sur une réponse vide ou inattendue', () => {
    const result = readAudienceSummary(null);

    expect(result.totals).toEqual({ views: 0, visitors: 0 });
    expect(result.today).toEqual({ views: 0, visitors: 0 });
    expect(result.daily).toEqual([]);
    expect(result.paths).toEqual([]);
    expect(result.firstDay).toBeNull();
  });

  it('ignore les valeurs négatives ou non numériques', () => {
    const result = readAudienceSummary({
      totals: { views: -3, visitors: 'beaucoup' },
      daily: [{ day: '2026-11-05', views: '-1', visitors: 2 }],
    });

    expect(result.totals).toEqual({ views: 0, visitors: 0 });
    expect(result.daily[0]).toEqual({ day: '2026-11-05', views: 0, visitors: 2 });
  });
});

describe('pages mesurées', () => {
  it('ne mesure que les pages publiques', () => {
    expect(isTrackablePath('/')).toBe(true);
    expect(isTrackablePath('/b/chez-aicha')).toBe(true);
    expect(isTrackablePath('/confidentialite')).toBe(true);
    expect(isTrackablePath('/conditions')).toBe(true);
    expect(isTrackablePath('/')).toBe(true);
  });

  it('ne mesure jamais l’espace privé ni les formulaires', () => {
    expect(isTrackablePath('/workspace/accueil')).toBe(false);
    expect(isTrackablePath('/auth/connexion')).toBe(false);
    expect(isTrackablePath('/onboarding')).toBe(false);
    expect(isTrackablePath('')).toBe(false);
  });
});
