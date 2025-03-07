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
    
    // Forzar la carga de datos iniciales si no hay conexión WebSocket
    if (!this.perpetualMarketService.getWebSocketStatus().connected) {
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    this.logger.log(`Returning ${tickers.length} perpetual tickers`);
    return tickers;
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    this.logger.log(`Request received for perpetual ticker: ${symbol}`);
    
    // Forzar la carga de datos iniciales si no hay conexión WebSocket
    if (!this.perpetualMarketService.getWebSocketStatus().connected) {
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol);
    if (ticker) {
      return ticker;
    } else {
      this.logger.warn(`Perpetual ticker not found for ${symbol}`);
      
      // Devolver valores por defecto si no se encuentra el ticker
      return {
        symbol,
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
        marketType: 'perpetual',
        openInterest: '0 ' + symbol,
        fundingRate: '0.00%',
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
        leverage: '10x',
        markPrice: '0.00',
        lastPrice: '0.00',
        bidPrice: '0.00',
        askPrice: '0.00',
        favorite: false
      };
    }
  }
  
  @Get('status')
  async getServiceStatus() {
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    const wsStatus = this.perpetualMarketService.getWebSocketStatus();
    
    return {
      service: 'perpetual-market',
      timestamp: new Date().toISOString(),
      websocket: wsStatus,
      data: {
        available: tickers.length > 0,
        count: tickers.length,
        sample: tickers.length > 0 ? tickers[0] : undefined
      }
    };
  }
} 