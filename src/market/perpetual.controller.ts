import { Controller, Get, Param, Logger } from '@nestjs/common';
import { PerpetualMarketService } from './perpetual.service';
import { PerpetualMarketTicker } from './interfaces/market.interface';
import axios from 'axios';

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
      return ticker;
    } else {
      this.logger.warn(`Perpetual ticker not found for ${symbol}, returning default values`);
      
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
        openInterest: '0 BTC',
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

  @Get('debug')
  async getDebugInfo() {
    this.logger.log('Request received for perpetual debug info');
    
    try {
      // Obtener datos directamente de la API de Bybit
      const symbol = 'BTC';
      const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
        params: {
          category: 'linear',
          symbol: `${symbol}USDT`
        }
      });
      
      const fundingResponse = await axios.get(`https://api.bybit.com/v5/market/funding/history`, {
        params: {
          category: 'linear',
          symbol: `${symbol}USDT`,
          limit: 1
        }
      });
      
      const orderbookResponse = await axios.get(`https://api.bybit.com/v5/market/orderbook`, {
        params: {
          category: 'linear',
          symbol: `${symbol}USDT`,
          limit: 1
        }
      });
      
      // Obtener datos del servicio
      const tickers = this.perpetualMarketService.getPerpetualTickers();
      const wsStatus = this.perpetualMarketService.getWebSocketStatus();
      
      // Devolver toda la información para diagnóstico
      return {
        service: {
          websocket: wsStatus,
          tickers: tickers.map(ticker => ({
            symbol: ticker.symbol,
            price: ticker.price,
            change: ticker.change,
            openInterest: ticker.openInterest,
            fundingRate: ticker.fundingRate,
            nextFundingTime: ticker.nextFundingTime
          }))
        },
        bybit: {
          ticker: tickerResponse.data?.result?.list?.[0],
          funding: fundingResponse.data?.result?.list?.[0],
          orderbook: {
            bid: orderbookResponse.data?.result?.b?.[0],
            ask: orderbookResponse.data?.result?.a?.[0]
          }
        }
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack
      };
    }
  }
} 