import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';

export class CreateLocationDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{0,19}$/)
  code!: string;
}

export class UpdateLocationDto extends CreateLocationDto {
  @IsBoolean()
  active!: boolean;
}
