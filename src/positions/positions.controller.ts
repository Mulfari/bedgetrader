import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserPositions(@Request() req) {
    return this.positionsService.getUserPositions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('open')
  async getUserOpenPositions(@Request() req) {
    return this.positionsService.getUserOpenPositions(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subaccount/:subAccountId')
  async getSubAccountPositions(@Request() req, @Param('subAccountId') subAccountId: string) {
    return this.positionsService.getSubAccountPositions(subAccountId, req.user.userId);
  }
} 