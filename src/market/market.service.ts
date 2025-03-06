import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { MarketTicker, MarketWebSocketMessage } from './interfaces/market.interface';

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketService.name);
  private ws: WebSocket;
  private readonly WS_URL = 'wss://stream.bybit.com/v5/public/spot';
  private marketData: Map<string, MarketTicker> = new Map();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 5000;

  private initializeMarketData() {
    const initialPairs = ['BTC', 'ETH', 'SOL', 'XRP'];
    initialPairs.forEach(symbol => {
      this.marketData.set(`${symbol}USDT`, {
        symbol,
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
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
    this.connectWebSocket();
  }

  onModuleDestroy() {
    this.cleanupWebSocket();
  }

  private cleanupWebSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        this.logger.error('Error closing WebSocket:', error);
      }
    }
  }

  private connectWebSocket() {
    try {
      this.cleanupWebSocket();
      this.ws = new WebSocket(this.WS_URL);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.logger.error('Error creating WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private setupWebSocketHandlers() {
    this.ws.on('open', () => {
      this.logger.log('WebSocket connected to Bybit');
      this.reconnectAttempts = 0;
      this.subscribeToTickers();
    });

    this.ws.on('message', (data: string) => {
      try {
        const message: MarketWebSocketMessage = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        this.logger.error('Error processing WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      this.logger.warn('WebSocket disconnected');
      this.handleReconnect();
    });

    this.ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
      this.handleReconnect();
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      this.logger.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => this.connectWebSocket(), this.RECONNECT_INTERVAL);
    } else {
      this.logger.error('Max reconnection attempts reached');
    }
  }

  private subscribeToTickers() {
    const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
    const subscribeMessage = {
      op: 'subscribe',
      args: [
        ...pairs.map(pair => `tickers.${pair}`),
        ...pairs.map(pair => `index.${pair}`),
        ...pairs.map(pair => `funding.${pair}`)
      ]
    };
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private handleWebSocketMessage(message: MarketWebSocketMessage) {
    try {
      if (!message.topic) return;

      const [type, symbol] = message.topic.split('.');
      if (!symbol) return;

      const baseSymbol = symbol.replace('USDT', '');
      const currentData = this.marketData.get(symbol) || this.marketData.get(baseSymbol) || {
        symbol: baseSymbol,
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
        openInterest: '0',
        fundingRate: '0.00%',
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
        leverage: '10x',
        favorite: false,
        interestRate: {
          long: '0.00%',
          short: '0.00%'
        }
      };

      let updatedData = { ...currentData };

      switch (type) {
        case 'tickers':
          updatedData = {
            ...updatedData,
            price: this.formatPrice(message.data?.lastPrice),
            volume: this.formatNumber(message.data?.volume24h),
            volumeUSDT: this.formatNumber(message.data?.turnover24h),
            change: this.formatPercentage(message.data?.price24hPcnt),
            high24h: this.formatPrice(message.data?.highPrice24h),
            low24h: this.formatPrice(message.data?.lowPrice24h),
          };
          break;
        case 'index':
          updatedData = {
            ...updatedData,
            indexPrice: this.formatPrice(message.data?.indexPrice),
          };
          break;
        case 'funding':
          updatedData = {
            ...updatedData,
            fundingRate: this.formatPercentage(message.data?.fundingRate),
            nextFundingTime: message.data?.nextFundingTime || updatedData.nextFundingTime,
          };
          break;
      }

      this.marketData.set(symbol, {
        ...updatedData,
        symbol: baseSymbol,
      });
    } catch (error) {
      this.logger.error('Error processing WebSocket message:', error);
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

    // Para precios menores a 1, usar más decimales
    if (num < 1) return num.toFixed(6);
    if (num < 100) return num.toFixed(4);
    return num.toFixed(2);
  }

  private formatPercentage(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00%';

    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  }

  private transformTickerData(data: any): MarketTicker {
    const price = this.formatPrice(data.lastPrice);
    const indexPrice = this.formatPrice(data.indexPrice);
    const volume = this.formatNumber(data.volume24h);
    const volumeUSDT = this.formatNumber(data.turnover24h);
    const change = this.formatPercentage(data.price24hPcnt);
    const fundingRate = this.formatPercentage(data.fundingRate || 0);
    const nextFundingTime = data.nextFundingTime || Date.now() + 8 * 60 * 60 * 1000; // 8 horas por defecto

    return {
      symbol: data.symbol.replace('USDT', ''),
      price,
      indexPrice,
      change,
      volume,
      high24h: this.formatPrice(data.highPrice24h),
      low24h: this.formatPrice(data.lowPrice24h),
      volumeUSDT,
      openInterest: this.formatNumber(data.openInterest || 0),
      fundingRate,
      nextFundingTime,
      leverage: '10x',
      favorite: false,
      interestRate: {
        long: '0.00%',
        short: '0.00%'
      }
    };
  }

  public getAllTickers(): MarketTicker[] {
    return Array.from(this.marketData.values());
  }

  public getTicker(symbol: string): MarketTicker | undefined {
    return this.marketData.get(symbol);
  }
} 