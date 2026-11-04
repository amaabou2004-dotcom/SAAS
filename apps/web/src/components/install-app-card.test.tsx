import { render, screen } from '@testing-library/react';
import { InstallAppCard } from './install-app-card';

describe('proposition d’installation', () => {
  it('ne montre rien quand le navigateur ne propose pas l’installation', () => {
    render(<InstallAppCard />);
    expect(screen.queryByText(/Installer Stokari/)).not.toBeInTheDocument();
  });

  it('affiche le bouton quand le navigateur le propose', async () => {
    render(<InstallAppCard />);

    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);

    expect(await screen.findByText(/Installer Stokari sur votre téléphone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Installer l’application/ })).toBeInTheDocument();
  });
});
