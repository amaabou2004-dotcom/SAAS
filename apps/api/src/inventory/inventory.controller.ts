import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { InventoryService } from './inventory.service.js';
import { CreateLocationDto, UpdateLocationDto } from './location.dto.js';
import { PostStockOperationDto, ReverseStockOperationDto } from './stock-operation.dto.js';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('locations')
  listLocations(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.inventory.listLocations(auth.accessToken, tenantId);
  }

  @Post('locations')
  createLocation(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: CreateLocationDto,
  ) {
    return this.inventory.createLocation(auth.accessToken, tenantId, input);
  }

  @Patch('locations/:locationId')
  updateLocation(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() input: UpdateLocationDto,
  ) {
    return this.inventory.updateLocation(auth.accessToken, tenantId, locationId, input);
  }

  @Get('stock')
  listStock(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.inventory.listStock(auth.accessToken, tenantId);
  }

  @Get('movements')
  listMovements(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.inventory.listMovements(auth.accessToken, tenantId);
  }

  @Post('operations')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  postOperation(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: PostStockOperationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.inventory.postOperation(auth.accessToken, tenantId, input, idempotencyKey);
  }

  @Post('operations/:operationId/reversal')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reverseOperation(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
    @Body() input: ReverseStockOperationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.inventory.reverseOperation(auth.accessToken, tenantId, operationId, input.reason, idempotencyKey);
  }
}
