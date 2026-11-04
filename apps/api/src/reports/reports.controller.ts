import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { ReportQueryDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId/reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get()
  summary(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.summary(auth.accessToken, tenantId, query.from, query.to);
  }
}
