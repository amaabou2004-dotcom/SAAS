import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignUpPage } from './sign-up-page';

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  isGoogleAuthEnabled: false,
  getSupabaseClient: vi.fn(),
}));

describe('SignUpPage', () => {
  it('shows an honest configuration state instead of simulating signup', () => {
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Mode développement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recevoir mon e-mail de vérification' })).toBeDisabled();
    expect(screen.queryByText(/utilisateur/i)).not.toBeInTheDocument();
  });
});
