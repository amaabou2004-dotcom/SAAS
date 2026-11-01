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

  @Transform(({ value }: { value: unknown }) => typeof value === 'number' ? String(value) : value)
  @IsString()
  @Matches(moneyPattern)
  cost_price!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,79}$/)
  sku!: string;

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
}

export class UpdateProductDto extends CreateProductDto {
  @IsUUID()
  variant_id!: string;

  @IsBoolean()
  active!: boolean;
}
