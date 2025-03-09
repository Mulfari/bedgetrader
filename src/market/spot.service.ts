import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SpotMarketTicker } from './interfaces/market.interface';
import axios from 'axios';
import WebSocket from 'ws';

@Injectable()
export class SpotMarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SpotMarketService.name);
  private spotTickers: Map<string, SpotMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK', 'AVAX', 'MATIC', 'UNI', 'LTC', 'SHIB', 'ATOM', 'BNB'];
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
    try {
      // Obtener datos iniciales mediante REST API
      this.logger.log('Initializing SpotMarketService...');
      await this.fetchInitialData();
      
      // Verificar si hay tickers con valores en 0 después de la carga inicial
      const hasZeroValues = Array.from(this.spotTickers.values()).some(ticker => 
        ticker.price === '0.00' || ticker.price === '0'
      );
      
      if (hasZeroValues) {
        this.logger.warn('Some tickers have zero values after initial data fetch');
        // Intentar obtener datos nuevamente
        await this.fetchInitialData();
      }
      
      // Iniciar conexión WebSocket
      this.connectWebSocket();
    } catch (error) {
      this.logger.error(`Error initializing SpotMarketService: ${error.message}`);
    }
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
                  price: this.formatPrice(price),
                  indexPrice: this.formatPrice(price),
                  change: `${changePercent.toFixed(2)}%`,
                  volume: this.formatVolume(parseFloat(ticker.volume24h)),
                  high24h: this.formatPrice(parseFloat(ticker.highPrice24h)),
                  low24h: this.formatPrice(parseFloat(ticker.lowPrice24h)),
                  volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
                  bidPrice: this.formatPrice(parseFloat(ticker.bid1Price)),
                  askPrice: this.formatPrice(parseFloat(ticker.ask1Price))
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

  private formatPrice(price: number): string {
    // Verificar si el precio es válido
    if (isNaN(price) || price === undefined || price === null) {
      this.logger.warn(`Invalid price value: ${price}`);
      return '0.00';
    }
    
    // Para valores muy pequeños, usar más decimales
    if (price < 0.0001) {
      return price.toFixed(8); // Usar 8 decimales para valores extremadamente pequeños (como SHIB)
    } else if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else if (price < 10) {
      return price.toFixed(3);
    } else {
      return price.toFixed(2);
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
      
      // Contador de símbolos con datos válidos
      let validDataCount = 0;
      
      // Obtener datos de la API de Bybit para cada símbolo
      for (const symbol of this.symbols) {
        try {
          this.logger.log(`Fetching data for ${symbol}USDT...`);
          
          // Intentar hasta 3 veces si hay errores
          let attempts = 0;
          let success = false;
          
          while (attempts < 3 && !success) {
            try {
              const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
                params: {
                  category: 'spot',
                  symbol: `${symbol}USDT`
                },
                timeout: 5000 // Timeout de 5 segundos
              });
              
              if (tickerResponse.data?.result?.list?.[0]) {
                const ticker = tickerResponse.data.result.list[0];
                
                // Formatear los datos
                const price = parseFloat(ticker.lastPrice);
                const changePercent = parseFloat(ticker.price24hPcnt) * 100;
                
                // Verificar que el precio sea válido
                if (!isNaN(price) && price > 0) {
                  this.logger.log(`Valid price for ${symbol}USDT: ${price}`);
                  
                  // Actualizar el ticker
                  this.spotTickers.set(symbol, {
                    symbol,
                    price: this.formatPrice(price),
                    indexPrice: this.formatPrice(price),
                    change: `${changePercent.toFixed(2)}%`,
                    volume: this.formatVolume(parseFloat(ticker.volume24h)),
                    high24h: this.formatPrice(parseFloat(ticker.highPrice24h)),
                    low24h: this.formatPrice(parseFloat(ticker.lowPrice24h)),
                    volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
                    marketType: 'spot',
                    bidPrice: this.formatPrice(parseFloat(ticker.bid1Price)),
                    askPrice: this.formatPrice(parseFloat(ticker.ask1Price)),
                    favorite: false
                  });
                  
                  validDataCount++;
                  success = true;
                } else {
                  this.logger.warn(`Invalid price for ${symbol}USDT: ${price}`);
                  attempts++;
                }
              } else {
                this.logger.warn(`No ticker data found for ${symbol}USDT`);
                attempts++;
              }
            } catch (error) {
              this.logger.error(`Error fetching data for ${symbol}USDT (attempt ${attempts + 1}): ${error.message}`);
              attempts++;
              // Esperar un poco antes de reintentar
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!success) {
            this.logger.error(`Failed to fetch data for ${symbol}USDT after ${attempts} attempts`);
          }
        } catch (error) {
          this.logger.error(`Error processing ${symbol}USDT: ${error.message}`);
        }
      }
      
      this.logger.log(`Initial spot market data fetched successfully for ${validDataCount}/${this.symbols.length} symbols`);
      
      // Si no se obtuvieron datos válidos para ningún símbolo, lanzar un error
      if (validDataCount === 0) {
        throw new Error('No valid data obtained for any symbol');
      }
    } catch (error) {
      this.logger.error(`Error fetching initial spot market data: ${error.message}`);
      throw error; // Propagar el error para que se pueda manejar en el nivel superior
    }
  }

  async fetchSpotData(): Promise<void> {
    // Verificar si hay tickers con valores en 0
    const hasZeroValues = Array.from(this.spotTickers.values()).some(ticker => 
      ticker.price === '0.00' || ticker.price === '0'
    );
    
    // Si tenemos conexión WebSocket activa y no hay valores en 0, no necesitamos hacer fetch
    if (this.wsConnected && !hasZeroValues) {
      return;
    }
    
    // Si no hay WebSocket o hay valores en 0, intentamos obtener datos mediante REST API
    this.logger.log('WebSocket not connected or zero values detected, fetching data via REST API...');
    await this.fetchInitialData();
  }

  getSpotTickers(): SpotMarketTicker[] {
    return Array.from(this.spotTickers.values());
  }

  getSpotTicker(symbol: string): SpotMarketTicker | undefined {
    return this.spotTickers.get(symbol);
  }
} 