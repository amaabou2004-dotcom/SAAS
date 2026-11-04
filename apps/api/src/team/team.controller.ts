import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard.js';
import { InviteMemberDto, UpdateMemberRoleDto } from './team.dto.js';
import { TeamService } from './team.service.js';

@ApiTags('team')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tenants/:tenantId')
export class TeamController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @Get('members')
  listMembers(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.team.listMembers(auth.accessToken, tenantId);
  }

  @Patch('members/:membershipId')
  updateMemberRole(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() input: UpdateMemberRoleDto,
  ) {
    return this.team.updateMemberRole(auth.accessToken, tenantId, membershipId, input);
  }

  @Delete('members/:membershipId')
  removeMember(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.team.removeMember(auth.accessToken, tenantId, membershipId);
  }

  @Get('roles')
  listRoles(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.team.listRoles(auth.accessToken, tenantId);
  }

  @Get('invitations')
  listInvitations(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.team.listInvitations(auth.accessToken, tenantId);
  }

  @Post('invitations')
  invite(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() input: InviteMemberDto,
  ) {
    return this.team.invite(auth.accessToken, tenantId, input);
  }

  @Post('invitations/:invitationId/revoke')
  revokeInvitation(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.team.revokeInvitation(auth.accessToken, tenantId, invitationId);
  }

  @Get('permissions/:permission')
  hasPermission(
    @CurrentAuth() auth: { accessToken: string },
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('permission') permission: string,
  ) {
    return this.team.hasPermission(auth.accessToken, tenantId, permission);
  }
}

@ApiTags('team')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @Post('accept')
  accept(@CurrentAuth() auth: { accessToken: string }) {
    return this.team.acceptMyInvitations(auth.accessToken);
  }
}
