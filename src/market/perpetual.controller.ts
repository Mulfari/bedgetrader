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
      this.logger.log('WebSocket not connected, fetching initial data...');
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    
    // Verificar que los datos tengan la estructura correcta
    if (tickers.length > 0) {
      const firstTicker = tickers[0];
      this.logger.log(`Sample ticker data: ${JSON.stringify({
        symbol: firstTicker.symbol,
        price: firstTicker.price,
        openInterest: firstTicker.openInterest,
        fundingRate: firstTicker.fundingRate,
        nextFundingTime: firstTicker.nextFundingTime
      })}`);
    } else {
      this.logger.warn('No perpetual tickers found');
    }
    
    this.logger.log(`Returning ${tickers.length} perpetual tickers`);
    return tickers;
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    this.logger.log(`Request received for perpetual ticker: ${symbol}`);
    
    // Forzar la carga de datos iniciales si no hay conexión WebSocket
    if (!this.perpetualMarketService.getWebSocketStatus().connected) {
      this.logger.log('WebSocket not connected, fetching initial data...');
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol);
    if (ticker) {
      this.logger.log(`Returning perpetual ticker for ${symbol}: ${JSON.stringify({
        price: ticker.price,
        openInterest: ticker.openInterest,
        fundingRate: ticker.fundingRate,
        nextFundingTime: ticker.nextFundingTime
      })}`);
    } else {
      this.logger.warn(`Perpetual ticker not found for ${symbol}`);
    }
    
    return ticker;
  }
  
  @Get('status')
  async getServiceStatus() {
    this.logger.log('Request received for perpetual service status');
    
    // Obtener datos actuales
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    const wsStatus = this.perpetualMarketService.getWebSocketStatus();
    
    // Verificar si hay datos
    const hasData = tickers.length > 0;
    
    // Verificar si los datos son válidos
    let dataStatus = 'unknown';
    let missingProperties = [];
    
    if (hasData) {
      const sampleTicker = tickers[0];
      
      // Verificar propiedades críticas
      if (!sampleTicker.openInterest) missingProperties.push('openInterest');
      if (!sampleTicker.fundingRate) missingProperties.push('fundingRate');
      if (!sampleTicker.nextFundingTime) missingProperties.push('nextFundingTime');
      
      dataStatus = missingProperties.length === 0 ? 'valid' : 'incomplete';
    }
    
    const status = {
      service: 'perpetual-market',
      timestamp: new Date().toISOString(),
      websocket: wsStatus,
      data: {
        available: hasData,
        count: tickers.length,
        status: dataStatus,
        missingProperties: missingProperties.length > 0 ? missingProperties : undefined,
        sample: hasData ? tickers[0] : undefined
      }
    };
    
    return status;
  }
} 