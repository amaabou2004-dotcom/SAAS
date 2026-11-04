import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './category.dto.js';
import type { CreateProductDto, UpdateProductDto } from './product.dto.js';

export interface CategoryRecord {
  id: string;
  tenant_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRecord {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductRecord {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sale_price: number;
  cost_price: number;
  active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category: CategoryRecord | null;
  variants: ProductVariantRecord[];
}

const categoryColumns = 'id, tenant_id, name, active, created_at, updated_at';
const productColumns = 'id, tenant_id, category_id, name, description, sale_price, cost_price, active, image_url, created_at, updated_at';
const variantColumns = 'id, tenant_id, product_id, sku, barcode, attributes, active, created_at, updated_at';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    const exception = toDatabaseHttpException(error, fallback);
    if (exception.getStatus() >= 500) {
      this.logger.error(`Catalog operation failed with database code ${error.code ?? 'unknown'}`);
    }
    throw exception;
  }

  async listCategories(accessToken: string, tenantId: string): Promise<CategoryRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken)
      .from('categories')
      .select(categoryColumns)
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) this.fail(error, 'Le chargement des catégories a échoué.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    return payload as CategoryRecord[];
  }

  async createCategory(accessToken: string, tenantId: string, input: CreateCategoryDto) {
    return this.saveCategory(accessToken, tenantId, null, input.name, true);
  }

  async updateCategory(accessToken: string, tenantId: string, categoryId: string, input: UpdateCategoryDto) {
    return this.saveCategory(accessToken, tenantId, categoryId, input.name, input.active);
  }

  private async saveCategory(
    accessToken: string,
    tenantId: string,
    categoryId: string | null,
    name: string,
    active: boolean,
  ): Promise<CategoryRecord> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('upsert_category', {
      p_tenant_id: tenantId,
      p_category_id: categoryId,
      p_name: name,
      p_active: active,
    });
    if (error) this.fail(error, 'L’enregistrement de la catégorie a échoué.');
    const payload: unknown = data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return payload as CategoryRecord;
  }

  async listProducts(accessToken: string, tenantId: string): Promise<ProductRecord[]> {
    const client = this.supabase.createUserClient(accessToken);
    const [productsResult, variantsResult, categoriesResult] = await Promise.all([
      client.from('products').select(productColumns).eq('tenant_id', tenantId).order('name'),
      client.from('product_variants').select(variantColumns).eq('tenant_id', tenantId).order('sku'),
      client.from('categories').select(categoryColumns).eq('tenant_id', tenantId).order('name'),
    ]);
    if (productsResult.error) this.fail(productsResult.error, 'Le chargement des produits a échoué.');
    if (variantsResult.error) this.fail(variantsResult.error, 'Le chargement des variantes a échoué.');
    if (categoriesResult.error) this.fail(categoriesResult.error, 'Le chargement des catégories a échoué.');

    const productsPayload: unknown = productsResult.data;
    const variantsPayload: unknown = variantsResult.data;
    const categoriesPayload: unknown = categoriesResult.data;
    if (!Array.isArray(productsPayload) || !Array.isArray(variantsPayload) || !Array.isArray(categoriesPayload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    const products = productsPayload as Array<Omit<ProductRecord, 'variants' | 'category'>>;
    const variants = variantsPayload as ProductVariantRecord[];
    const categories = new Map((categoriesPayload as CategoryRecord[]).map((category) => [category.id, category]));
    const variantsByProduct = new Map<string, ProductVariantRecord[]>();
    for (const variant of variants) {
      const current = variantsByProduct.get(variant.product_id) ?? [];
      current.push(variant);
      variantsByProduct.set(variant.product_id, current);
    }
    return products.map((product) => ({
      ...product,
      category: product.category_id ? categories.get(product.category_id) ?? null : null,
      variants: variantsByProduct.get(product.id) ?? [],
    }));
  }

  async createProduct(accessToken: string, tenantId: string, input: CreateProductDto) {
    return this.saveProduct(accessToken, tenantId, null, null, input, true);
  }

  async updateProduct(accessToken: string, tenantId: string, productId: string, input: UpdateProductDto) {
    return this.saveProduct(accessToken, tenantId, productId, input.variant_id, input, input.active);
  }

  private async saveProduct(
    accessToken: string,
    tenantId: string,
    productId: string | null,
    variantId: string | null,
    input: CreateProductDto,
    active: boolean,
  ) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('upsert_product', {
      p_tenant_id: tenantId,
      p_product_id: productId,
      p_variant_id: variantId,
      p_category_id: input.category_id ?? null,
      p_name: input.name,
      p_description: input.description ?? null,
      p_sale_price: input.sale_price,
      p_cost_price: input.cost_price,
      p_sku: input.sku,
      p_barcode: input.barcode ?? null,
      p_attributes: input.attributes ?? {},
      p_active: active,
      p_image_url: input.image_url ?? null,
    });
    if (error) this.fail(error, 'L’enregistrement du produit a échoué.');
    const payload: unknown = data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return payload;
  }
}
