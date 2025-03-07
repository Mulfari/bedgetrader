import { Controller, Get, Param, Logger } from '@nestjs/common';
import { PerpetualMarketService } from './perpetual.service';
import { PerpetualMarketTicker } from './interfaces/market.interface';

@Controller('market/perpetual')
export class PerpetualMarketController {
  private readonly logger = new Logger(PerpetualMarketController.name);
  
  constructor(private readonly perpetualMarketService: PerpetualMarketService) {}

  @Get('tickers')
  async getPerpetualTickers(): Promise<PerpetualMarketTicker[]> {
    this.logger.log('Request received for perpetual tickers');
    await this.perpetualMarketService.fetchPerpetualData();
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    this.logger.log(`Returning ${tickers.length} perpetual tickers`);
    return tickers;
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    this.logger.log(`Request received for perpetual ticker: ${symbol}`);
    await this.perpetualMarketService.fetchPerpetualData();
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol);
    if (ticker) {
      this.logger.log(`Returning perpetual ticker for ${symbol}`);
    } else {
      this.logger.warn(`Perpetual ticker not found for ${symbol}`);
    }
    return ticker;
  }
} 