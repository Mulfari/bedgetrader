import { Controller, Get, Param, Logger } from '@nestjs/common';
import { SpotMarketService } from './spot.service';
import { SpotMarketTicker } from './interfaces/market.interface';
import axios from 'axios';

@Controller('market/spot')
export class SpotMarketController {
  private readonly logger = new Logger(SpotMarketController.name);
  
  constructor(private readonly spotMarketService: SpotMarketService) {}

  @Get('test-bybit')
  async testBybitApi() {
    try {
      this.logger.log('Testing direct connection to Bybit API...');
      
      // Hacer una solicitud directa a la API de Bybit
      const response = await axios.get('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');
      
      if (response.data && response.data.result && response.data.result.list && response.data.result.list.length > 0) {
        const ticker = response.data.result.list[0];
        this.logger.log(`Direct Bybit API response for BTC: ${JSON.stringify(ticker)}`);
        
        return {
          success: true,
          data: ticker,
          message: 'Successfully fetched data from Bybit API'
        };
      } else {
        this.logger.error('Invalid response format from Bybit API');
        return {
          success: false,
          error: 'Invalid response format',
          data: response.data
        };
      }
    } catch (error) {
      this.logger.error(`Error testing Bybit API: ${error.message}`);
      return {
        success: false,
        error: error.message,
        response: error.response?.data
      };
    }
  }

  @Get('tickers')
  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    try {
      // Obtener los tickers directamente (el método ya incluye fetchSpotData)
      const tickers = await this.spotMarketService.getSpotTickers();
      
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
      // Obtener el ticker específico (el método ya incluye fetchSpotData)
      const ticker = await this.spotMarketService.getSpotTicker(symbol);
      
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