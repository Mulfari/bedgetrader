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
    // Forzar la carga de datos iniciales si no hay conexión WebSocket
    if (!this.perpetualMarketService.getWebSocketStatus().connected) {
      this.logger.log('WebSocket not connected, fetching initial data...');
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    
    if (tickers.length > 0) {
      // Eliminar log de datos de ejemplo
    } else {
      this.logger.warn('No perpetual tickers found');
    }
    
    return tickers;
  }

  @Get('ticker/:symbol')
  async getPerpetualTicker(@Param('symbol') symbol: string): Promise<PerpetualMarketTicker | undefined> {
    // Forzar la carga de datos iniciales si no hay conexión WebSocket
    if (!this.perpetualMarketService.getWebSocketStatus().connected) {
      this.logger.log('WebSocket not connected, fetching initial data...');
      await this.perpetualMarketService.fetchInitialData();
    }
    
    const ticker = this.perpetualMarketService.getPerpetualTicker(symbol);
    
    if (!ticker) {
      this.logger.warn(`No ticker found for symbol: ${symbol}`);
    }
    
    return ticker;
  }

  @Get('funding/:symbol')
  async getFundingInfo(@Param('symbol') symbol: string): Promise<any> {
    // Reducir logs - eliminar log de cada solicitud
    // this.logger.log(`Request received for funding info: ${symbol}`);
    
    try {
      // Verificar que el símbolo sea válido
      const upperSymbol = symbol.toUpperCase();
      
      // Obtener datos de funding de Bybit
      const response = await axios.get('https://api.bybit.com/v5/market/funding/history', {
        params: {
          category: 'linear',
          symbol: `${upperSymbol}USDT`,
          limit: 10
        }
      });
      
      // Verificar si la respuesta es válida
      if (response.data?.retCode !== 0) {
        this.logger.error(`Error from Bybit API: ${response.data?.retMsg || 'Unknown error'}`);
        return { error: response.data?.retMsg || 'Unknown error' };
      }
      
      // Verificar si hay datos de funding
      if (!response.data?.result?.list || !Array.isArray(response.data.result.list) || response.data.result.list.length === 0) {
        this.logger.warn(`No funding data found for ${upperSymbol}USDT`);
        return { error: 'No funding data found' };
      }
      
      // Formatear los datos de funding
      const fundingData = response.data.result.list.map((item: any) => ({
        symbol: upperSymbol,
        fundingRate: `${(parseFloat(item.fundingRate) * 100).toFixed(4)}%`,
        fundingRateTimestamp: item.fundingRateTimestamp,
        fundingTime: new Date(parseInt(item.fundingTime)).toISOString()
      }));
      
      // Reducir logs - eliminar log de datos de funding
      // this.logger.log(`Returning funding data for ${upperSymbol}USDT: ${fundingData.length} records`);
      
      return {
        symbol: upperSymbol,
        fundingData
      };
    } catch (error) {
      this.logger.error(`Error fetching funding data for ${symbol}: ${error.message}`);
      return { error: error.message };
    }
  }
  
  @Get('status')
  async getServiceStatus() {
    // Reducir logs - eliminar log de cada solicitud
    // this.logger.log('Request received for service status');
    
    const wsStatus = this.perpetualMarketService.getWebSocketStatus();
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    
    return {
      webSocketConnected: wsStatus.connected,
      reconnectAttempts: wsStatus.reconnectAttempts,
      tickersCount: tickers.length,
      tickersWithZeroPrice: tickers.filter(t => t.price === '0.00').length,
      timestamp: new Date().toISOString()
    };
  }

  @Get('market/:symbol')
  async getCompleteMarketInfo(@Param('symbol') symbol: string): Promise<any> {
    // Reducir logs - eliminar log de cada solicitud
    // this.logger.log(`Request received for complete market info: ${symbol}`);
    
    try {
      // Verificar que el símbolo sea válido
      const upperSymbol = symbol.toUpperCase();
      
      // Obtener datos del ticker
      const ticker = this.perpetualMarketService.getPerpetualTicker(upperSymbol);
      if (!ticker) {
        this.logger.warn(`No ticker found for symbol: ${upperSymbol}`);
        return { error: 'Ticker not found' };
      }
      
      // Obtener datos de funding
      let fundingData = [];
      try {
        const fundingResponse = await axios.get('https://api.bybit.com/v5/market/funding/history', {
          params: {
            category: 'linear',
            symbol: `${upperSymbol}USDT`,
            limit: 5
          }
        });
        
        if (fundingResponse.data?.retCode === 0 && 
            fundingResponse.data?.result?.list && 
            Array.isArray(fundingResponse.data.result.list)) {
          fundingData = fundingResponse.data.result.list.map((item: any) => ({
            fundingRate: `${(parseFloat(item.fundingRate) * 100).toFixed(4)}%`,
            fundingTime: new Date(parseInt(item.fundingTime)).toISOString()
          }));
        }
      } catch (error) {
        this.logger.error(`Error fetching funding data: ${error.message}`);
      }
      
      // Obtener datos del orderbook
      let orderbook = { bids: [], asks: [] };
      try {
        const orderbookResponse = await axios.get('https://api.bybit.com/v5/market/orderbook', {
          params: {
            category: 'linear',
            symbol: `${upperSymbol}USDT`,
            limit: 10
          }
        });
        
        if (orderbookResponse.data?.retCode === 0 && orderbookResponse.data?.result) {
          orderbook = {
            bids: orderbookResponse.data.result.b || [],
            asks: orderbookResponse.data.result.a || []
          };
        }
      } catch (error) {
        this.logger.error(`Error fetching orderbook data: ${error.message}`);
      }
      
      // Obtener datos de trades recientes
      let recentTrades = [];
      try {
        const tradesResponse = await axios.get('https://api.bybit.com/v5/market/recent-trade', {
          params: {
            category: 'linear',
            symbol: `${upperSymbol}USDT`,
            limit: 10
          }
        });
        
        if (tradesResponse.data?.retCode === 0 && 
            tradesResponse.data?.result?.list && 
            Array.isArray(tradesResponse.data.result.list)) {
          recentTrades = tradesResponse.data.result.list.map((item: any) => ({
            price: item.price,
            size: item.size,
            side: item.side,
            time: new Date(parseInt(item.time)).toISOString()
          }));
        }
      } catch (error) {
        this.logger.error(`Error fetching recent trades data: ${error.message}`);
      }
      
      return {
        symbol: upperSymbol,
        ticker: {
          price: ticker.price,
          change: ticker.change,
          high24h: ticker.high24h,
          low24h: ticker.low24h,
          volume: ticker.volume,
          volumeUSDT: ticker.volumeUSDT,
          openInterest: ticker.openInterest,
          fundingRate: ticker.fundingRate,
          nextFundingTime: ticker.nextFundingTime,
          nextFundingDate: ticker.nextFundingTime ? new Date(ticker.nextFundingTime).toISOString() : null,
          bidPrice: ticker.bidPrice,
          askPrice: ticker.askPrice
        },
        fundingHistory: fundingData,
        orderbook: {
          bids: orderbook.bids.slice(0, 5),
          asks: orderbook.asks.slice(0, 5)
        },
        recentTrades: recentTrades.slice(0, 5)
      };
    } catch (error) {
      this.logger.error(`Error fetching complete market info: ${error.message}`);
      return { error: error.message };
    }
  }
  
  @Get('debug')
  async getDebugInfo() {
    // Reducir logs - eliminar log de cada solicitud
    // this.logger.log('Request received for debug info');
    
    const wsStatus = this.perpetualMarketService.getWebSocketStatus();
    const tickers = this.perpetualMarketService.getPerpetualTickers();
    
    // Obtener un ticker de ejemplo para diagnóstico
    const sampleTicker = tickers.length > 0 ? tickers[0] : null;
    
    return {
      webSocketStatus: {
        connected: wsStatus.connected,
        reconnectAttempts: wsStatus.reconnectAttempts
      },
      tickersStatus: {
        count: tickers.length,
        zeroValues: tickers.filter(t => t.price === '0.00').length,
        symbols: tickers.map(t => t.symbol)
      },
      sampleTicker,
      timestamp: new Date().toISOString()
    };
  }
} 