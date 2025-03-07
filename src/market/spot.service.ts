import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SpotMarketTicker } from './interfaces/market.interface';
import axios from 'axios';
import WebSocket from 'ws';

@Injectable()
export class SpotMarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SpotMarketService.name);
  private spotTickers: Map<string, SpotMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP'];
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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

  async onModuleInit() {
    // Obtener datos iniciales mediante REST API
    await this.fetchInitialData();
    
    // Iniciar conexión WebSocket
    this.connectWebSocket();
  }

  onModuleDestroy() {
    this.closeWebSocket();
  }

  private connectWebSocket() {
    try {
      this.logger.log('Connecting to Bybit WebSocket...');
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/spot');

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log('WebSocket connection established');
        
        // Suscribirse a los tickers de SPOT
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          op: 'subscribe',
          args: symbols.map(symbol => `tickers.${symbol}`)
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
        this.logger.log(`Subscribed to tickers: ${symbols.join(', ')}`);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Procesar datos de ticker
          if (message.topic && message.topic.startsWith('tickers.') && message.data) {
            const ticker = message.data;
            const symbolWithUsdt = message.topic.split('.')[1];
            const symbol = symbolWithUsdt.replace('USDT', '');
            
            if (this.symbols.includes(symbol)) {
              this.logger.debug(`Received ticker update for ${symbol}: ${JSON.stringify(ticker)}`);
              
              // Actualizar el ticker
              const existingTicker = this.spotTickers.get(symbol);
              if (existingTicker) {
                const price = parseFloat(ticker.lastPrice);
                const changePercent = parseFloat(ticker.price24hPcnt) * 100;
                
                this.spotTickers.set(symbol, {
                  ...existingTicker,
                  price: price.toFixed(2),
                  indexPrice: price.toFixed(2),
                  change: `${changePercent.toFixed(2)}%`,
                  volume: parseFloat(ticker.volume24h).toFixed(2),
                  high24h: parseFloat(ticker.highPrice24h).toFixed(2),
                  low24h: parseFloat(ticker.lowPrice24h).toFixed(2),
                  volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
                  bidPrice: parseFloat(ticker.bid1Price).toFixed(2),
                  askPrice: parseFloat(ticker.ask1Price).toFixed(2)
                });
              }
            }
          }
        } catch (error) {
          this.logger.error(`Error processing WebSocket message: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`WebSocket error: ${error.message}`);
      });

      this.ws.on('close', () => {
        this.wsConnected = false;
        this.logger.warn('WebSocket connection closed');
        this.attemptReconnect();
      });
    } catch (error) {
      this.logger.error(`Error creating WebSocket: ${error.message}`);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      this.logger.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      this.logger.error(`Failed to reconnect after ${this.MAX_RECONNECT_ATTEMPTS} attempts`);
    }
  }

  private closeWebSocket() {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private formatVolume(volume: number): string {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    } else {
      return volume.toFixed(2);
    }
  }

  async fetchInitialData(): Promise<void> {
    try {
      this.logger.log('Fetching initial spot market data from Bybit API...');
      
      // Obtener datos de la API de Bybit para cada símbolo
      for (const symbol of this.symbols) {
        try {
          const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
            params: {
              category: 'spot',
              symbol: `${symbol}USDT`
            }
          });
          
          if (tickerResponse.data?.result?.list?.[0]) {
            const ticker = tickerResponse.data.result.list[0];
            
            // Formatear los datos
            const price = parseFloat(ticker.lastPrice);
            const changePercent = parseFloat(ticker.price24hPcnt) * 100;
            
            // Actualizar el ticker
            this.spotTickers.set(symbol, {
              symbol,
              price: price.toFixed(2),
              indexPrice: price.toFixed(2),
              change: `${changePercent.toFixed(2)}%`,
              volume: parseFloat(ticker.volume24h).toFixed(2),
              high24h: parseFloat(ticker.highPrice24h).toFixed(2),
              low24h: parseFloat(ticker.lowPrice24h).toFixed(2),
              volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
              marketType: 'spot',
              bidPrice: parseFloat(ticker.bid1Price).toFixed(2),
              askPrice: parseFloat(ticker.ask1Price).toFixed(2),
              favorite: false
            });
            
            this.logger.debug(`Initial data for ${symbol}: ${JSON.stringify(this.spotTickers.get(symbol))}`);
          } else {
            this.logger.warn(`No initial ticker data found for ${symbol}USDT`);
          }
        } catch (error) {
          this.logger.error(`Error fetching initial data for ${symbol}: ${error.message}`);
        }
      }
      
      this.logger.log('Initial spot market data fetched successfully');
    } catch (error) {
      this.logger.error(`Error fetching initial spot market data: ${error.message}`);
    }
  }

  async fetchSpotData(): Promise<void> {
    // Si tenemos conexión WebSocket activa, no necesitamos hacer fetch
    if (this.wsConnected) {
      return;
    }
    
    // Si no hay WebSocket, intentamos obtener datos mediante REST API
    await this.fetchInitialData();
  }

  getSpotTickers(): SpotMarketTicker[] {
    return Array.from(this.spotTickers.values());
  }

  getSpotTicker(symbol: string): SpotMarketTicker | undefined {
    return this.spotTickers.get(symbol);
  }
} 