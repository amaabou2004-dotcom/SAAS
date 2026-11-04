import { Body, Controller, Get, Headers, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { CreateSaleDto, VoidSaleDto } from './sales.dto.js';
import { SalesService } from './sales.service.js';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/sales')
export class SalesController {
  constructor(@Inject(SalesService) private readonly sales: SalesService) {}

  @Get()
  list(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.sales.list(auth.accessToken, tenantId);
  }

  @Get(':saleId')
  get(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
  ) {
    return this.sales.get(auth.accessToken, tenantId, saleId);
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: CreateSaleDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.sales.create(auth.accessToken, tenantId, input, idempotencyKey);
  }

  @Post(':saleId/void')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  voidSale(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
    @Body() input: VoidSaleDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.sales.void(auth.accessToken, tenantId, saleId, input, idempotencyKey);
  }
}
