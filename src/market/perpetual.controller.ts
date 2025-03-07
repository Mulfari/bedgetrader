import { Controller, Get, Param } from '@nestjs/common';
import { PerpetualMarketService } from './perpetual.service';
import { PerpetualMarketTicker } from './interfaces/market.interface';

@Controller('market/perpetual')
export class PerpetualMarketController {
  constructor(private readonly perpetualMarketService: PerpetualMarketService) {}

  @Get('tickers')
  async getPerpetualTickers(): Promise<PerpetualMarketTicker[]> {
    await this.perpetualMarketService.fetchPerpetualData();
    return this.perpetualMarketService.getPerpetualTickers();
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    await this.perpetualMarketService.fetchPerpetualData();
    return this.perpetualMarketService.getPerpetualTicker(symbol);
  }
} 