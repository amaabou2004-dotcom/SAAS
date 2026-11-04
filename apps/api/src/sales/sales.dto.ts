import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const paymentMethods = ['cash', 'mobile_money', 'credit'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

const asNumber = ({ value }: { value: unknown }) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value === 'string') return Number(value);
  return value;
};

const asTrimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SaleLineDto {
  @IsUUID()
  variant_id!: string;

  @Transform(asNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  /** Prix négocié ; s'il est absent, le prix du catalogue s'applique. */
  @IsOptional()
  @Transform(asNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price?: number;
}

export class CreateSaleDto {
  @IsUUID()
  location_id!: string;

  @IsIn(paymentMethods)
  payment_method!: PaymentMethod;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @MaxLength(120)
  payment_reference?: string;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @Length(2, 120)
  customer_name?: string;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  items!: SaleLineDto[];
}

export class VoidSaleDto {
  @Transform(asTrimmed)
  @IsString()
  @Length(2, 400)
  reason!: string;
}
