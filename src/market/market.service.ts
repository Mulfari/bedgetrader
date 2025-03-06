import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';
import { MarketTicker, MarketWebSocketMessage } from './interfaces/market.interface';

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket;
  private readonly WS_URL = 'wss://stream.bybit.com/v5/public/spot';
  private marketData: Map<string, MarketTicker> = new Map();

  async onModuleInit() {
    this.connectWebSocket();
  }

  onModuleDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  }

  private connectWebSocket() {
    this.ws = new WebSocket(this.WS_URL);

    this.ws.on('open', () => {
      console.log('WebSocket connected to Bybit');
      this.subscribeToTickers();
    });

    this.ws.on('message', (data: string) => {
      try {
        const message: MarketWebSocketMessage = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('WebSocket disconnected, attempting to reconnect...');
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private subscribeToTickers() {
    const subscribeMessage = {
      op: 'subscribe',
      args: ['tickers.BTCUSDT', 'tickers.ETHUSDT', 'tickers.SOLUSDT', 'tickers.XRPUSDT']
    };
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private handleWebSocketMessage(message: MarketWebSocketMessage) {
    if (message.topic?.startsWith('tickers.')) {
      const ticker = this.transformTickerData(message.data);
      this.marketData.set(ticker.symbol, ticker);
    }
  }

  private transformTickerData(data: any): MarketTicker {
    return {
      symbol: data.symbol.replace('USDT', ''),
      price: data.lastPrice,
      change: `${data.price24hPcnt}%`,
      volume: data.volume24h,
      high24h: data.highPrice24h,
      low24h: data.lowPrice24h,
      volumeUSDT: data.turnover24h,
      leverage: '10x', // Default value for spot
      favorite: false, // Default value
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