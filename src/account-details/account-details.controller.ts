import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { AccountDetailsService } from './account-details.service';

@Controller('account-details')
export class AccountDetailsController {
  constructor(private readonly accountDetailsService: AccountDetailsService) {}

  // ✅ Obtener balance de una cuenta específica
  @Get(':userId/:subAccountId') // 🔹 Agregamos `subAccountId` a la URL
  async getAccountDetails(@Param('userId') userId: string, @Param('subAccountId') subAccountId: string) {
    try {
      return await this.accountDetailsService.getAccountBalance(subAccountId, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
