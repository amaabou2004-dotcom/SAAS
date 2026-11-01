import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Un jeton Bearer est requis.');
    }

    const accessToken = authorization.slice('Bearer '.length).trim();
    if (!accessToken) {
      throw new UnauthorizedException('Le jeton Bearer est vide.');
    }

    const user = await this.supabase.verifyAccessToken(accessToken);
    if (!user.email_confirmed_at) {
      throw new ForbiddenException('Vérifiez votre adresse e-mail avant de continuer.');
    }

    request.authUser = user;
    request.accessToken = accessToken;
    return true;
  }
}
