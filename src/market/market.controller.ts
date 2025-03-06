import { Controller, Get, Param } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketTicker } from './interfaces/market.interface';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('tickers')
  getAllTickers(): MarketTicker[] {
    return this.marketService.getAllTickers();
  }

  @Get('ticker/:symbol')
  getTicker(@Param('symbol') symbol: string): MarketTicker | undefined {
    return this.marketService.getTicker(symbol);
  }
} 