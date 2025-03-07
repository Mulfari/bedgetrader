import { Injectable } from '@nestjs/common';
import { SpotMarketTicker } from './interfaces/market.interface';
import axios from 'axios';

@Injectable()
export class SpotMarketService {
  private spotTickers: Map<string, SpotMarketTicker> = new Map();
  private readonly symbols = ['BTC', 'ETH', 'SOL', 'XRP'];

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

  async fetchSpotData(): Promise<void> {
    try {
      // Aquí puedes usar la API de tu preferencia (Binance, FTX, etc.)
      const response = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
      const data = response.data;

      this.symbols.forEach(symbol => {
        const ticker = data.find(t => t.symbol === `${symbol}USDT`);
        if (ticker) {
          this.spotTickers.set(symbol, {
            symbol,
            price: parseFloat(ticker.lastPrice).toFixed(2),
            indexPrice: parseFloat(ticker.lastPrice).toFixed(2),
            change: `${parseFloat(ticker.priceChangePercent).toFixed(2)}%`,
            volume: parseFloat(ticker.volume).toFixed(2),
            high24h: parseFloat(ticker.highPrice).toFixed(2),
            low24h: parseFloat(ticker.lowPrice).toFixed(2),
            volumeUSDT: `${(parseFloat(ticker.quoteVolume) / 1000000).toFixed(2)}M`,
            marketType: 'spot',
            bidPrice: parseFloat(ticker.bidPrice).toFixed(2),
            askPrice: parseFloat(ticker.askPrice).toFixed(2),
            favorite: false
          });
        }
      });
    } catch (error) {
      console.error('Error fetching spot market data:', error);
    }
  }

  getSpotTickers(): SpotMarketTicker[] {
    return Array.from(this.spotTickers.values());
  }

  getSpotTicker(symbol: string): SpotMarketTicker | undefined {
    return this.spotTickers.get(symbol);
  }
} 