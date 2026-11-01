import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 120)
  name!: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsBoolean()
  active!: boolean;
}
