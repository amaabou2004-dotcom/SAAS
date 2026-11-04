import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '../database/database.types.js';

@Injectable()
export class SupabaseService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private configuration() {
    const url = this.config.get<string>('SUPABASE_URL')?.trim();
    const key = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY')?.trim();

    if (!url || !key || key.startsWith('replace-') || key.startsWith('your-')) {
      throw new ServiceUnavailableException('Le service Supabase doit être configuré sur l’API.');
    }

    return { url, key };
  }

  createUserClient(accessToken?: string): SupabaseClient<Database> {
    const { url, key } = this.configuration();
    return createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      },
    });
  }

  async verifyAccessToken(accessToken: string): Promise<User> {
    const { data, error } = await this.createUserClient().auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('La session est invalide ou a expiré.');
    }
    return data.user;
  }
}
