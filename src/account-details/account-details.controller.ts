import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { AccountDetailsService } from './account-details.service';

@Controller('account-details')
export class AccountDetailsController {
  constructor(private readonly accountDetailsService: AccountDetailsService) {}

  // ✅ Obtener balance de una cuenta específica
  @Get(':userId')
  async getAccountDetails(@Param('userId') userId: string) {
    try {
      return await this.accountDetailsService.getAccountBalance(userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
