import { Module } from '@nestjs/common';
import { NotificationController, ShopController, StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';

@Module({
  controllers: [ShopController, StorefrontController, NotificationController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
