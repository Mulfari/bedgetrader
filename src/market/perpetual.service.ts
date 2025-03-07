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
    // Inicializar los tickers con valores mínimos
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
        openInterest: '0 ' + symbol,
        fundingRate: '0.00%',
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
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
    try {
      this.logger.log('Initializing PerpetualMarketService...');
      
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
          openInterest: '0 ' + symbol,
          fundingRate: '0.00%',
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
          leverage: '10x',
          markPrice: '0.00',
          lastPrice: '0.00',
          bidPrice: '0.00',
          askPrice: '0.00',
          favorite: false
        });
      });
      
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
        
        // Suscribirse a los tickers y funding para obtener todos los datos necesarios
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          req_id: "perpetual_subscription",
          op: 'subscribe',
          args: [
            ...symbols.map(symbol => `tickers.${symbol}`),
            ...symbols.map(symbol => `funding.${symbol}`)
          ]
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
        this.logger.log('Subscribed to perpetual tickers and funding');
        
        // Configurar heartbeat cada 20 segundos para mantener la conexión activa
        const heartbeatInterval = setInterval(() => {
          if (this.ws && this.wsConnected) {
            const pingMsg = {
              req_id: "perpetual_heartbeat",
              op: "ping"
            };
            this.ws.send(JSON.stringify(pingMsg));
          } else {
            clearInterval(heartbeatInterval);
          }
        }, 20000);
        
        // Cargar datos iniciales después de conectar
        this.fetchInitialData()
          .then(() => {
            this.logger.log('Initial data loaded after WebSocket connection');
          })
          .catch(err => this.logger.error(`Error loading initial data: ${err.message}`));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Manejar respuesta de ping (pong)
          if (message.op === "ping" || message.ret_msg === "pong") {
            return;
          }
          
          // Manejar respuesta de suscripción
          if (message.op === "subscribe") {
            return;
          }
          
          // Ignorar mensajes que no son de datos
          if (!message.topic) return;
          
          const [msgType, ...rest] = message.topic.split('.');
          const symbolWithUsdt = rest.join('.');
          const symbol = symbolWithUsdt.replace('USDT', '');
          
          // Verificar que el símbolo sea válido
          if (!this.symbols.includes(symbol)) {
            return;
          }
          
          // Obtener el ticker existente
          const existingTicker = this.perpetualTickers.get(symbol);
          if (!existingTicker) {
            return;
          }
          
          // Procesar según el tipo de mensaje
          if (msgType === 'tickers' && message.data) {
            // Verificar si message.data es un array
            const ticker = Array.isArray(message.data) ? message.data[0] : message.data;
            
            // Verificar si ticker tiene los campos necesarios
            if (!ticker || !ticker.lastPrice) {
              return;
            }
            
            // Actualizar propiedades del ticker
            const price = parseFloat(ticker.lastPrice || existingTicker.price || '0');
            const changePercent = parseFloat(ticker.price24hPcnt || '0') * 100;
            
            // Manejar el open interest correctamente
            let openInterest = existingTicker.openInterest;
            if (ticker.openInterest) {
              const openInterestValue = parseFloat(ticker.openInterest);
              if (!isNaN(openInterestValue) && openInterestValue > 0) {
                openInterest = this.formatVolume(openInterestValue) + ' ' + symbol;
              }
            }
            
            const updatedTicker = {
              ...existingTicker,
              price: price.toFixed(2),
              lastPrice: price.toFixed(2),
              indexPrice: parseFloat(ticker.indexPrice || ticker.lastPrice || existingTicker.indexPrice || '0').toFixed(2),
              markPrice: parseFloat(ticker.markPrice || ticker.lastPrice || existingTicker.markPrice || '0').toFixed(2),
              change: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
              volume: parseFloat(ticker.volume24h || existingTicker.volume || '0').toFixed(2),
              high24h: parseFloat(ticker.highPrice24h || existingTicker.high24h || '0').toFixed(2),
              low24h: parseFloat(ticker.lowPrice24h || existingTicker.low24h || '0').toFixed(2),
              volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h || '0')),
              openInterest,
              bidPrice: parseFloat(ticker.bid1Price || existingTicker.bidPrice || '0').toFixed(2),
              askPrice: parseFloat(ticker.ask1Price || existingTicker.askPrice || '0').toFixed(2)
            };
            
            // Actualizar el ticker en el mapa
            this.perpetualTickers.set(symbol, updatedTicker);
          } else if (msgType === 'funding' && message.data) {
            // Verificar si message.data es un array
            const funding = Array.isArray(message.data) ? message.data[0] : message.data;
            
            // Verificar si funding tiene los campos necesarios
            if (!funding) {
              return;
            }
            
            // Manejar el funding rate correctamente
            let fundingRate = existingTicker.fundingRate;
            if (funding.fundingRate) {
              const fundingRateValue = parseFloat(funding.fundingRate);
              if (!isNaN(fundingRateValue)) {
                fundingRate = `${(fundingRateValue * 100).toFixed(4)}%`;
              }
            }
            
            // Manejar el nextFundingTime correctamente
            let nextFundingTime = existingTicker.nextFundingTime;
            if (funding.nextFundingTime) {
              const nextFundingTimeValue = new Date(funding.nextFundingTime).getTime();
              if (!isNaN(nextFundingTimeValue) && nextFundingTimeValue > Date.now()) {
                nextFundingTime = nextFundingTimeValue;
              }
            }
            
            const updatedTicker = {
              ...existingTicker,
              fundingRate,
              nextFundingTime
            };
            
            // Actualizar el ticker en el mapa
            this.perpetualTickers.set(symbol, updatedTicker);
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
      try {
        // Enviar mensaje de unsubscribe antes de cerrar
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const unsubscribeMsg = {
          req_id: "perpetual_unsubscription",
          op: 'unsubscribe',
          args: symbols.map(symbol => `tickers.${symbol}`)
        };
        
        this.ws.send(JSON.stringify(unsubscribeMsg));
        this.logger.log('Sent unsubscribe message before closing WebSocket');
      } catch (error) {
        this.logger.error(`Error sending unsubscribe message: ${error.message}`);
      }
      
      // Cerrar la conexión
      this.ws.terminate();
      this.ws = null;
      this.wsConnected = false;
      this.logger.log('WebSocket connection closed');
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
      
      // Obtener todos los tickers en una sola llamada
      const allTickersResponse = await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: {
          category: 'linear'
        }
      });
      
      // Verificar si la respuesta es válida
      if (allTickersResponse.data?.retCode !== 0) {
        this.logger.error(`Error from Bybit API: ${allTickersResponse.data?.retMsg || 'Unknown error'}`);
        return;
      }
      
      if (allTickersResponse.data?.result?.list && Array.isArray(allTickersResponse.data.result.list)) {
        const allTickers = allTickersResponse.data.result.list;
        
        // Procesar cada símbolo
        for (const symbol of this.symbols) {
          try {
            // Buscar el ticker correspondiente
            const ticker = allTickers.find(t => t.symbol === `${symbol}USDT`);
            
            if (ticker) {
              // Obtener datos de funding
              const fundingResponse = await axios.get('https://api.bybit.com/v5/market/funding/history', {
                params: {
                  category: 'linear',
                  symbol: `${symbol}USDT`,
                  limit: 1
                }
              });
              
              const funding = fundingResponse.data?.result?.list?.[0] || {};
              
              // Formatear los datos
              const price = parseFloat(ticker.lastPrice || '0');
              const changePercent = parseFloat(ticker.price24hPcnt || '0') * 100;
              
              // Manejar el funding rate correctamente
              let fundingRate = '0.0000%';
              if (funding && funding.fundingRate) {
                const fundingRateValue = parseFloat(funding.fundingRate);
                fundingRate = `${(fundingRateValue * 100).toFixed(4)}%`;
              }
              
              // Calcular próximo tiempo de funding (cada 8 horas: 00:00, 08:00, 16:00 UTC)
              let nextFundingTime = Date.now() + 8 * 60 * 60 * 1000; // valor por defecto: 8 horas desde ahora
              
              // Si tenemos datos de funding, usar esos datos
              if (funding && funding.nextFundingTime) {
                nextFundingTime = new Date(funding.nextFundingTime).getTime();
              } else {
                // Calcular basado en el horario de Bybit (00:00, 08:00, 16:00 UTC)
                const now = new Date();
                const hours = now.getUTCHours();
                let nextFundingHour;
                
                if (hours < 8) {
                  nextFundingHour = 8;
                } else if (hours < 16) {
                  nextFundingHour = 16;
                } else {
                  nextFundingHour = 24; // 00:00 del día siguiente
                }
                
                nextFundingTime = new Date(Date.UTC(
                  now.getUTCFullYear(),
                  now.getUTCMonth(),
                  now.getUTCDate() + (nextFundingHour === 24 ? 1 : 0),
                  nextFundingHour === 24 ? 0 : nextFundingHour,
                  0,
                  0
                )).getTime();
              }
              
              // Manejar el open interest correctamente
              let openInterest = '0 ' + symbol;
              if (ticker.openInterest) {
                const openInterestValue = parseFloat(ticker.openInterest);
                if (!isNaN(openInterestValue) && openInterestValue > 0) {
                  openInterest = this.formatVolume(openInterestValue) + ' ' + symbol;
                }
              }
              
              // Crear objeto ticker con todos los datos
              const updatedTicker: PerpetualMarketTicker = {
                symbol,
                price: price.toFixed(2),
                lastPrice: price.toFixed(2),
                indexPrice: parseFloat(ticker.indexPrice || ticker.lastPrice || '0').toFixed(2),
                markPrice: parseFloat(ticker.markPrice || ticker.lastPrice || '0').toFixed(2),
                change: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                volume: parseFloat(ticker.volume24h || '0').toFixed(2),
                high24h: parseFloat(ticker.highPrice24h || '0').toFixed(2),
                low24h: parseFloat(ticker.lowPrice24h || '0').toFixed(2),
                volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h || '0')),
                marketType: 'perpetual',
                openInterest,
                fundingRate,
                nextFundingTime,
                leverage: '10x',
                bidPrice: parseFloat(ticker.bid1Price || '0').toFixed(2),
                askPrice: parseFloat(ticker.ask1Price || '0').toFixed(2),
                favorite: false
              };
              
              // Actualizar el ticker en el mapa
              this.perpetualTickers.set(symbol, updatedTicker);
            } else {
              this.logger.warn(`No ticker found for ${symbol}USDT in the response`);
            }
          } catch (error) {
            this.logger.error(`Error processing data for ${symbol}: ${error.message}`);
          }
        }
      } else {
        this.logger.error('Invalid response format from Bybit API');
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