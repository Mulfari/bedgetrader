import { Injectable, Logger } from '@nestjs/common';
import { SpotMarketTicker } from './interfaces/market.interface';
import axios from 'axios';

@Injectable()
export class SpotMarketService {
  private readonly logger = new Logger(SpotMarketService.name);
  private spotTickers: Map<string, SpotMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP'];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5000; // 5 segundos de caché

  constructor() {
    // Inicializar los tickers con valores por defecto
    this.symbols.forEach(symbol => {
      this.spotTickers.set(symbol, {
        symbol,
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
        marketType: 'spot',
        bidPrice: '0.00',
        askPrice: '0.00',
        favorite: false
      });
    });
  }

  async fetchSpotData(): Promise<void> {
    const now = Date.now();
    
    // Si los datos tienen menos de 5 segundos, usar la caché
    if (now - this.lastFetchTime < this.CACHE_DURATION) {
      return;
    }
    
    try {
      this.logger.log('Fetching spot market data from Bybit API...');
      
      // Obtener datos de la API de Bybit para cada símbolo
      for (const symbol of this.symbols) {
        const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
          params: {
            category: 'spot',
            symbol: `${symbol}USDT`
          }
        });
        
        if (tickerResponse.data && tickerResponse.data.result && tickerResponse.data.result.list && tickerResponse.data.result.list.length > 0) {
          const ticker = tickerResponse.data.result.list[0];
          this.logger.debug(`Updating ticker for ${symbol}: ${JSON.stringify(ticker)}`);
          
          // Obtener datos de 24h para el cambio porcentual
          const klineResponse = await axios.get(`https://api.bybit.com/v5/market/kline`, {
            params: {
              category: 'spot',
              symbol: `${symbol}USDT`,
              interval: 'D',
              limit: 2
            }
          });
          
          let changePercent = '0.00';
          if (klineResponse.data && klineResponse.data.result && klineResponse.data.result.list && klineResponse.data.result.list.length >= 2) {
            const today = parseFloat(klineResponse.data.result.list[0][4]); // Precio de cierre actual
            const yesterday = parseFloat(klineResponse.data.result.list[1][4]); // Precio de cierre anterior
            const change = ((today - yesterday) / yesterday) * 100;
            changePercent = change.toFixed(2);
          }
          
          // Formatear los datos
          const price = parseFloat(ticker.lastPrice);
          const volume = parseFloat(ticker.volume24h);
          const turnover = parseFloat(ticker.turnover24h);
          
          // Actualizar el ticker
          this.spotTickers.set(symbol, {
            symbol,
            price: price.toFixed(2),
            indexPrice: price.toFixed(2),
            change: `${changePercent}%`,
            volume: volume.toFixed(2),
            high24h: parseFloat(ticker.highPrice24h).toFixed(2),
            low24h: parseFloat(ticker.lowPrice24h).toFixed(2),
            volumeUSDT: turnover > 1000000 
              ? `${(turnover / 1000000).toFixed(2)}M` 
              : turnover.toFixed(2),
            marketType: 'spot',
            bidPrice: parseFloat(ticker.bid1Price).toFixed(2),
            askPrice: parseFloat(ticker.ask1Price).toFixed(2),
            favorite: false
          });
        } else {
          this.logger.warn(`No ticker found for ${symbol}USDT`);
        }
      }
      
      this.lastFetchTime = now;
      this.logger.log('Spot market data updated successfully');
    } catch (error) {
      this.logger.error(`Error fetching spot market data: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  getSpotTickers(): SpotMarketTicker[] {
    return Array.from(this.spotTickers.values());
  }

  getSpotTicker(symbol: string): SpotMarketTicker | undefined {
    return this.spotTickers.get(symbol);
  }
} 