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
  private fundingUpdateInterval: NodeJS.Timeout | null = null;

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
      
      // Configurar actualización periódica del funding rate (cada 5 minutos)
      this.fundingUpdateInterval = setInterval(() => {
        this.logger.log('Actualizando datos de funding rate...');
        this.updateFundingRates()
          .then(() => {
            this.logger.log('Funding rates updated successfully');
          })
          .catch(error => {
            this.logger.error(`Error in funding rate update interval: ${error.message}`);
          });
      }, 5 * 60 * 1000); // Actualizar cada 5 minutos
      
      this.logger.log('PerpetualMarketService initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing PerpetualMarketService: ${error.message}`);
    }
  }

  onModuleDestroy() {
    this.closeWebSocket();
    
    // Limpiar el intervalo de actualización del funding rate
    if (this.fundingUpdateInterval) {
      clearInterval(this.fundingUpdateInterval);
      this.fundingUpdateInterval = null;
      this.logger.log('Funding rate update interval cleared');
    }
  }

  private connectWebSocket() {
    try {
      this.logger.log('Connecting to Bybit WebSocket for perpetual markets...');
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log('WebSocket connection established for perpetual markets');
        
        // Suscribirse solo a los tickers para simplificar
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          req_id: "perpetual_subscription",
          op: 'subscribe',
          args: symbols.map(symbol => `tickers.${symbol}`)
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
        this.logger.log(`Subscribed to perpetual tickers: ${JSON.stringify(subscribeMsg)}`);
        
        // Configurar heartbeat cada 20 segundos para mantener la conexión activa
        const heartbeatInterval = setInterval(() => {
          if (this.ws && this.wsConnected) {
            const pingMsg = {
              req_id: "perpetual_heartbeat",
              op: "ping"
            };
            this.ws.send(JSON.stringify(pingMsg));
            this.logger.debug("Sent heartbeat ping to WebSocket");
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
            this.logger.debug(`Received pong: ${JSON.stringify(message)}`);
            return;
          }
          
          // Manejar respuesta de suscripción
          if (message.op === "subscribe") {
            this.logger.log(`Subscription response: ${JSON.stringify(message)}`);
            return;
          }
          
          // Imprimir el mensaje completo para diagnóstico
          this.logger.log(`Received WebSocket message: ${JSON.stringify(message)}`);
          
          // Ignorar mensajes que no son de datos
          if (!message.topic) return;
          
          // Imprimir el topic para diagnóstico
          this.logger.log(`Message topic: ${message.topic}`);
          
          const [msgType, ...rest] = message.topic.split('.');
          const symbolWithUsdt = rest.join('.');
          const symbol = symbolWithUsdt.replace('USDT', '');
          
          this.logger.log(`Extracted symbol: ${symbol} from ${symbolWithUsdt}`);
          
          // Verificar que el símbolo sea válido
          if (!this.symbols.includes(symbol)) {
            this.logger.warn(`Received message for unknown symbol: ${symbolWithUsdt}, extracted: ${symbol}`);
            return;
          }
          
          // Obtener el ticker existente
          const existingTicker = this.perpetualTickers.get(symbol);
          if (!existingTicker) {
            this.logger.warn(`No existing ticker found for ${symbol}`);
            return;
          }
          
          // Procesar según el tipo de mensaje
          if (msgType === 'tickers' && message.data) {
            // Verificar si message.data es un array
            const ticker = Array.isArray(message.data) ? message.data[0] : message.data;
            this.logger.log(`Ticker data for ${symbol}: ${JSON.stringify(ticker)}`);
            
            // Verificar si ticker tiene los campos necesarios
            if (!ticker || !ticker.lastPrice) {
              this.logger.warn(`Invalid ticker data for ${symbol}: ${JSON.stringify(ticker)}`);
              return;
            }
            
            // Imprimir específicamente el openInterest
            if (ticker.openInterest) {
              this.logger.log(`${symbol} WebSocket openInterest: ${ticker.openInterest} (type: ${typeof ticker.openInterest})`);
            } else {
              this.logger.warn(`${symbol} WebSocket ticker does not have openInterest property`);
            }
            
            // Actualizar propiedades del ticker
            const price = parseFloat(ticker.lastPrice || existingTicker.price || '0');
            const changePercent = parseFloat(ticker.price24hPcnt || '0') * 100;
            
            // Procesar el openInterest correctamente
            let formattedOpenInterest = existingTicker.openInterest;
            if (ticker.openInterest) {
              const openInterestValue = parseFloat(ticker.openInterest);
              if (!isNaN(openInterestValue) && openInterestValue > 0) {
                formattedOpenInterest = this.formatVolume(openInterestValue) + ' ' + symbol;
              } else {
                // Si no podemos parsear el valor, mantenemos el valor existente
                formattedOpenInterest = existingTicker.openInterest;
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
              openInterest: formattedOpenInterest,
              bidPrice: parseFloat(ticker.bid1Price || existingTicker.bidPrice || '0').toFixed(2),
              askPrice: parseFloat(ticker.ask1Price || existingTicker.askPrice || '0').toFixed(2),
              // Mantener los valores de funding que no vienen en el WebSocket
              fundingRate: existingTicker.fundingRate,
              nextFundingTime: existingTicker.nextFundingTime
            };
            
            // Actualizar el ticker en el mapa
            this.perpetualTickers.set(symbol, updatedTicker);
            this.logger.log(`Updated ticker for ${symbol} from WebSocket: price=${updatedTicker.price}, openInterest=${updatedTicker.openInterest}`);
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
      this.logger.log('Fetching initial perpetual market data from Bybit API...');
      
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
      
      // Imprimir la estructura de la respuesta para diagnóstico
      if (allTickersResponse.data?.result) {
        this.logger.log(`Response structure: ${JSON.stringify({
          retCode: allTickersResponse.data.retCode,
          retMsg: allTickersResponse.data.retMsg,
          result: {
            category: allTickersResponse.data.result.category,
            list: Array.isArray(allTickersResponse.data.result.list) 
              ? `Array with ${allTickersResponse.data.result.list.length} items` 
              : typeof allTickersResponse.data.result.list
          }
        })}`);
        
        // Imprimir el primer ticker para diagnóstico
        if (Array.isArray(allTickersResponse.data.result.list) && allTickersResponse.data.result.list.length > 0) {
          const sampleTicker = allTickersResponse.data.result.list[0];
          this.logger.log(`Sample ticker: ${JSON.stringify(sampleTicker)}`);
          
          // Imprimir específicamente el openInterest
          if (sampleTicker.openInterest) {
            this.logger.log(`Sample openInterest: ${sampleTicker.openInterest} (type: ${typeof sampleTicker.openInterest})`);
          } else {
            this.logger.warn('Sample ticker does not have openInterest property');
          }
        }
      }
      
      if (allTickersResponse.data?.result?.list && Array.isArray(allTickersResponse.data.result.list)) {
        const allTickers = allTickersResponse.data.result.list;
        
        // Procesar cada símbolo
        for (const symbol of this.symbols) {
          try {
            // Buscar el ticker correspondiente
            const ticker = allTickers.find(t => t.symbol === `${symbol}USDT`);
            
            if (ticker) {
              this.logger.log(`Found ticker for ${symbol}: ${JSON.stringify(ticker)}`);
              
              // Imprimir específicamente el openInterest
              if (ticker.openInterest) {
                this.logger.log(`${symbol} openInterest: ${ticker.openInterest} (type: ${typeof ticker.openInterest})`);
              } else {
                this.logger.warn(`${symbol} ticker does not have openInterest property`);
              }
              
              // Formatear los datos
              const price = parseFloat(ticker.lastPrice || '0');
              const changePercent = parseFloat(ticker.price24hPcnt || '0') * 100;
              
              // Procesar el openInterest correctamente
              let formattedOpenInterest = '0 ' + symbol;
              if (ticker.openInterest) {
                const openInterestValue = parseFloat(ticker.openInterest);
                if (!isNaN(openInterestValue) && openInterestValue > 0) {
                  formattedOpenInterest = this.formatVolume(openInterestValue) + ' ' + symbol;
                } else {
                  // Si no podemos parsear el valor, usamos el valor original
                  formattedOpenInterest = ticker.openInterest + ' ' + symbol;
                }
              }
              
              // Crear objeto ticker con todos los datos excepto funding rate
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
                openInterest: formattedOpenInterest,
                fundingRate: '0.00%', // Valor temporal, se actualizará después
                nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // Valor temporal, se actualizará después
                leverage: '10x',
                bidPrice: parseFloat(ticker.bid1Price || '0').toFixed(2),
                askPrice: parseFloat(ticker.ask1Price || '0').toFixed(2),
                favorite: false
              };
              
              // Actualizar el ticker en el mapa
              this.perpetualTickers.set(symbol, updatedTicker);
              
              // Imprimir el ticker actualizado para diagnóstico
              this.logger.log(`Updated ticker for ${symbol}: price=${updatedTicker.price}, openInterest=${updatedTicker.openInterest}`);
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
      
      // Actualizar los funding rates después de procesar los tickers básicos
      await this.updateFundingRates();
      
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

  // Método para actualizar los funding rates de todos los símbolos
  async updateFundingRates(): Promise<void> {
    // Para cada símbolo, actualizar solo el funding rate
    for (const symbol of this.symbols) {
      try {
        // Obtener datos de funding
        const fundingResponse = await axios.get('https://api.bybit.com/v5/market/funding/history', {
          params: {
            category: 'linear',
            symbol: `${symbol}USDT`,
            limit: 1
          }
        });
        
        // Verificar si la respuesta de funding es válida
        if (fundingResponse.data?.retCode !== 0) {
          this.logger.error(`Error from Bybit API (funding): ${fundingResponse.data?.retMsg || 'Unknown error'}`);
          continue;
        }
        
        const funding = fundingResponse.data?.result?.list?.[0] || {};
        const fundingRate = parseFloat(funding.fundingRate || '0') * 100;
        
        // Asegurar que se guarda correctamente
        this.logger.log(`Funding rate for ${symbol}: ${funding.fundingRate} -> Formatted: ${fundingRate.toFixed(4)}%`);
        
        // Usar el timestamp proporcionado por la API si está disponible
        let nextFundingTime: number;
        if (funding.fundingRateTimestamp) {
          nextFundingTime = Number(funding.fundingRateTimestamp);
          this.logger.log(`Using API timestamp for next funding: ${new Date(nextFundingTime).toISOString()}`);
        } else {
          // Calcular próximo tiempo de funding (cada 8 horas: 00:00, 08:00, 16:00 UTC)
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
          this.logger.log(`Calculated next funding time: ${new Date(nextFundingTime).toISOString()}`);
        }
        
        // Obtener el ticker existente
        const existingTicker = this.perpetualTickers.get(symbol);
        if (existingTicker) {
          // Actualizar solo el funding rate y nextFundingTime
          const updatedTicker = {
            ...existingTicker,
            fundingRate: `${fundingRate.toFixed(4)}%`,
            nextFundingTime
          };
          
          this.perpetualTickers.set(symbol, updatedTicker);
          this.logger.log(`Updated funding rate for ${symbol}: ${fundingRate.toFixed(4)}%`);
        }
      } catch (error) {
        this.logger.error(`Error updating funding rate for ${symbol}: ${error.message}`);
      }
    }
  }
}