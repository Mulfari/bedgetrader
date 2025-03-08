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
        nextFundingTime: firstTicker.nextFundingTime,
        fundingRateTimestamp: firstTicker.fundingRateTimestamp
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
    
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol.toUpperCase());
    
    if (ticker) {
      this.logger.log(`Returning perpetual ticker for ${symbol}`);
      return ticker;
    } else {
      this.logger.warn(`Perpetual ticker not found for ${symbol}`);
      return undefined;
    }
  }

  @Get('funding/:symbol')
  async getFundingInfo(@Param('symbol') symbol: string): Promise<any> {
    this.logger.log(`Request received for funding info: ${symbol}`);
    
    try {
      // Obtener datos directamente de la API de Bybit
      const fundingResponse = await axios.get('https://api.bybit.com/v5/market/funding/history', {
        params: {
          category: 'linear',
          symbol: `${symbol.toUpperCase()}USDT`,
          limit: 1
        }
      });
      
      // Verificar si la respuesta es válida
      if (fundingResponse.data?.retCode !== 0) {
        this.logger.error(`Error from Bybit API (funding): ${fundingResponse.data?.retMsg || 'Unknown error'}`);
        return {
          success: false,
          error: fundingResponse.data?.retMsg || 'Error al obtener datos de funding'
        };
      }
      
      const funding = fundingResponse.data?.result?.list?.[0] || {};
      
      // Formatear los datos
      const fundingRate = parseFloat(funding.fundingRate || '0') * 100;
      const fundingRateTimestamp = funding.fundingRateTimestamp ? parseInt(funding.fundingRateTimestamp) : null;
      
      // Obtener datos del ticker para complementar la información
      const ticker = this.perpetualMarketService.getPerpetualTicker(symbol.toUpperCase());
      
      // Calcular próximo tiempo de funding (cada 8 horas: 00:00, 08:00, 16:00 UTC)
      let nextFundingTime = null;
      if (ticker && ticker.nextFundingTime) {
        nextFundingTime = ticker.nextFundingTime;
      } else {
        const now = new Date();
        const hours = now.getUTCHours();
        const nextFundingHour = Math.ceil(hours / 8) * 8 % 24;
        nextFundingTime = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + (nextFundingHour <= hours ? 1 : 0),
          nextFundingHour,
          0,
          0
        )).getTime();
      }
      
      // Obtener datos adicionales del ticker
      const tickerResponse = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: {
          category: 'linear',
          symbol: `${symbol.toUpperCase()}USDT`
        }
      });
      
      let tickerData: any = {};
      if (tickerResponse.data?.retCode === 0 && 
          tickerResponse.data?.result?.list && 
          tickerResponse.data.result.list.length > 0) {
        tickerData = tickerResponse.data.result.list[0];
      }
      
      return {
        success: true,
        symbol: symbol.toUpperCase(),
        fundingRate: `${fundingRate.toFixed(4)}%`,
        fundingRateRaw: funding.fundingRate,
        fundingRateTimestamp,
        fundingRateDate: fundingRateTimestamp ? new Date(fundingRateTimestamp).toISOString() : null,
        nextFundingTime,
        nextFundingDate: nextFundingTime ? new Date(nextFundingTime).toISOString() : null,
        tickerData: {
          fundingRate: tickerData.fundingRate || null,
          nextFundingTime: tickerData.nextFundingTime || null,
          lastPrice: tickerData.lastPrice || null,
          markPrice: tickerData.markPrice || null,
          indexPrice: tickerData.indexPrice || null
        },
        rawFundingResponse: funding
      };
    } catch (error) {
      this.logger.error(`Error fetching funding info: ${error.message}`);
      return {
        success: false,
        error: error.message
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

  @Get('complete/:symbol')
  async getCompleteMarketInfo(@Param('symbol') symbol: string): Promise<any> {
    this.logger.log(`Request received for complete market info: ${symbol}`);
    
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // 1. Obtener datos del ticker desde nuestro servicio
      const ticker = this.perpetualMarketService.getPerpetualTicker(upperSymbol);
      
      // 2. Obtener datos de funding directamente de la API
      const fundingResponse = await axios.get('https://api.bybit.com/v5/market/funding/history', {
        params: {
          category: 'linear',
          symbol: `${upperSymbol}USDT`,
          limit: 1
        }
      });
      
      let fundingData = null;
      if (fundingResponse.data?.retCode === 0 && 
          fundingResponse.data?.result?.list && 
          fundingResponse.data.result.list.length > 0) {
        fundingData = fundingResponse.data.result.list[0];
      }
      
      // 3. Obtener datos del ticker directamente de la API
      const tickerResponse = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: {
          category: 'linear',
          symbol: `${upperSymbol}USDT`
        }
      });
      
      let tickerApiData: any = null;
      if (tickerResponse.data?.retCode === 0 && 
          tickerResponse.data?.result?.list && 
          tickerResponse.data.result.list.length > 0) {
        tickerApiData = tickerResponse.data.result.list[0];
      }
      
      // Formatear los datos de funding
      let fundingRate = 0;
      let fundingRateTimestamp = null;
      
      if (fundingData) {
        fundingRate = parseFloat(fundingData.fundingRate || '0') * 100;
        fundingRateTimestamp = fundingData.fundingRateTimestamp ? parseInt(fundingData.fundingRateTimestamp) : null;
      }
      
      // Calcular próximo tiempo de funding
      let nextFundingTime = null;
      
      if (tickerApiData && tickerApiData.nextFundingTime) {
        nextFundingTime = parseInt(tickerApiData.nextFundingTime);
      } else if (ticker && ticker.nextFundingTime) {
        nextFundingTime = ticker.nextFundingTime;
      } else {
        const now = new Date();
        const hours = now.getUTCHours();
        const nextFundingHour = Math.ceil(hours / 8) * 8 % 24;
        nextFundingTime = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + (nextFundingHour <= hours ? 1 : 0),
          nextFundingHour,
          0,
          0
        )).getTime();
      }
      
      return {
        success: true,
        symbol: upperSymbol,
        // Datos de nuestro servicio
        serviceData: ticker || null,
        // Datos de funding
        funding: {
          fundingRate: `${fundingRate.toFixed(4)}%`,
          fundingRateRaw: fundingData?.fundingRate || '0',
          fundingRateTimestamp,
          fundingRateDate: fundingRateTimestamp ? new Date(fundingRateTimestamp).toISOString() : null,
        },
        // Datos del ticker de la API
        ticker: tickerApiData ? {
          symbol: tickerApiData.symbol,
          lastPrice: tickerApiData.lastPrice,
          markPrice: tickerApiData.markPrice,
          indexPrice: tickerApiData.indexPrice,
          fundingRate: tickerApiData.fundingRate,
          nextFundingTime: tickerApiData.nextFundingTime ? parseInt(tickerApiData.nextFundingTime) : null,
          nextFundingDate: tickerApiData.nextFundingTime ? new Date(parseInt(tickerApiData.nextFundingTime)).toISOString() : null,
          openInterest: tickerApiData.openInterest,
          volume24h: tickerApiData.volume24h,
          turnover24h: tickerApiData.turnover24h,
          price24hPcnt: tickerApiData.price24hPcnt,
          highPrice24h: tickerApiData.highPrice24h,
          lowPrice24h: tickerApiData.lowPrice24h,
          bid1Price: tickerApiData.bid1Price,
          ask1Price: tickerApiData.ask1Price
        } : null,
        // Datos calculados
        calculated: {
          nextFundingTime,
          nextFundingDate: nextFundingTime ? new Date(nextFundingTime).toISOString() : null
        }
      };
    } catch (error) {
      this.logger.error(`Error fetching complete market info: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
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