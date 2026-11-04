import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const currencies = ['XOF', 'EUR', 'USD', 'NGN', 'GHS', 'MAD'] as const;
const timezones = ['Africa/Niamey', 'Africa/Abidjan', 'Africa/Dakar', 'Africa/Douala', 'Europe/Paris', 'UTC'] as const;

export class CreateTenantDto {
  @ApiProperty({ example: 'Boutique Aminata' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 'boutique-aminata' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @Length(2, 63)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.',
  })
  slug!: string;

  @ApiProperty({ enum: currencies, default: 'XOF' })
  @IsIn(currencies)
  currency_code!: (typeof currencies)[number];

  @ApiProperty({ enum: timezones, default: 'Africa/Niamey' })
  @IsIn(timezones)
  timezone!: (typeof timezones)[number];
}
