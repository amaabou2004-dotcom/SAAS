import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { CatalogService } from './catalog.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto.js';
import { CreateProductDto, UpdateProductDto } from './product.dto.js';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.catalog.listCategories(auth.accessToken, tenantId);
  }

  @Post('categories')
  createCategory(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: CreateCategoryDto,
  ) {
    return this.catalog.createCategory(auth.accessToken, tenantId, input);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(auth.accessToken, tenantId, categoryId, input);
  }

  @Get('products')
  listProducts(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.catalog.listProducts(auth.accessToken, tenantId);
  }

  @Post('products')
  createProduct(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: CreateProductDto,
  ) {
    return this.catalog.createProduct(auth.accessToken, tenantId, input);
  }

  @Patch('products/:productId')
  updateProduct(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(auth.accessToken, tenantId, productId, input);
  }
}
