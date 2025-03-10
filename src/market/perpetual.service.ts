import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PerpetualMarketTicker } from './interfaces/market.interface';
import axios from 'axios';
import WebSocket from 'ws';

@Injectable()
export class PerpetualMarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PerpetualMarketService.name);
  private perpetualTickers: Map<string, PerpetualMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK'];
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private orderbookUpdateInterval: NodeJS.Timeout | null = null;

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
      
      // Obtener datos iniciales mediante REST API
      try {
        await this.fetchInitialData();
        
        // Verificar si hay tickers con valores en 0 después de la carga inicial
        const hasZeroValues = Array.from(this.perpetualTickers.values()).some(ticker => 
          ticker.price === '0.00' || ticker.price === '0'
        );
        
        if (hasZeroValues) {
          this.logger.debug('Some perpetual tickers have zero values after initial data fetch');
          // No intentamos obtener datos nuevamente, confiaremos en WebSocket
        }
      } catch (error) {
        // Si hay un error al obtener datos iniciales, continuamos con WebSocket
        this.logger.debug(`Could not fetch initial data via REST API: ${error.message}. Will rely on WebSocket data.`);
      }
      
      // Iniciar conexión WebSocket
      this.connectWebSocket();
      
      // Iniciar actualización periódica de los precios de compra/venta
      this.startOrderbookUpdates();
    } catch (error) {
      this.logger.error(`Error initializing PerpetualMarketService: ${error.message}`);
    }
  }

  onModuleDestroy() {
    this.closeWebSocket();
    
    // Limpiar el intervalo de actualización de orderbook
    if (this.orderbookUpdateInterval) {
      clearInterval(this.orderbookUpdateInterval);
      this.orderbookUpdateInterval = null;
    }
  }

  private connectWebSocket() {
    try {
      this.logger.log('Connecting to Bybit WebSocket...');
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      this.ws.on('open', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log('WebSocket connection established');
        
        // Suscribirse a los tickers de futuros perpetuos
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          op: 'subscribe',
          args: [
            ...symbols.map(symbol => `tickers.${symbol}`),
            ...symbols.map(symbol => `orderbook.1.${symbol}`)
          ]
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
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
              // Actualizar el ticker
              const existingTicker = this.perpetualTickers.get(symbol);
              if (existingTicker) {
                // Verificar que los campos necesarios existan
                if (ticker.lastPrice) {
                  const price = parseFloat(ticker.lastPrice);
                  const changePercent = ticker.price24hPcnt ? parseFloat(ticker.price24hPcnt) * 100 : 0;
                  
                  // Actualizar el ticker con los nuevos datos
                  this.perpetualTickers.set(symbol, {
                    ...existingTicker,
                    price: price.toFixed(2),
                    lastPrice: price.toFixed(2),
                    markPrice: ticker.markPrice ? parseFloat(ticker.markPrice).toFixed(2) : existingTicker.markPrice,
                    indexPrice: ticker.indexPrice ? parseFloat(ticker.indexPrice).toFixed(2) : existingTicker.indexPrice,
                    change: `${changePercent.toFixed(2)}%`,
                    volume: ticker.volume24h ? parseFloat(ticker.volume24h).toFixed(2) : existingTicker.volume,
                    high24h: ticker.highPrice24h ? parseFloat(ticker.highPrice24h).toFixed(2) : existingTicker.high24h,
                    low24h: ticker.lowPrice24h ? parseFloat(ticker.lowPrice24h).toFixed(2) : existingTicker.low24h,
                    volumeUSDT: ticker.turnover24h ? this.formatVolume(parseFloat(ticker.turnover24h)) : existingTicker.volumeUSDT,
                    openInterest: ticker.openInterest ? `${parseFloat(ticker.openInterest).toFixed(2)} ${symbol}` : existingTicker.openInterest,
                    fundingRate: ticker.fundingRate ? `${(parseFloat(ticker.fundingRate) * 100).toFixed(4)}%` : existingTicker.fundingRate,
                    nextFundingTime: ticker.nextFundingTime || existingTicker.nextFundingTime,
                    bidPrice: ticker.bid1Price ? parseFloat(ticker.bid1Price).toFixed(2) : existingTicker.bidPrice,
                    askPrice: ticker.ask1Price ? parseFloat(ticker.ask1Price).toFixed(2) : existingTicker.askPrice
                  });
                }
              }
            }
          }
          
          // Procesar datos de orderbook
          if (message.topic && message.topic.startsWith('orderbook.') && message.data) {
            const orderbook = message.data;
            const parts = message.topic.split('.');
            if (parts.length >= 3) {
              const symbolWithUsdt = parts[2];
              const symbol = symbolWithUsdt.replace('USDT', '');
              
              if (this.symbols.includes(symbol)) {
                // Actualizar el ticker con los mejores precios
                const existingTicker = this.perpetualTickers.get(symbol);
                if (existingTicker && orderbook.b && orderbook.b.length > 0 && orderbook.a && orderbook.a.length > 0) {
                  const bidPrice = parseFloat(orderbook.b[0][0]).toFixed(2);
                  const askPrice = parseFloat(orderbook.a[0][0]).toFixed(2);
                  
                  this.perpetualTickers.set(symbol, {
                    ...existingTicker,
                    bidPrice,
                    askPrice
                  });
                }
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
      try {
        // Enviar mensaje de unsubscribe antes de cerrar
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const unsubscribeMsg = {
          req_id: "perpetual_unsubscription",
          op: 'unsubscribe',
          args: symbols.map(symbol => `tickers.${symbol}`)
        };
        
        this.ws.send(JSON.stringify(unsubscribeMsg));
      } catch (error) {
        this.logger.error(`Error sending unsubscribe message: ${error.message}`);
      }
      
      // Cerrar la conexión
      this.ws.terminate();
      this.ws = null;
      this.wsConnected = false;
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
      // Reducir nivel de log a debug
      this.logger.debug('Fetching initial perpetual market data...');
      
      // Verificar conectividad a la API primero
      try {
        // Hacer una solicitud de prueba para verificar si la API está accesible
        await axios.get('https://api.bybit.com/v5/market/tickers', {
          params: { category: 'linear', symbol: 'BTCUSDT' },
          timeout: 5000
        });
      } catch (error) {
        // Si hay un error 403, es probable que todas las solicitudes fallen
        if (error.response && error.response.status === 403) {
          this.logger.warn(`API access forbidden (403). Will rely on WebSocket data.`);
          // No intentar más solicitudes HTTP si hay un error 403
          throw new Error('API access forbidden (403)');
        }
      }
      
      // Contador de símbolos con datos válidos
      let validDataCount = 0;
      
      // Procesar cada símbolo
      for (const symbol of this.symbols) {
        try {
          // Intentar obtener datos para este símbolo
          await this.fetchSymbolData(symbol);
          validDataCount++;
        } catch (error) {
          // Solo registrar el error una vez por símbolo, no por cada intento
          if (!error.message.includes('after 3 attempts')) {
            this.logger.debug(`Error processing ${symbol}USDT: ${error.message}`);
          }
        }
      }
      
      this.logger.debug(`Initial perpetual market data fetched successfully for ${validDataCount}/${this.symbols.length} symbols`);
      
      // Si no se obtuvieron datos válidos para ningún símbolo, lanzar un error
      if (validDataCount === 0) {
        this.logger.warn('No valid data obtained for any symbol. Will rely on WebSocket data.');
      }
    } catch (error) {
      // Reducir nivel de log a debug para errores comunes
      if (error.message === 'API access forbidden (403)') {
        this.logger.debug(`Error fetching initial perpetual market data: ${error.message}`);
      } else {
        this.logger.error(`Error fetching initial perpetual market data: ${error.message}`);
      }
    }
  }
  
  // Método auxiliar para obtener datos de un símbolo específico
  private async fetchSymbolData(symbol: string): Promise<void> {
    // Intentar hasta 3 veces si hay errores
    let attempts = 0;
    let success = false;
    let lastError = null;
    
    while (attempts < 3 && !success) {
      try {
        // Obtener datos del ticker
        const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
          params: {
            category: 'linear',
            symbol: `${symbol}USDT`
          },
          timeout: 5000 // Timeout de 5 segundos
        });
        
        if (!tickerResponse.data?.result?.list?.[0]) {
          attempts++;
          lastError = new Error(`No ticker data found for ${symbol}USDT`);
          // Esperar antes de reintentar
          if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        const ticker = tickerResponse.data.result.list[0];
        
        // Obtener datos de funding
        let fundingRate = 0;
        try {
          const fundingResponse = await axios.get(`https://api.bybit.com/v5/market/funding/history`, {
            params: {
              category: 'linear',
              symbol: `${symbol}USDT`,
              limit: 1
            },
            timeout: 5000
          });
          
          fundingRate = fundingResponse.data?.result?.list?.[0]?.fundingRate 
            ? parseFloat(fundingResponse.data.result.list[0].fundingRate) * 100 
            : 0;
        } catch (fundingError) {
          // Si falla la obtención de funding, continuar con el resto de datos
          this.logger.debug(`Could not fetch funding data for ${symbol}USDT: ${fundingError.message}`);
        }
        
        // Obtener datos del orderbook
        let bidPrice = '0.00';
        let askPrice = '0.00';
        try {
          const orderbookResponse = await axios.get(`https://api.bybit.com/v5/market/orderbook`, {
            params: {
              category: 'linear',
              symbol: `${symbol}USDT`,
              limit: 1
            },
            timeout: 5000
          });
          
          if (orderbookResponse.data?.result?.b?.[0]?.[0]) {
            bidPrice = this.formatPrice(parseFloat(orderbookResponse.data.result.b[0][0]));
          }
          
          if (orderbookResponse.data?.result?.a?.[0]?.[0]) {
            askPrice = this.formatPrice(parseFloat(orderbookResponse.data.result.a[0][0]));
          }
        } catch (orderbookError) {
          // Si falla la obtención del orderbook, usar precios aproximados
          this.logger.debug(`Could not fetch orderbook for ${symbol}USDT: ${orderbookError.message}`);
          const price = parseFloat(ticker.lastPrice);
          bidPrice = this.formatPrice(price * 0.999);
          askPrice = this.formatPrice(price * 1.001);
        }
        
        // Formatear los datos
        const price = parseFloat(ticker.lastPrice);
        const changePercent = parseFloat(ticker.price24hPcnt) * 100;
        
        // Verificar que el precio sea válido
        if (isNaN(price) || price <= 0) {
          attempts++;
          lastError = new Error(`Invalid price for ${symbol}USDT: ${price}`);
          // Esperar antes de reintentar
          if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Actualizar el ticker
        this.perpetualTickers.set(symbol, {
          symbol,
          price: price.toFixed(2),
          lastPrice: price.toFixed(2),
          markPrice: ticker.markPrice ? parseFloat(ticker.markPrice).toFixed(2) : '0.00',
          indexPrice: ticker.indexPrice ? parseFloat(ticker.indexPrice).toFixed(2) : '0.00',
          change: `${changePercent.toFixed(2)}%`,
          volume: ticker.volume24h ? parseFloat(ticker.volume24h).toFixed(2) : '0',
          high24h: ticker.highPrice24h ? parseFloat(ticker.highPrice24h).toFixed(2) : '0.00',
          low24h: ticker.lowPrice24h ? parseFloat(ticker.lowPrice24h).toFixed(2) : '0.00',
          volumeUSDT: ticker.turnover24h ? this.formatVolume(parseFloat(ticker.turnover24h)) : '0',
          marketType: 'perpetual',
          openInterest: ticker.openInterest ? `${parseFloat(ticker.openInterest).toFixed(2)} ${symbol}` : `0 ${symbol}`,
          fundingRate: `${fundingRate.toFixed(4)}%`,
          nextFundingTime: ticker.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000,
          leverage: '10x',
          bidPrice,
          askPrice,
          favorite: false
        });
        
        success = true;
      } catch (error) {
        // Solo registrar el primer intento para reducir logs
        if (attempts === 0) {
          this.logger.debug(`Error fetching data for ${symbol}USDT (attempt ${attempts + 1}): ${error.message}`);
        }
        attempts++;
        // Esperar un poco antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!success) {
      throw new Error(`Failed to fetch data for ${symbol}USDT after ${attempts} attempts`);
    }
  }

  async fetchPerpetualData(): Promise<void> {
    // Verificar si hay tickers con valores en 0
    const hasZeroValues = Array.from(this.perpetualTickers.values()).some(ticker => 
      ticker.price === '0.00' || ticker.price === '0'
    );
    
    // Si tenemos conexión WebSocket activa y no hay valores en 0, no necesitamos hacer fetch
    if (this.wsConnected && !hasZeroValues) {
      return;
    }
    
    // Verificar si la API está accesible antes de intentar obtener datos
    try {
      // Hacer una solicitud de prueba para verificar si la API está accesible
      await axios.get('https://api.bybit.com/v5/market/tickers', {
        params: { category: 'linear', symbol: 'BTCUSDT' },
        timeout: 5000
      });
    } catch (error) {
      // Si hay un error 403, no intentar obtener datos mediante REST API
      if (error.response && error.response.status === 403) {
        this.logger.warn('API access forbidden (403). Cannot fetch data via REST API. Will rely on WebSocket data.');
        return;
      }
    }
    
    // Si no hay WebSocket o hay valores en 0, intentamos obtener datos mediante REST API
    this.logger.warn('WebSocket not connected or zero values detected, fetching data via REST API...');
    
    try {
      await this.fetchInitialData();
    } catch (error) {
      // No necesitamos registrar el error aquí ya que fetchInitialData ya lo hace
    }
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

  private startOrderbookUpdates(): void {
    // Actualizar los precios de compra/venta cada 30 segundos
    this.orderbookUpdateInterval = setInterval(() => {
      // Solo actualizar si la conexión WebSocket no está activa
      if (!this.wsConnected) {
        this.updateOrderbookPrices().catch(error => {
          // No registrar errores de conectividad o 403
          if (!error.message.includes('ECONNREFUSED') && 
              !error.message.includes('timeout') && 
              (!error.response || error.response.status !== 403)) {
            this.logger.warn(`Error in orderbook update interval: ${error.message}`);
          }
        });
      }
    }, 30000); // 30 segundos
  }
  
  private async updateOrderbookPrices(): Promise<void> {
    // Si no hay conexión WebSocket, no intentar actualizar los precios
    if (!this.wsConnected) {
      // Actualizar los precios de compra/venta para los símbolos más populares
      const popularSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK'];
      
      for (const symbol of popularSymbols) {
        try {
          const { bidPrice, askPrice } = await this.fetchOrderbook(symbol);
          
          // Actualizar el ticker si los precios son válidos
          if (bidPrice !== '0.00' && askPrice !== '0.00') {
            const existingTicker = this.perpetualTickers.get(symbol);
            if (existingTicker) {
              this.perpetualTickers.set(symbol, {
                ...existingTicker,
                bidPrice,
                askPrice
              });
            }
          }
        } catch (error) {
          // No registrar errores de conectividad o 403
          if (!error.message.includes('ECONNREFUSED') && 
              !error.message.includes('timeout') && 
              (!error.response || error.response.status !== 403)) {
            this.logger.warn(`Error updating orderbook prices for ${symbol}: ${error.message}`);
          }
        }
      }
    }
  }
  
  private async fetchOrderbook(symbol: string): Promise<{ bidPrice: string, askPrice: string }> {
    try {
      // Verificar si ya tenemos un precio válido para este símbolo
      const existingTicker = this.perpetualTickers.get(symbol);
      if (existingTicker && existingTicker.price !== '0.00' && existingTicker.price !== '0') {
        // Si ya tenemos un precio válido, usar valores aproximados en lugar de hacer una solicitud
        const price = parseFloat(existingTicker.price);
        return {
          bidPrice: this.formatPrice(price * 0.999), // 0.1% menos que el precio actual
          askPrice: this.formatPrice(price * 1.001)  // 0.1% más que el precio actual
        };
      }
      
      const orderbookResponse = await axios.get(`https://api.bybit.com/v5/market/orderbook`, {
        params: {
          category: 'linear',
          symbol: `${symbol}USDT`,
          limit: 1
        },
        timeout: 3000 // Timeout de 3 segundos
      });
      
      let bidPrice = '0.00';
      let askPrice = '0.00';
      
      if (orderbookResponse.data?.result?.b?.[0]?.[0]) {
        bidPrice = this.formatPrice(parseFloat(orderbookResponse.data.result.b[0][0]));
      }
      
      if (orderbookResponse.data?.result?.a?.[0]?.[0]) {
        askPrice = this.formatPrice(parseFloat(orderbookResponse.data.result.a[0][0]));
      }
      
      return { bidPrice, askPrice };
    } catch (error) {
      // Solo registrar errores que no sean 403
      if (!error.response || error.response.status !== 403) {
        this.logger.warn(`Error fetching orderbook for ${symbol}USDT: ${error.message}`);
      }
      
      // Si tenemos un precio existente, usar valores aproximados
      const existingTicker = this.perpetualTickers.get(symbol);
      if (existingTicker && existingTicker.price !== '0.00' && existingTicker.price !== '0') {
        const price = parseFloat(existingTicker.price);
        return {
          bidPrice: this.formatPrice(price * 0.999), // 0.1% menos que el precio actual
          askPrice: this.formatPrice(price * 1.001)  // 0.1% más que el precio actual
        };
      }
      
      // Devolver valores por defecto
      return { bidPrice: '0.00', askPrice: '0.00' };
    }
  }

  private formatPrice(price: number): string {
    if (isNaN(price) || price === 0) return '0.00';
    
    if (price < 0.0001) {
      return price.toFixed(8);
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
}