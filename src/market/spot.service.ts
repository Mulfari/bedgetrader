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
        
        // Verificar el estado de la conexión periódicamente
        setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.logger.debug('WebSocket connection is still open');
            
            // Enviar un ping para mantener la conexión activa
            this.ws.send(JSON.stringify({ op: 'ping' }));
          } else {
            this.logger.warn(`WebSocket connection is not open. Current state: ${this.ws ? this.ws.readyState : 'null'}`);
            this.attemptReconnect();
          }
        }, 30000); // Verificar cada 30 segundos
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Respuesta a ping
          if (message.op === 'pong') {
            this.logger.debug('Received pong from server');
            return;
          }
          
          // Procesar datos de ticker
          if (message.topic && message.topic.startsWith('tickers.') && message.data) {
            const ticker = message.data;
            const symbolWithUsdt = message.topic.split('.')[1];
            const symbol = symbolWithUsdt.replace('USDT', '');
            
            if (this.symbols.includes(symbol)) {
              // Actualizar el ticker
              const existingTicker = this.spotTickers.get(symbol);
              if (existingTicker) {
                const price = parseFloat(ticker.lastPrice);
                const changePercent = parseFloat(ticker.price24hPcnt) * 100;
                
                // Log para depuración
                if (symbol === 'BTC') {
                  this.logger.debug(`Updating BTC ticker: price=${price.toFixed(2)}, change=${changePercent.toFixed(2)}%`);
                }
                
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
    try {
      this.logger.log('Fetching latest spot market data directly from Bybit API...');
      
      // Obtener todos los tickers en una sola llamada
      const response = await axios.get('https://api.bybit.com/v5/market/tickers?category=spot');
      
      if (!response.data || !response.data.result || !response.data.result.list) {
        this.logger.error('Invalid response format from Bybit API');
        return;
      }
      
      const tickers = response.data.result.list;
      this.logger.log(`Received ${tickers.length} tickers from Bybit API`);
      
      // Procesar cada ticker
      for (const ticker of tickers) {
        // Extraer el símbolo sin USDT
        const symbolWithUsdt = ticker.symbol;
        if (!symbolWithUsdt.endsWith('USDT')) continue;
        
        const symbol = symbolWithUsdt.replace('USDT', '');
        
        // Verificar si es uno de nuestros símbolos de interés
        if (!this.symbols.includes(symbol)) continue;
        
        // Actualizar el ticker
        const existingTicker = this.spotTickers.get(symbol) || {
          symbol,
          marketType: 'spot',
          favorite: false
        };
        
        const price = parseFloat(ticker.lastPrice);
        const changePercent = parseFloat(ticker.price24hPcnt) * 100;
        
        // Log para depuración
        this.logger.debug(`Updating ${symbol} ticker: price=${price}, change=${changePercent.toFixed(2)}%`);
        
        // Si es BTC, mostrar más detalles
        if (symbol === 'BTC') {
          this.logger.log(`BTC ticker details: lastPrice=${ticker.lastPrice}, price24hPcnt=${ticker.price24hPcnt}, volume24h=${ticker.volume24h}`);
        }
        
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
      
      // Verificar si se actualizaron los datos
      const btcTicker = this.spotTickers.get('BTC');
      if (btcTicker) {
        this.logger.log(`BTC ticker after update: price=${btcTicker.price}, change=${btcTicker.change}`);
      }
      
      this.logger.log('Spot market data updated successfully');
    } catch (error) {
      this.logger.error(`Error updating spot market data: ${error.message}`);
      if (error.response) {
        this.logger.error(`API response error: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    // Forzar una actualización de datos antes de devolver los tickers
    try {
      await this.fetchSpotData();
    } catch (error) {
      this.logger.error(`Error updating data before returning tickers: ${error.message}`);
    }
    
    const tickers = Array.from(this.spotTickers.values());
    this.logger.log(`Returning ${tickers.length} spot tickers, first ticker price: ${tickers.length > 0 ? tickers[0].price : 'N/A'}`);
    return tickers;
  }

  async getSpotTicker(symbol: string): Promise<SpotMarketTicker | undefined> {
    // Forzar una actualización de datos antes de devolver el ticker
    try {
      await this.fetchSpotData();
    } catch (error) {
      this.logger.error(`Error updating data before returning ticker for ${symbol}: ${error.message}`);
    }
    
    const ticker = this.spotTickers.get(symbol);
    if (ticker) {
      this.logger.log(`Returning ticker for ${symbol} with price: ${ticker.price}`);
    } else {
      this.logger.warn(`Ticker not found for symbol: ${symbol}`);
    }
    return ticker;
  }
} 