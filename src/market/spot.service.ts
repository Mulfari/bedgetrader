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
  private orderbookUpdateInterval: NodeJS.Timeout | null = null;

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
      
      let apiAccessible = true;
      try {
        await this.fetchInitialData();
      } catch (error) {
        // Si hay un error al obtener datos iniciales, marcar la API como inaccesible
        apiAccessible = false;
      }
      
      // Verificar si hay tickers con valores en 0 después de la carga inicial
      const hasZeroValues = Array.from(this.spotTickers.values()).some(ticker => 
        ticker.price === '0.00' || ticker.price === '0'
      );
      
      // Solo intentar obtener datos nuevamente si la API es accesible y hay valores en cero
      if (hasZeroValues && apiAccessible) {
        this.logger.warn('Some tickers have zero values after initial data fetch');
        // Intentar obtener datos nuevamente
        await this.fetchInitialData();
      }
      
      // Iniciar conexión WebSocket
      this.connectWebSocket();
      
      // Iniciar actualización periódica de los precios de compra/venta
      this.startOrderbookUpdates();
    } catch (error) {
      this.logger.error(`Error initializing SpotMarketService: ${error.message}`);
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
              const existingTicker = this.spotTickers.get(symbol);
              if (existingTicker) {
                // Verificar que los campos necesarios existan y sean válidos
                if (ticker.lastPrice && !isNaN(parseFloat(ticker.lastPrice))) {
                  const price = parseFloat(ticker.lastPrice);
                  const changePercent = ticker.price24hPcnt ? parseFloat(ticker.price24hPcnt) * 100 : 0;
                  
                  // Crear un nuevo objeto con los datos actualizados
                  const updatedTicker: SpotMarketTicker = {
                    ...existingTicker,
                    price: this.formatPrice(price),
                    indexPrice: ticker.usdIndexPrice ? this.formatPrice(parseFloat(ticker.usdIndexPrice)) : this.formatPrice(price),
                    change: `${changePercent.toFixed(2)}%`,
                    volume: ticker.volume24h ? this.formatVolume(parseFloat(ticker.volume24h)) : existingTicker.volume,
                    high24h: ticker.highPrice24h ? this.formatPrice(parseFloat(ticker.highPrice24h)) : existingTicker.high24h,
                    low24h: ticker.lowPrice24h ? this.formatPrice(parseFloat(ticker.lowPrice24h)) : existingTicker.low24h,
                    volumeUSDT: ticker.turnover24h ? this.formatVolume(parseFloat(ticker.turnover24h)) : existingTicker.volumeUSDT,
                    marketType: 'spot',
                    // Mantener los valores existentes para bidPrice y askPrice si no están en el mensaje
                    bidPrice: existingTicker.bidPrice,
                    askPrice: existingTicker.askPrice,
                    favorite: existingTicker.favorite
                  };
                  
                  // Actualizar el ticker en el mapa
                  this.spotTickers.set(symbol, updatedTicker);
                } else {
                  this.logger.warn(`Invalid lastPrice in ticker update for ${symbol}: ${ticker.lastPrice}`);
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
      // Eliminar log de advertencia para valores inválidos
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
      this.logger.log('Fetching initial spot market data...');
      
      // Verificar conectividad a la API primero
      try {
        // Hacer una solicitud de prueba para verificar si la API está accesible
        await axios.get('https://api.bybit.com/v5/market/tickers', {
          params: { category: 'spot', symbol: 'BTCUSDT' },
          timeout: 5000
        });
      } catch (error) {
        // Si hay un error 403, es probable que todas las solicitudes fallen
        if (error.response && error.response.status === 403) {
          this.logger.error(`API access forbidden (403). Posible IP restriction or rate limiting. Will rely on WebSocket data.`);
          // No intentar más solicitudes HTTP si hay un error 403
          return;
        }
      }
      
      // Contador de símbolos con datos válidos
      let validDataCount = 0;
      
      // Obtener datos de la API de Bybit para cada símbolo
      for (const symbol of this.symbols) {
        try {
          // Intentar hasta 3 veces si hay errores
          let attempts = 0;
          let success = false;
          let lastError = null;
          
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
                  // Obtener los mejores precios de compra/venta (bid/ask)
                  let { bidPrice, askPrice } = await this.fetchOrderbook(symbol);
                  
                  // Si no se pudieron obtener los precios del orderbook, usar el precio actual como respaldo
                  if (bidPrice === '0.00' || askPrice === '0.00') {
                    bidPrice = this.formatPrice(price * 0.999); // 0.1% menos que el precio actual
                    askPrice = this.formatPrice(price * 1.001); // 0.1% más que el precio actual
                  }
                  
                  // Actualizar el ticker
                  this.spotTickers.set(symbol, {
                    symbol,
                    price: this.formatPrice(price),
                    indexPrice: ticker.usdIndexPrice ? this.formatPrice(parseFloat(ticker.usdIndexPrice)) : this.formatPrice(price),
                    change: `${changePercent.toFixed(2)}%`,
                    volume: this.formatVolume(parseFloat(ticker.volume24h)),
                    high24h: this.formatPrice(parseFloat(ticker.highPrice24h)),
                    low24h: this.formatPrice(parseFloat(ticker.lowPrice24h)),
                    volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
                    marketType: 'spot',
                    bidPrice: bidPrice,
                    askPrice: askPrice,
                    favorite: false
                  });
                  
                  validDataCount++;
                  success = true;
                } else {
                  lastError = new Error(`Invalid price for ${symbol}USDT: ${price}`);
                  attempts++;
                  // Esperar antes de reintentar
                  if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } else {
                lastError = new Error(`No ticker data found for ${symbol}USDT`);
                attempts++;
                // Esperar antes de reintentar
                if (attempts < 3) await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              lastError = error;
              attempts++;
              // Solo registrar el primer intento fallido para reducir logs
              if (attempts === 1) {
                this.logger.error(`Error fetching data for ${symbol}USDT (attempt ${attempts}): ${error.message}`);
              }
              // Esperar un poco antes de reintentar
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!success) {
            // Solo registrar una vez el fallo después de todos los intentos
            this.logger.error(`Failed to fetch data for ${symbol}USDT after ${attempts} attempts`);
          }
        } catch (error) {
          this.logger.error(`Error processing ${symbol}USDT: ${error.message}`);
        }
      }
      
      this.logger.log(`Initial spot market data fetched successfully for ${validDataCount}/${this.symbols.length} symbols`);
      
      // Si no se obtuvieron datos válidos para ningún símbolo, lanzar un error
      if (validDataCount === 0) {
        this.logger.warn('No valid data obtained for any symbol. Will rely on WebSocket data.');
      }
    } catch (error) {
      this.logger.error(`Error fetching initial spot market data: ${error.message}`);
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
    // Reducir el nivel de log a warn para no generar tantos logs
    this.logger.warn('WebSocket not connected or zero values detected, fetching data via REST API...');
    
    try {
      await this.fetchInitialData();
    } catch (error) {
      // No necesitamos registrar el error aquí ya que fetchInitialData ya lo hace
    }
  }

  getSpotTickers(): SpotMarketTicker[] {
    return Array.from(this.spotTickers.values());
  }

  getSpotTicker(symbol: string): SpotMarketTicker | undefined {
    return this.spotTickers.get(symbol);
  }

  private async fetchOrderbook(symbol: string): Promise<{ bidPrice: string, askPrice: string }> {
    try {
      // Verificar si ya hemos tenido errores 403 previamente
      const existingTicker = this.spotTickers.get(symbol);
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
          category: 'spot',
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
      const existingTicker = this.spotTickers.get(symbol);
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

  private startOrderbookUpdates() {
    // Actualizar los precios de compra/venta cada 30 segundos
    this.orderbookUpdateInterval = setInterval(async () => {
      // Solo actualizar si la conexión WebSocket no está activa
      if (!this.wsConnected) {
        try {
          // Actualizar los precios de compra/venta para los símbolos más populares
          const popularSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];
          
          for (const symbol of popularSymbols) {
            try {
              const { bidPrice, askPrice } = await this.fetchOrderbook(symbol);
              
              // Actualizar el ticker si los precios son válidos
              if (bidPrice !== '0.00' && askPrice !== '0.00') {
                const existingTicker = this.spotTickers.get(symbol);
                if (existingTicker) {
                  this.spotTickers.set(symbol, {
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
        } catch (error) {
          // No registrar errores de conectividad o 403
          if (!error.message.includes('ECONNREFUSED') && 
              !error.message.includes('timeout') && 
              (!error.response || error.response.status !== 403)) {
            this.logger.warn(`Error in orderbook update interval: ${error.message}`);
          }
        }
      }
    }, 30000); // 30 segundos
  }
} 