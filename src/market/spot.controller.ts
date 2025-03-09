import { Controller, Get, Param, Logger } from '@nestjs/common';
import { SpotMarketService } from './spot.service';
import { SpotMarketTicker } from './interfaces/market.interface';

@Controller('market/spot')
export class SpotMarketController {
  private readonly logger = new Logger(SpotMarketController.name);
  
  constructor(private readonly spotMarketService: SpotMarketService) {}

  @Get('tickers')
  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    this.logger.log('Request received for spot tickers');
    
    await this.spotMarketService.fetchSpotData();
    const tickers = this.spotMarketService.getSpotTickers();
    
    // Log para depuración
    this.logger.log(`Returning ${tickers.length} spot tickers`);
    if (tickers.length > 0) {
      this.logger.log(`Sample ticker data: ${JSON.stringify(tickers[0])}`);
    } else {
      this.logger.warn('No spot tickers found');
    }
    
    return tickers;
  }

  @Get('ticker/:symbol')
  async getSpotTicker(@Param('symbol') symbol: string): Promise<SpotMarketTicker | undefined> {
    this.logger.log(`Request received for spot ticker: ${symbol}`);
    
    await this.spotMarketService.fetchSpotData();
    const ticker = this.spotMarketService.getSpotTicker(symbol);
    
    // Log para depuración
    if (ticker) {
      this.logger.log(`Returning ticker data for ${symbol}: ${JSON.stringify(ticker)}`);
    } else {
      this.logger.warn(`No ticker found for symbol: ${symbol}`);
    }
    
    return ticker;
  }
} 