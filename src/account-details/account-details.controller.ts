import { Controller, Get, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { AccountDetailsService } from './account-details.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('account-details')
export class AccountDetailsController {
  constructor(private readonly accountDetailsService: AccountDetailsService) {}

  // ✅ Obtener balance de una cuenta específica
  @UseGuards(JwtAuthGuard)
  @Get(':userId/:subAccountId')
  async getAccountDetails(@Param('userId') userId: string, @Param('subAccountId') subAccountId: string) {
    try {
      return await this.accountDetailsService.getAccountBalance(subAccountId, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Obtener operaciones de una cuenta específica
  @UseGuards(JwtAuthGuard)
  @Get(':userId/:subAccountId/trades')
  async getAccountTrades(@Param('userId') userId: string, @Param('subAccountId') subAccountId: string) {
    try {
      return await this.accountDetailsService.getAccountTrades(subAccountId, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
