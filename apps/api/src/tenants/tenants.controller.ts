import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { CreateTenantDto } from './create-tenant.dto.js';
import { TenantsService } from './tenants.service.js';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Entreprise créée avec son rôle propriétaire.' })
  create(
    @CurrentAuth() auth: { accessToken: string },
    @Body() input: CreateTenantDto,
  ) {
    return this.tenants.create(auth.accessToken, input);
  }

  @Get('me')
  @ApiOkResponse({ description: 'Entreprises accessibles au membre connecté.' })
  listMine(@CurrentAuth() auth: { accessToken: string }) {
    return this.tenants.listMine(auth.accessToken);
  }
}
