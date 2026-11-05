import { legalInfo, publicSiteUrl } from './legal-info';

describe('adresse publique du site', () => {
  it('est une adresse absolue, sans barre oblique finale', () => {
    const url = publicSiteUrl();

    expect(url).toMatch(/^https?:\/\/[^/]+$/);
  });

  it('retombe sur le domaine officiel quand aucune variable n’est fournie', () => {
    expect(publicSiteUrl()).toBe('https://stokari.com');
  });

  it('sert d’adresse canonique aux documents légaux', () => {
    expect(legalInfo.siteUrl).toBe(publicSiteUrl());
  });
});
