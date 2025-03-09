import { Controller, Get, Param, Logger } from '@nestjs/common';
import { SpotMarketService } from './spot.service';
import { SpotMarketTicker } from './interfaces/market.interface';

@Controller('market/spot')
export class SpotMarketController {
  private readonly logger = new Logger(SpotMarketController.name);
  
  constructor(private readonly spotMarketService: SpotMarketService) {}

  @Get('tickers')
  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    try {
      // Forzar una actualización de datos
      await this.spotMarketService.fetchSpotData();
      
      // Obtener los tickers actualizados
      const tickers = this.spotMarketService.getSpotTickers();
      
      // Log para depuración
      this.logger.log(`Returning ${tickers.length} spot tickers`);
      if (tickers.length > 0) {
        const btcTicker = tickers.find(t => t.symbol === 'BTC');
        if (btcTicker) {
          this.logger.log(`BTC ticker: price=${btcTicker.price}, change=${btcTicker.change}`);
        }
      }
      
      return tickers;
    } catch (error) {
      this.logger.error(`Error getting spot tickers: ${error.message}`);
      throw error;
    }
  }

  @Get('ticker/:symbol')
  async getSpotTicker(@Param('symbol') symbol: string): Promise<SpotMarketTicker | undefined> {
    try {
      // Forzar una actualización de datos
      await this.spotMarketService.fetchSpotData();
      
      // Obtener el ticker específico
      const ticker = this.spotMarketService.getSpotTicker(symbol);
      
      // Log para depuración
      if (ticker) {
        this.logger.log(`Returning ticker for ${symbol}: price=${ticker.price}, change=${ticker.change}`);
      } else {
        this.logger.warn(`Ticker not found for symbol: ${symbol}`);
      }
      
      return ticker;
    } catch (error) {
      this.logger.error(`Error getting spot ticker for ${symbol}: ${error.message}`);
      throw error;
    }
  }
} 