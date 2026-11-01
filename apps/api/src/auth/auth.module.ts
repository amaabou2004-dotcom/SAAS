import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';

@Global()
@Module({
  providers: [SupabaseService, SupabaseAuthGuard],
  exports: [SupabaseService, SupabaseAuthGuard],
})
export class AuthModule {}
