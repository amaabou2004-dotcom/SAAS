import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';
import type { SupabaseService } from './supabase.service.js';

function contextWithAuthorization(authorization?: string) {
  const request = { headers: { authorization } };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

describe('SupabaseAuthGuard', () => {
  it('rejects a missing bearer token before calling Supabase', async () => {
    const verifyAccessToken = vi.fn();
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as unknown as SupabaseService);
    const { context } = contextWithAuthorization();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed user', async () => {
    const guard = new SupabaseAuthGuard({
      verifyAccessToken: vi.fn().mockResolvedValue({ email_confirmed_at: null }),
    } as unknown as SupabaseService);
    const { context } = contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches the verified user and token to the request', async () => {
    const user = { id: 'user-id', email_confirmed_at: '2026-11-01T12:00:00Z' };
    const guard = new SupabaseAuthGuard({
      verifyAccessToken: vi.fn().mockResolvedValue(user),
    } as unknown as SupabaseService);
    const { context, request } = contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toMatchObject({ authUser: user, accessToken: 'valid-token' });
  });
});
