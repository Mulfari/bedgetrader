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
    if (this.wsSpot && this.wsSpot.readyState !== WebSocket.CLOSED && this.wsSpot.readyState !== WebSocket.CLOSING) {
      try {
        this.wsSpot.close();
      } catch (error) {
        this.logger.error('Error closing Spot WebSocket:', error);
      }
    }
    if (this.wsPerpetual && this.wsPerpetual.readyState !== WebSocket.CLOSED && this.wsPerpetual.readyState !== WebSocket.CLOSING) {
      try {
        this.wsPerpetual.close();
      } catch (error) {
        this.logger.error('Error closing Perpetual WebSocket:', error);
      }
    }
    
    // Asegurarse de que las referencias a los WebSockets se limpien
    this.wsSpot = null;
    this.wsPerpetual = null;
  }

  private connectWebSockets() {
    try {
      // Limpiar conexiones existentes antes de crear nuevas
      this.cleanupWebSockets();
      
      // Esperar un breve momento para asegurar que las conexiones anteriores se hayan cerrado completamente
      setTimeout(() => {
        try {
          // Conectar WebSocket de Spot
          this.wsSpot = new WebSocket(this.WS_URL_SPOT);
          this.setupWebSocketHandlers(this.wsSpot, 'spot');
  
          // Conectar WebSocket de Perpetual
          this.wsPerpetual = new WebSocket(this.WS_URL_PERPETUAL);
          this.setupWebSocketHandlers(this.wsPerpetual, 'perpetual');
        } catch (error) {
          this.logger.error('Error creating WebSocket connections:', error);
          this.handleReconnect();
        }
      }, 100); // Esperar 100ms
    } catch (error) {
      this.logger.error('Error in connectWebSockets:', error);
      this.handleReconnect();
    }
  }

  private setupWebSocketHandlers(ws: WebSocket, type: 'spot' | 'perpetual') {
    // Manejar el evento de apertura de conexión
    ws.on('open', () => {
      this.logger.log(`${type} WebSocket connected to Bybit`);
      this.reconnectAttempts = 0;
      
      try {
        this.subscribeToTickers(ws, type);
      } catch (error) {
        this.logger.error(`Error subscribing to ${type} tickers:`, error);
      }
    });

    // Manejar mensajes recibidos
    ws.on('message', (data: string) => {
      try {
        const message: MarketWebSocketMessage = JSON.parse(data.toString());
        this.handleWebSocketMessage(message, type);
      } catch (error) {
        this.logger.error(`Error processing ${type} WebSocket message:`, error);
      }
    });

    // Manejar cierre de conexión
    ws.on('close', (code: number, reason: string) => {
      this.logger.warn(`${type} WebSocket disconnected with code ${code}${reason ? ': ' + reason : ''}`);
      
      // Solo intentar reconectar si no fue un cierre intencional
      if (code !== 1000) {
        this.handleReconnect();
      }
    });

    // Manejar errores
    ws.on('error', (error) => {
      // Evitar registrar errores de ECONNRESET que son comunes durante el cierre
      if (error.message && !error.message.includes('ECONNRESET')) {
        this.logger.error(`${type} WebSocket error:`, error);
      }
      
      // No llamar a handleReconnect aquí, ya que el evento 'close' se disparará después
      // y manejará la reconexión si es necesario
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
      this.logger.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      
      // Usar un tiempo de espera exponencial para los reintentos
      const delay = Math.min(this.RECONNECT_INTERVAL * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
      
      setTimeout(() => {
        // Asegurarse de que las conexiones anteriores estén cerradas
        this.cleanupWebSockets();
        
        // Esperar un momento antes de intentar reconectar
        setTimeout(() => this.connectWebSockets(), 100);
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