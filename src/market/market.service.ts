import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { MarketTicker, MarketWebSocketMessage, SpotMarketTicker } from './interfaces/market.interface';

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketService.name);
  private wsSpot: WebSocket;
  private wsPerpetual: WebSocket;
  private readonly WS_URL_SPOT = 'wss://stream.bybit.com/v5/public/spot';
  private readonly WS_URL_PERPETUAL = 'wss://stream.bybit.com/v5/public/linear';
  private marketData: Map<string, MarketTicker> = new Map();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;

  private initializeMarketData() {
    const initialPairs = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK', 'AVAX', 'MATIC', 'UNI', 'LTC', 'SHIB', 'ATOM', 'BNB'];
    initialPairs.forEach(symbol => {
      // Inicializar datos para spot
      this.marketData.set(`${symbol}USDT-SPOT`, {
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

      // Inicializar datos para perpetual
      this.marketData.set(`${symbol}USDT-PERP`, {
        symbol,
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
        marketType: 'perpetual',
        openInterest: '0',
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
    this.initializeMarketData();
    this.connectWebSockets();
  }

  onModuleDestroy() {
    this.cleanupWebSockets();
  }

  private cleanupWebSockets() {
    // Limpiar WebSocket de Spot
    if (this.wsSpot) {
      try {
        // Solo intentar cerrar si está abierto o conectando
        if (this.wsSpot.readyState === WebSocket.OPEN || this.wsSpot.readyState === WebSocket.CONNECTING) {
          // Eliminar todos los listeners para evitar eventos no deseados
          this.wsSpot.removeAllListeners();
          
          // Agregar un único listener para el evento close
          this.wsSpot.once('close', () => {
            this.logger.log('Spot WebSocket closed cleanly');
          });
          
          // Cerrar la conexión
          this.wsSpot.close(1000, 'Closing connection intentionally');
        }
      } catch (error) {
        // Solo registrar errores reales, ignorar errores de cierre normal
        if (error.message && !error.message.includes('WebSocket was closed')) {
          this.logger.error('Error closing Spot WebSocket:', error);
        }
      }
      
      // Limpiar la referencia
      this.wsSpot = null;
    }
    
    // Limpiar WebSocket de Perpetual
    if (this.wsPerpetual) {
      try {
        // Solo intentar cerrar si está abierto o conectando
        if (this.wsPerpetual.readyState === WebSocket.OPEN || this.wsPerpetual.readyState === WebSocket.CONNECTING) {
          // Eliminar todos los listeners para evitar eventos no deseados
          this.wsPerpetual.removeAllListeners();
          
          // Agregar un único listener para el evento close
          this.wsPerpetual.once('close', () => {
            this.logger.log('Perpetual WebSocket closed cleanly');
          });
          
          // Cerrar la conexión
          this.wsPerpetual.close(1000, 'Closing connection intentionally');
        }
      } catch (error) {
        // Solo registrar errores reales, ignorar errores de cierre normal
        if (error.message && !error.message.includes('WebSocket was closed')) {
          this.logger.error('Error closing Perpetual WebSocket:', error);
        }
      }
      
      // Limpiar la referencia
      this.wsPerpetual = null;
    }
  }

  private connectWebSockets() {
    // Primero, asegurarse de que las conexiones anteriores estén completamente cerradas
    this.cleanupWebSockets();
    
    // Esperar un momento antes de crear nuevas conexiones
    setTimeout(() => {
      this.connectSpotWebSocket();
      this.connectPerpetualWebSocket();
    }, 500);
  }
  
  private connectSpotWebSocket() {
    try {
      // Crear nueva conexión WebSocket para Spot
      this.wsSpot = new WebSocket(this.WS_URL_SPOT);
      
      // Configurar manejadores de eventos
      this.setupWebSocketHandlers(this.wsSpot, 'spot');
      
      // Agregar un timeout para detectar problemas de conexión
      const connectionTimeout = setTimeout(() => {
        if (this.wsSpot && this.wsSpot.readyState === WebSocket.CONNECTING) {
          this.logger.warn('Spot WebSocket connection timeout');
          
          // Limpiar la conexión actual
          if (this.wsSpot) {
            this.wsSpot.removeAllListeners();
            this.wsSpot.terminate();
            this.wsSpot = null;
          }
          
          // Intentar reconectar
          this.handleReconnect();
        }
      }, 10000); // 10 segundos de timeout
      
      // Limpiar el timeout cuando se establezca la conexión
      this.wsSpot.once('open', () => {
        clearTimeout(connectionTimeout);
      });
    } catch (error) {
      this.logger.error('Error creating Spot WebSocket connection:', error);
      this.handleReconnect();
    }
  }
  
  private connectPerpetualWebSocket() {
    try {
      // Crear nueva conexión WebSocket para Perpetual
      this.wsPerpetual = new WebSocket(this.WS_URL_PERPETUAL);
      
      // Configurar manejadores de eventos
      this.setupWebSocketHandlers(this.wsPerpetual, 'perpetual');
      
      // Agregar un timeout para detectar problemas de conexión
      const connectionTimeout = setTimeout(() => {
        if (this.wsPerpetual && this.wsPerpetual.readyState === WebSocket.CONNECTING) {
          this.logger.warn('Perpetual WebSocket connection timeout');
          
          // Limpiar la conexión actual
          if (this.wsPerpetual) {
            this.wsPerpetual.removeAllListeners();
            this.wsPerpetual.terminate();
            this.wsPerpetual = null;
          }
          
          // Intentar reconectar
          this.handleReconnect();
        }
      }, 10000); // 10 segundos de timeout
      
      // Limpiar el timeout cuando se establezca la conexión
      this.wsPerpetual.once('open', () => {
        clearTimeout(connectionTimeout);
      });
    } catch (error) {
      this.logger.error('Error creating Perpetual WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, type: 'spot' | 'perpetual') {
    // Verificar que el WebSocket exista
    if (!ws) {
      this.logger.error(`Cannot setup handlers: ${type} WebSocket is null`);
      return;
    }
    
    // Manejar el evento de apertura de conexión
    ws.on('open', () => {
      this.logger.log(`${type} WebSocket connected to Bybit`);
      this.reconnectAttempts = 0;
      
      // Esperar un breve momento antes de suscribirse para asegurar que la conexión esté estable
      setTimeout(() => {
        try {
          this.subscribeToTickers(ws, type);
        } catch (error) {
          this.logger.error(`Error subscribing to ${type} tickers:`, error);
        }
      }, 100);
    });

    // Manejar mensajes recibidos
    ws.on('message', (data: string) => {
      try {
        const message: MarketWebSocketMessage = JSON.parse(data.toString());
        
        // Verificar si es un mensaje de ping/pong o heartbeat
        if (message.op === 'ping' || message.type === 'ping') {
          // Responder con pong si es necesario
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'pong' }));
          }
          return;
        }
        
        // Procesar el mensaje normal
        this.handleWebSocketMessage(message, type);
      } catch (error) {
        // Solo registrar errores de procesamiento, no errores de conexión
        if (!error.message || (!error.message.includes('ECONNRESET') && !error.message.includes('WebSocket is not open'))) {
          this.logger.error(`Error processing ${type} WebSocket message:`, error);
        }
      }
    });

    // Manejar cierre de conexión
    ws.on('close', (code: number, reason: string) => {
      // Registrar información detallada sobre el cierre
      const reasonStr = reason ? `: ${reason}` : '';
      this.logger.warn(`${type} WebSocket disconnected with code ${code}${reasonStr}`);
      
      // Códigos de cierre normales: 1000 (cierre normal), 1001 (going away)
      const isNormalClosure = code === 1000 || code === 1001;
      
      // Solo intentar reconectar si no fue un cierre normal
      if (!isNormalClosure) {
        // Esperar un momento antes de intentar reconectar
        setTimeout(() => this.handleReconnect(), 100);
      }
    });

    // Manejar errores
    ws.on('error', (error) => {
      // Filtrar errores comunes durante el cierre
      const errorMsg = error.message || '';
      const isCommonError = errorMsg.includes('ECONNRESET') || 
                           errorMsg.includes('WebSocket was closed') ||
                           errorMsg.includes('WebSocket is not open');
      
      if (!isCommonError) {
        this.logger.error(`${type} WebSocket error:`, error);
      }
      
      // No llamar a handleReconnect aquí, ya que el evento 'close' se disparará después
    });
    
    // Configurar un ping periódico para mantener la conexión viva
    const pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ op: 'ping' }));
        } catch (error) {
          // Ignorar errores de ping, el evento de error los manejará
        }
      } else {
        // Limpiar el intervalo si el WebSocket ya no está abierto
        clearInterval(pingInterval);
      }
    }, 30000); // Enviar ping cada 30 segundos
    
    // Limpiar el intervalo cuando se cierre el WebSocket
    ws.once('close', () => {
      clearInterval(pingInterval);
    });
  }

  private subscribeToTickers(ws: WebSocket, type: 'spot' | 'perpetual') {
    // Verificar que el WebSocket esté abierto antes de enviar mensajes
    if (ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot subscribe to ${type} tickers: WebSocket is not open`);
      return;
    }
    
    try {
      const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'LINK', 'AVAX', 'MATIC', 'UNI', 'LTC', 'SHIB', 'ATOM', 'BNB'];
      const subscribeMessage = {
        op: 'subscribe',
        args: symbols.map(symbol => `tickers.${symbol}USDT`)
      };
      
      // Enviar mensaje de suscripción
      ws.send(JSON.stringify(subscribeMessage));
      
      // Registrar suscripción exitosa
      this.logger.log(`Subscribed to ${type} tickers for ${symbols.length} symbols`);
    } catch (error) {
      this.logger.error(`Error subscribing to ${type} tickers:`, error);
    }
  }

  private handleWebSocketMessage(message: MarketWebSocketMessage, type: 'spot' | 'perpetual') {
    try {
      if (!message.topic) return;

      const [msgType, symbol] = message.topic.split('.');
      if (!symbol) return;

      const baseSymbol = symbol.replace('USDT', '');
      const marketKey = `${baseSymbol}USDT-${type === 'spot' ? 'SPOT' : 'PERP'}`;
      
      const currentData = this.marketData.get(marketKey) || this.transformTickerData({
        symbol: baseSymbol + 'USDT',
        lastPrice: '0',
        markPrice: '0',
        price24hPcnt: '0',
        volume24h: '0',
        highPrice24h: '0',
        lowPrice24h: '0',
        turnover24h: '0'
      }, type);

      let updatedData = { ...currentData };

      if (message.data) {
        if (msgType === 'tickers') {
          updatedData = this.transformTickerData({
            ...message.data,
            symbol: baseSymbol + 'USDT'
          }, type);
        } else if (type === 'spot' && msgType === 'bookticker') {
          updatedData = {
            ...updatedData,
            bidPrice: this.formatPrice(message.data.bidPrice),
            askPrice: this.formatPrice(message.data.askPrice)
          } as SpotMarketTicker;
        }
      }

      this.marketData.set(marketKey, updatedData);
    } catch (error) {
      this.logger.error(`Error processing ${type} WebSocket message:`, error);
    }
  }

  private formatNumber(value: string | number, decimals: number = 2): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';

    if (num >= 1e9) {
      return (num / 1e9).toFixed(decimals) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(decimals) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(decimals) + 'K';
    }
    return num.toFixed(decimals);
  }

  private formatPrice(price: string | number): string {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num)) return '0.00';

    if (num >= 10000) return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num >= 1000) return num.toFixed(2);
    if (num >= 100) return num.toFixed(3);
    if (num >= 1) return num.toFixed(4);
    return num.toFixed(6);
  }

  private formatPercentage(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00%';

    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  }

  private transformTickerData(data: any, type: 'spot' | 'perpetual'): MarketTicker {
    const baseData = {
      symbol: data.symbol?.replace('USDT', '') || '',
      price: this.formatPrice(data.lastPrice || 0),
      indexPrice: this.formatPrice(data.indexPrice || data.lastPrice || 0),
      change: this.formatPercentage(data.change || 0),
      volume: this.formatNumber(data.volume || 0),
      high24h: this.formatPrice(data.high24h || 0),
      low24h: this.formatPrice(data.low24h || 0),
      volumeUSDT: this.formatNumber(data.volumeUSDT || 0),
      favorite: false
    };

    if (type === 'spot') {
      return {
        ...baseData,
        marketType: 'spot',
        bidPrice: this.formatPrice(data.bidPrice || 0),
        askPrice: this.formatPrice(data.askPrice || 0)
      };
    } else {
      return {
        ...baseData,
        marketType: 'perpetual',
        openInterest: this.formatNumber(data.openInterest || 0),
        fundingRate: this.formatPercentage(data.fundingRate || 0),
        nextFundingTime: data.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000,
        leverage: '10x',
        markPrice: this.formatPrice(data.markPrice || data.lastPrice || 0),
        lastPrice: this.formatPrice(data.lastPrice || 0),
        bidPrice: this.formatPrice(data.bidPrice || 0),
        askPrice: this.formatPrice(data.askPrice || 0)
      };
    }
  }

  public getAllTickers(): MarketTicker[] {
    return Array.from(this.marketData.values());
  }

  public getTicker(symbol: string): MarketTicker | undefined {
    return this.marketData.get(symbol);
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      
      // Calcular retraso exponencial con un componente aleatorio para evitar reconexiones simultáneas
      const baseDelay = this.RECONNECT_INTERVAL * Math.pow(1.5, this.reconnectAttempts - 1);
      const jitter = Math.random() * 1000; // Añadir hasta 1 segundo de jitter
      const delay = Math.min(baseDelay + jitter, 30000);
      
      this.logger.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${Math.round(delay)}ms...`);
      
      setTimeout(() => {
        // Intentar conectar de nuevo
        if (!this.wsSpot || this.wsSpot.readyState !== WebSocket.OPEN) {
          this.connectSpotWebSocket();
        }
        
        if (!this.wsPerpetual || this.wsPerpetual.readyState !== WebSocket.OPEN) {
          this.connectPerpetualWebSocket();
        }
      }, delay);
    } else {
      this.logger.error('Max reconnection attempts reached');
      
      // Reiniciar el contador de intentos después de un tiempo más largo
      setTimeout(() => {
        this.logger.log('Resetting reconnection attempts counter and trying again...');
        this.reconnectAttempts = 0;
        this.connectWebSockets();
      }, 60000); // Esperar 1 minuto antes de reiniciar
    }
  }
} 