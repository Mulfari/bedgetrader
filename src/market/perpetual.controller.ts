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
    
    // Forzar la carga de datos iniciales
    await this.perpetualMarketService.fetchInitialData();
    
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    this.logger.log(`Returning ${tickers.length} perpetual tickers`);
    
    return tickers;
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    this.logger.log(`Request received for perpetual ticker: ${symbol}`);
    
    // Forzar la carga de datos iniciales
    await this.perpetualMarketService.fetchInitialData();
    
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol);
    if (ticker) {
      this.logger.log(`Returning perpetual ticker for ${symbol}`);
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