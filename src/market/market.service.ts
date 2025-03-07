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
    const initialPairs = ['BTC', 'ETH', 'SOL', 'XRP'];
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
        favorite: false,
        interestRate: {
          long: '0.00%',
          short: '0.00%'
        }
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
    if (this.wsSpot) {
      try {
        this.wsSpot.close();
      } catch (error) {
        this.logger.error('Error closing Spot WebSocket:', error);
      }
    }
    if (this.wsPerpetual) {
      try {
        this.wsPerpetual.close();
      } catch (error) {
        this.logger.error('Error closing Perpetual WebSocket:', error);
      }
    }
  }

  private connectWebSockets() {
    try {
      this.cleanupWebSockets();
      
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
  }

  private setupWebSocketHandlers(ws: WebSocket, type: 'spot' | 'perpetual') {
    ws.on('open', () => {
      this.logger.log(`${type} WebSocket connected to Bybit`);
      this.reconnectAttempts = 0;
      this.subscribeToTickers(ws, type);
    });

    ws.on('message', (data: string) => {
      try {
        const message: MarketWebSocketMessage = JSON.parse(data.toString());
        this.handleWebSocketMessage(message, type);
      } catch (error) {
        this.logger.error(`Error processing ${type} WebSocket message:`, error);
      }
    });

    ws.on('close', () => {
      this.logger.warn(`${type} WebSocket disconnected`);
      this.handleReconnect();
    });

    ws.on('error', (error) => {
      this.logger.error(`${type} WebSocket error:`, error);
      this.handleReconnect();
    });
  }

  private subscribeToTickers(ws: WebSocket, type: 'spot' | 'perpetual') {
    const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
    const subscribeMessage = {
      op: 'subscribe',
      args: type === 'spot' 
        ? pairs.flatMap(pair => [`tickers.${pair}`, `bookticker.${pair}`])
        : pairs.flatMap(pair => [
            `tickers.${pair}`,
            `kline.1.${pair}`,
            `liquidation.${pair}`
          ])
    };
    this.logger.debug(`Subscribing to ${type} topics:`, subscribeMessage);
    ws.send(JSON.stringify(subscribeMessage));
  }

  private handleWebSocketMessage(message: MarketWebSocketMessage, type: 'spot' | 'perpetual') {
    try {
      if (!message.topic) return;
      this.logger.debug(`Received ${type} message:`, message);

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
      this.logger.debug(`Updated ${type} market data for ${marketKey}:`, updatedData);
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
      symbol: data.symbol.replace('USDT', ''),
      price: this.formatPrice(data.lastPrice),
      indexPrice: this.formatPrice(data.markPrice || data.indexPrice),
      change: this.formatPercentage(data.price24hPcnt),
      volume: this.formatNumber(data.volume24h),
      high24h: this.formatPrice(data.highPrice24h),
      low24h: this.formatPrice(data.lowPrice24h),
      volumeUSDT: this.formatNumber(data.turnover24h),
      favorite: false
    };

    if (type === 'spot') {
      return {
        ...baseData,
        marketType: 'spot',
        bidPrice: this.formatPrice(data.bidPrice || '0'),
        askPrice: this.formatPrice(data.askPrice || '0')
      };
    } else {
      return {
        ...baseData,
        marketType: 'perpetual',
        openInterest: this.formatNumber(data.openInterest || 0),
        fundingRate: this.formatPercentage(data.fundingRate || 0),
        nextFundingTime: data.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000,
        leverage: '10x',
        interestRate: {
          long: this.formatPercentage(data.longRate || 0),
          short: this.formatPercentage(data.shortRate || 0)
        }
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
      setTimeout(() => this.connectWebSockets(), this.RECONNECT_INTERVAL);
    } else {
      this.logger.error('Max reconnection attempts reached');
    }
  }
} 