import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PerpetualMarketTicker } from './interfaces/market.interface';
import axios from 'axios';
import WebSocket from 'ws';

@Injectable()
export class PerpetualMarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PerpetualMarketService.name);
  private perpetualTickers: Map<string, PerpetualMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP'];
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Inicializar los tickers con valores por defecto
    this.symbols.forEach(symbol => {
      this.perpetualTickers.set(symbol, {
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
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 horas por defecto
        leverage: '10x',
        markPrice: '0.00',
        lastPrice: '0.00',
        bidPrice: '0.00',
        askPrice: '0.00',
        favorite: false
      });
    });
  }

  async onModuleInit() {
    this.logger.log('Initializing PerpetualMarketService...');
    
    try {
      // Cargar datos iniciales
      await this.fetchInitialData();
      
      // Conectar WebSocket
      this.connectWebSocket();
      
      this.logger.log('PerpetualMarketService initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing PerpetualMarketService: ${error.message}`);
    }
  }

  onModuleDestroy() {
    this.closeWebSocket();
  }

  private connectWebSocket() {
    try {
      this.logger.log('Connecting to Bybit WebSocket for perpetual markets...');
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log('WebSocket connection established for perpetual markets');
        
        // Suscribirse a los tickers y funding de futuros
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          op: 'subscribe',
          args: [
            ...symbols.map(symbol => `tickers.${symbol}`),
            ...symbols.map(symbol => `funding.${symbol}`),
            ...symbols.map(symbol => `orderbook.1.${symbol}`)
          ]
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
        this.logger.log('Subscribed to perpetual markets');
        
        // Cargar datos iniciales después de conectar
        this.fetchInitialData()
          .then(() => this.logger.log('Initial data loaded after WebSocket connection'))
          .catch(err => this.logger.error(`Error loading initial data: ${err.message}`));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Solo imprimir mensajes de error
          if (message.success === false) {
            this.logger.warn(`WebSocket error message: ${JSON.stringify(message)}`);
          }
          
          // Ignorar mensajes que no son de datos
          if (!message.topic) return;
          
          const [msgType, ...rest] = message.topic.split('.');
          const symbolWithUsdt = rest[rest.length - 1];
          const symbol = symbolWithUsdt.replace('USDT', '');
          
          // Verificar que el símbolo sea válido
          if (!this.symbols.includes(symbol)) return;
          
          // Obtener el ticker existente
          const existingTicker = this.perpetualTickers.get(symbol);
          if (!existingTicker) return;
          
          // Crear una copia para actualizar
          let updatedTicker = { ...existingTicker };
          
          // Procesar según el tipo de mensaje
          switch (msgType) {
            case 'tickers':
              if (message.data) {
                const ticker = message.data;
                
                // Actualizar propiedades del ticker
                const price = parseFloat(ticker.lastPrice || existingTicker.price || '0');
                const changePercent = parseFloat(ticker.price24hPcnt || '0') * 100;
                
                updatedTicker = {
                  ...updatedTicker,
                  price: price.toFixed(2),
                  lastPrice: price.toFixed(2),
                  indexPrice: parseFloat(ticker.indexPrice || ticker.lastPrice || existingTicker.indexPrice || '0').toFixed(2),
                  markPrice: parseFloat(ticker.markPrice || ticker.lastPrice || existingTicker.markPrice || '0').toFixed(2),
                  change: `${changePercent.toFixed(2)}%`,
                  volume: parseFloat(ticker.volume24h || existingTicker.volume || '0').toFixed(2),
                  high24h: parseFloat(ticker.highPrice24h || existingTicker.high24h || '0').toFixed(2),
                  low24h: parseFloat(ticker.lowPrice24h || existingTicker.low24h || '0').toFixed(2),
                  volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h || '0')),
                  openInterest: this.formatVolume(parseFloat(ticker.openInterest || '0')) + ' BTC',
                  bidPrice: parseFloat(ticker.bid1Price || existingTicker.bidPrice || '0').toFixed(2),
                  askPrice: parseFloat(ticker.ask1Price || existingTicker.askPrice || '0').toFixed(2)
                };
              }
              break;
              
            case 'funding':
              if (message.data) {
                const funding = message.data;
                
                // Actualizar propiedades de funding
                const fundingRate = parseFloat(funding.fundingRate || '0') * 100;
                const nextFundingTime = funding.nextFundingTime 
                  ? new Date(funding.nextFundingTime).getTime() 
                  : existingTicker.nextFundingTime;
                
                updatedTicker = {
                  ...updatedTicker,
                  fundingRate: `${fundingRate.toFixed(4)}%`,
                  nextFundingTime
                };
              }
              break;
              
            case 'orderbook':
              if (message.data && message.data.b && message.data.a) {
                // Actualizar bid/ask
                updatedTicker = {
                  ...updatedTicker,
                  bidPrice: parseFloat(message.data.b[0][0] || existingTicker.bidPrice || '0').toFixed(2),
                  askPrice: parseFloat(message.data.a[0][0] || existingTicker.askPrice || '0').toFixed(2)
                };
              }
              break;
          }
          
          // Actualizar el ticker en el mapa
          this.perpetualTickers.set(symbol, updatedTicker);
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
    if (isNaN(volume) || volume === 0) return '0.00';
    
    if (volume >= 1000000000) {
      return (volume / 1000000000).toFixed(2) + 'B';
    } else if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(2) + 'K';
    } else {
      return volume.toFixed(2);
    }
  }

  async fetchInitialData(): Promise<void> {
    try {
      this.logger.log('Fetching initial perpetual market data...');
      
      for (const symbol of this.symbols) {
        try {
          // Usar Promise.all para hacer todas las llamadas en paralelo
          const [tickerResponse, fundingResponse, orderbookResponse] = await Promise.all([
            axios.get(`https://api.bybit.com/v5/market/tickers`, {
              params: {
                category: 'linear',
                symbol: `${symbol}USDT`
              }
            }),
            axios.get(`https://api.bybit.com/v5/market/funding/history`, {
              params: {
                category: 'linear',
                symbol: `${symbol}USDT`,
                limit: 1
              }
            }),
            axios.get(`https://api.bybit.com/v5/market/orderbook`, {
              params: {
                category: 'linear',
                symbol: `${symbol}USDT`,
                limit: 1
              }
            })
          ]);
          
          // Extraer datos de las respuestas
          const tickerData = tickerResponse.data?.result?.list?.[0];
          const fundingData = fundingResponse.data?.result?.list?.[0];
          const orderbookData = orderbookResponse.data?.result;
          
          if (tickerData) {
            // Formatear datos
            const price = parseFloat(tickerData.lastPrice || '0');
            const changePercent = parseFloat(tickerData.price24hPcnt || '0') * 100;
            const fundingRate = parseFloat(fundingData?.fundingRate || '0') * 100;
            
            // Calcular próximo tiempo de funding (cada 8 horas: 00:00, 08:00, 16:00 UTC)
            const now = new Date();
            const hours = now.getUTCHours();
            const nextFundingHour = Math.ceil(hours / 8) * 8 % 24;
            const nextFundingTime = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate() + (nextFundingHour <= hours ? 1 : 0),
              nextFundingHour,
              0,
              0
            )).getTime();
            
            // Crear objeto ticker con todos los datos
            const updatedTicker: PerpetualMarketTicker = {
              symbol,
              price: price.toFixed(2),
              lastPrice: price.toFixed(2),
              indexPrice: parseFloat(tickerData.indexPrice || tickerData.lastPrice || '0').toFixed(2),
              markPrice: parseFloat(tickerData.markPrice || tickerData.lastPrice || '0').toFixed(2),
              change: `${changePercent.toFixed(2)}%`,
              volume: parseFloat(tickerData.volume24h || '0').toFixed(2),
              high24h: parseFloat(tickerData.highPrice24h || '0').toFixed(2),
              low24h: parseFloat(tickerData.lowPrice24h || '0').toFixed(2),
              volumeUSDT: this.formatVolume(parseFloat(tickerData.turnover24h || '0')),
              marketType: 'perpetual',
              openInterest: this.formatVolume(parseFloat(tickerData.openInterest || '0')) + ' BTC',
              fundingRate: `${fundingRate.toFixed(4)}%`,
              nextFundingTime,
              leverage: '10x',
              bidPrice: parseFloat(orderbookData?.b?.[0]?.[0] || tickerData.bid1Price || '0').toFixed(2),
              askPrice: parseFloat(orderbookData?.a?.[0]?.[0] || tickerData.ask1Price || '0').toFixed(2),
              favorite: false
            };
            
            // Actualizar el mapa de tickers
            this.perpetualTickers.set(symbol, updatedTicker);
          } else {
            this.logger.warn(`No initial ticker data found for ${symbol}USDT`);
          }
        } catch (error) {
          this.logger.error(`Error fetching initial data for ${symbol}: ${error.message}`);
        }
      }
      
      this.logger.log('Initial perpetual market data fetched successfully');
    } catch (error) {
      this.logger.error(`Error fetching initial perpetual market data: ${error.message}`);
    }
  }

  async fetchPerpetualData(): Promise<void> {
    // Si tenemos conexión WebSocket activa, no necesitamos hacer fetch
    if (this.wsConnected) {
      return;
    }
    
    // Si no hay WebSocket, intentamos obtener datos mediante REST API
    await this.fetchInitialData();
  }

  getPerpetualTickers(): PerpetualMarketTicker[] {
    return Array.from(this.perpetualTickers.values());
  }

  getPerpetualTicker(symbol: string): PerpetualMarketTicker | undefined {
    return this.perpetualTickers.get(symbol);
  }
  
  getWebSocketStatus(): { connected: boolean, reconnectAttempts: number } {
    return {
      connected: this.wsConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
} 