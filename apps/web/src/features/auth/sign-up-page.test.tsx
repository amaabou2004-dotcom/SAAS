import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignUpPage } from './sign-up-page';

describe('SignUpPage', () => {
  it('shows an honest configuration state instead of simulating signup', () => {
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Connexion au service à configurer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recevoir mon code de vérification' })).toBeDisabled();
    expect(screen.queryByText(/utilisateur/i)).not.toBeInTheDocument();
  });
});
