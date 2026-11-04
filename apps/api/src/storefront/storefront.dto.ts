import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const asNumber = ({ value }: { value: unknown }) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value === 'string') return Number(value);
  return value;
};

const asTrimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export class ShopLineDto {
  @IsUUID()
  variant_id!: string;

  @Transform(asNumber)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;
}

/** Commande envoyée par un client depuis la boutique publique (aucun prix transmis). */
export class PlaceOrderDto {
  @Transform(asTrimmed)
  @IsString()
  @Length(2, 120)
  customer_name!: string;

  @Transform(asTrimmed)
  @IsString()
  @Length(6, 32)
  @Matches(/^[0-9+() .-]+$/, { message: 'Indiquez un numéro de téléphone valide.' })
  customer_phone!: string;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShopLineDto)
  items!: ShopLineDto[];
}

export class StorefrontSettingsDto {
  @Transform(asTrimmed)
  @IsString()
  @Matches(SLUG_PATTERN, {
    message: 'Adresse de boutique invalide : 3 à 40 caractères, lettres minuscules, chiffres et tirets.',
  })
  slug!: string;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @MaxLength(80)
  display_name?: string | null;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @Matches(/^[0-9+() .-]{6,32}$/, { message: 'Numéro WhatsApp invalide.' })
  whatsapp?: string | null;

  @IsBoolean()
  published!: boolean;

  @IsOptional()
  @IsUUID()
  default_location_id?: string | null;
}

export class ConfirmOrderDto {
  /** Emplacement qui sort le stock ; à défaut, celui des réglages de la boutique. */
  @IsOptional()
  @IsUUID()
  location_id?: string | null;
}

export class CancelOrderDto {
  @Transform(asTrimmed)
  @IsString()
  @Length(2, 400)
  reason!: string;
}
