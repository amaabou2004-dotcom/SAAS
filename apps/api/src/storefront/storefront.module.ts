import { Module } from '@nestjs/common';
import { ShopController, StorefrontController } from './storefront.controller.js';
import { StorefrontService } from './storefront.service.js';

@Module({
  controllers: [ShopController, StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
