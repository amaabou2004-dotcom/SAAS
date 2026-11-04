import { IsOptional, Matches } from 'class-validator';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
  @Matches(isoDate, { message: 'La date de début doit être au format AAAA-MM-JJ.' })
  from!: string;

  @Matches(isoDate, { message: 'La date de fin doit être au format AAAA-MM-JJ.' })
  to!: string;

  @IsOptional()
  @Matches(/^[a-z_]+$/)
  section?: string;
}
