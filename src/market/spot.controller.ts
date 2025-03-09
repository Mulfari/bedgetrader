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
      // Intentar obtener datos actualizados
      await this.spotMarketService.fetchSpotData();
      
      // Obtener los tickers
      const tickers = this.spotMarketService.getSpotTickers();
      
      if (tickers.length > 0) {
        // Verificar si hay valores en 0
        const zeroValueTickers = tickers.filter(ticker => ticker.price === '0.00' || ticker.price === '0');
        if (zeroValueTickers.length > 0) {
          if (zeroValueTickers.length === tickers.length) {
            this.logger.warn('All tickers have zero values, trying to fetch data again...');
            await this.spotMarketService.fetchInitialData();
            return this.spotMarketService.getSpotTickers();
          }
        }
      } else {
        this.logger.warn('No spot tickers found');
      }
      
      return tickers;
    } catch (error) {
      this.logger.error(`Error getting spot tickers: ${error.message}`);
      // Devolver un array vacío en caso de error
      return [];
    }
  }

  @Get('ticker/:symbol')
  async getSpotTicker(@Param('symbol') symbol: string): Promise<SpotMarketTicker | undefined> {
    try {
      // Intentar obtener datos actualizados
      await this.spotMarketService.fetchSpotData();
      
      // Obtener el ticker
      const ticker = this.spotMarketService.getSpotTicker(symbol);
      
      if (ticker) {
        // Verificar si el ticker tiene valores en 0
        if (ticker.price === '0.00' || ticker.price === '0') {
          this.logger.warn(`Ticker ${symbol} has zero value`);
          
          // Intentar obtener datos nuevamente
          this.logger.warn('Trying to fetch data again...');
          await this.spotMarketService.fetchInitialData();
          return this.spotMarketService.getSpotTicker(symbol);
        }
      } else {
        this.logger.warn(`No ticker found for symbol: ${symbol}`);
      }
      
      return ticker;
    } catch (error) {
      this.logger.error(`Error getting spot ticker ${symbol}: ${error.message}`);
      // Devolver undefined en caso de error
      return undefined;
    }
  }
} 