import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

const asTrimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class InviteMemberDto {
  @Transform(asTrimmed)
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  email!: string;

  @IsUUID()
  role_id!: string;

  @IsOptional()
  @Transform(asTrimmed)
  @IsString()
  @Length(2, 120)
  full_name?: string;
}

export class UpdateMemberRoleDto {
  @IsUUID()
  role_id!: string;
}
