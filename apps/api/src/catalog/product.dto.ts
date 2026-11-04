import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

const moneyPattern = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;

export class CreateProductDto {
  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @Transform(({ value }: { value: unknown }) => typeof value === 'number' ? String(value) : value)
  @IsString()
  @Matches(moneyPattern)
  sale_price!: string;

  // Facultatif : sans prix de revient, la marge est simplement inconnue (0).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return value ?? '0';
    const trimmed = value.trim();
    return trimmed ? trimmed : '0';
  })
  @IsString()
  @Matches(moneyPattern)
  cost_price?: string;

  // Facultatif : vide, la base fabrique le SKU (`generate_product_sku`).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim().toUpperCase();
    return trimmed ? trimmed : null;
  })
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,79}$/)
  sku?: string | null;

  // Quantité de départ, uniquement à la création : enregistrée comme stock
  // d'ouverture par la base.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  @IsString()
  @Matches(moneyPattern)
  initial_quantity?: string | null;

  @IsOptional()
  @IsUUID()
  location_id?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  @IsString()
  @Length(1, 80)
  barcode?: string | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  // Photo du produit (Supabase Storage). `null` efface la photo.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })
  @IsString()
  @Matches(/^https?:\/\/\S{1,780}$/)
  image_url?: string | null;
}

export class UpdateProductDto extends CreateProductDto {
  @IsUUID()
  variant_id!: string;

  @IsBoolean()
  active!: boolean;
}
