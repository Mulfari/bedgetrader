import { Controller, Get, Param } from '@nestjs/common';
import { SpotMarketService } from './spot.service';
import { SpotMarketTicker } from './interfaces/market.interface';

@Controller('market/spot')
export class SpotMarketController {
  constructor(private readonly spotMarketService: SpotMarketService) {}

  @Get('tickers')
  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    await this.spotMarketService.fetchSpotData();
    return this.spotMarketService.getSpotTickers();
  }

  @Get('ticker/:symbol')
  async getSpotTicker(@Param('symbol') symbol: string): Promise<SpotMarketTicker | undefined> {
    await this.spotMarketService.fetchSpotData();
    return this.spotMarketService.getSpotTicker(symbol);
  }

  @Get('symbols')
  getAvailableSymbols(): string[] {
    return this.spotMarketService.getAvailableSymbols();
  }
} 