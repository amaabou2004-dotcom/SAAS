import { Module } from '@nestjs/common';
import { InvitationsController, TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [TeamController, InvitationsController],
  providers: [TeamService],
})
export class TeamModule {}
