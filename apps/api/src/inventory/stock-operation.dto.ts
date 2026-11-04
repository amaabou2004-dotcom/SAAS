import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

const operationTypes = ['opening', 'receipt', 'adjustment', 'transfer'] as const;
const quantityPattern = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/;

export class StockOperationLineDto {
  @IsUUID()
  variant_id!: string;

  @IsUUID()
  location_id!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'number' ? String(value) : value)
  @IsString()
  @Matches(quantityPattern)
  quantity_delta!: string;
}

export class PostStockOperationDto {
  @IsIn(operationTypes)
  operation_type!: (typeof operationTypes)[number];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 500)
  reason?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StockOperationLineDto)
  lines!: StockOperationLineDto[];
}

export class ReverseStockOperationDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 500)
  reason!: string;
}
