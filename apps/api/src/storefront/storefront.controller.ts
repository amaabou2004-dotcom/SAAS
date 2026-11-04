import { Body, Controller, Get, Headers, Inject, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import {
  CancelOrderDto,
  ConfirmOrderDto,
  NotificationSettingsDto,
  PlaceOrderDto,
  StorefrontSettingsDto,
} from './storefront.dto.js';
import { StorefrontService } from './storefront.service.js';

/** Vitrine publique : accessible sans compte, protégée par la limitation de débit globale. */
@ApiTags('shop')
@Controller('shop')
export class ShopController {
  constructor(@Inject(StorefrontService) private readonly storefront: StorefrontService) {}

  @Get(':slug')
  info(@Param('slug') slug: string) {
    return this.storefront.info(slug);
  }

  @Get(':slug/catalog')
  catalog(@Param('slug') slug: string) {
    return this.storefront.catalog(slug);
  }

  @Post(':slug/orders')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  placeOrder(
    @Param('slug') slug: string,
    @Body() input: PlaceOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.storefront.placeOrder(slug, input, idempotencyKey);
  }
}

/** Réglages de la boutique et commandes reçues (côté commerçant). */
@ApiTags('storefront')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/storefront')
export class StorefrontController {
  constructor(@Inject(StorefrontService) private readonly storefront: StorefrontService) {}

  @Get()
  settings(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.storefront.settings(auth.accessToken, tenantId);
  }

  @Post()
  saveSettings(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: StorefrontSettingsDto,
  ) {
    return this.storefront.saveSettings(auth.accessToken, tenantId, input);
  }

  @Get('orders')
  orders(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.storefront.orders(auth.accessToken, tenantId);
  }

  @Post('orders/:orderId/confirm')
  confirm(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() input: ConfirmOrderDto,
  ) {
    return this.storefront.confirm(auth.accessToken, tenantId, orderId, input);
  }

  @Post('orders/:orderId/cancel')
  cancel(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() input: CancelOrderDto,
  ) {
    return this.storefront.cancel(auth.accessToken, tenantId, orderId, input);
  }

  @Post('orders/:orderId/delivered')
  markDelivered(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.storefront.markDelivered(auth.accessToken, tenantId, orderId);
  }
}

/** Alertes e-mail des commandes (adresse à prévenir + historique d'envoi). */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/notifications')
export class NotificationController {
  constructor(@Inject(StorefrontService) private readonly storefront: StorefrontService) {}

  @Get()
  settings(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.storefront.notificationSettings(auth.accessToken, tenantId);
  }

  @Put()
  saveSettings(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: NotificationSettingsDto,
  ) {
    return this.storefront.saveNotificationSettings(auth.accessToken, tenantId, input);
  }

  @Get('history')
  history(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.storefront.notificationHistory(auth.accessToken, tenantId);
  }
}
