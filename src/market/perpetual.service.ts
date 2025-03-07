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
        openInterest: '0',
        fundingRate: '0.00%',
        nextFundingTime: Date.now() + 8 * 60 * 60 * 1000, // 8 horas por defecto
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
    // Obtener datos iniciales mediante REST API
    await this.fetchInitialData();
    
    // Iniciar conexión WebSocket
    this.connectWebSocket();
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
        
        // Suscribirse a los tickers de futuros
        const symbols = this.symbols.map(symbol => `${symbol}USDT`);
        const subscribeMsg = {
          op: 'subscribe',
          args: [
            ...symbols.map(symbol => `tickers.${symbol}`),
            ...symbols.map(symbol => `funding.${symbol}`)
          ]
        };
        
        this.ws.send(JSON.stringify(subscribeMsg));
        this.logger.log(`Subscribed to perpetual tickers: ${symbols.join(', ')}`);
        this.logger.log(`Subscription message: ${JSON.stringify(subscribeMsg)}`);
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.logger.debug(`Received WebSocket message: ${JSON.stringify(message)}`);
          
          // Verificar si es un mensaje de respuesta a la suscripción
          if (message.op === 'subscribe' && message.success) {
            this.logger.log(`Successfully subscribed to: ${JSON.stringify(message.ret_msg)}`);
          }
          
          // Procesar datos de ticker
          if (message.topic && message.topic.startsWith('tickers.') && message.data) {
            const ticker = message.data;
            const symbolWithUsdt = message.topic.split('.')[1];
            const symbol = symbolWithUsdt.replace('USDT', '');
            
            if (this.symbols.includes(symbol)) {
              this.logger.log(`Received perpetual ticker update for ${symbol}`);
              this.logger.debug(`Ticker data: ${JSON.stringify(ticker)}`);
              
              // Actualizar el ticker
              const existingTicker = this.perpetualTickers.get(symbol);
              if (existingTicker) {
                try {
                  const price = parseFloat(ticker.lastPrice);
                  const changePercent = parseFloat(ticker.price24hPcnt) * 100;
                  
                  const updatedTicker: PerpetualMarketTicker = {
                    ...existingTicker,
                    price: price.toFixed(2),
                    lastPrice: price.toFixed(2),
                    indexPrice: parseFloat(ticker.indexPrice).toFixed(2),
                    markPrice: parseFloat(ticker.markPrice).toFixed(2),
                    change: `${changePercent.toFixed(2)}%`,
                    volume: parseFloat(ticker.volume24h).toFixed(2),
                    high24h: parseFloat(ticker.highPrice24h).toFixed(2),
                    low24h: parseFloat(ticker.lowPrice24h).toFixed(2),
                    volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
                    openInterest: this.formatVolume(parseFloat(ticker.openInterest)),
                    bidPrice: parseFloat(ticker.bid1Price).toFixed(2),
                    askPrice: parseFloat(ticker.ask1Price).toFixed(2)
                  };
                  
                  this.perpetualTickers.set(symbol, updatedTicker);
                  this.logger.debug(`Updated ticker for ${symbol}: ${JSON.stringify(updatedTicker)}`);
                } catch (error) {
                  this.logger.error(`Error processing ticker data for ${symbol}: ${error.message}`);
                  this.logger.error(`Ticker data: ${JSON.stringify(ticker)}`);
                }
              }
            }
          }
          
          // Procesar datos de funding
          if (message.topic && message.topic.startsWith('funding.') && message.data) {
            const funding = message.data;
            const symbolWithUsdt = message.topic.split('.')[1];
            const symbol = symbolWithUsdt.replace('USDT', '');
            
            if (this.symbols.includes(symbol)) {
              this.logger.log(`Received funding update for ${symbol}`);
              this.logger.debug(`Funding data: ${JSON.stringify(funding)}`);
              
              // Actualizar el ticker con datos de funding
              const existingTicker = this.perpetualTickers.get(symbol);
              if (existingTicker) {
                try {
                  const fundingRate = parseFloat(funding.fundingRate) * 100;
                  const nextFundingTime = new Date(funding.nextFundingTime).getTime();
                  
                  const updatedTicker: PerpetualMarketTicker = {
                    ...existingTicker,
                    fundingRate: `${fundingRate.toFixed(4)}%`,
                    nextFundingTime: nextFundingTime
                  };
                  
                  this.perpetualTickers.set(symbol, updatedTicker);
                  this.logger.debug(`Updated funding for ${symbol}: ${fundingRate.toFixed(4)}%, next at ${new Date(nextFundingTime).toISOString()}`);
                } catch (error) {
                  this.logger.error(`Error processing funding data for ${symbol}: ${error.message}`);
                  this.logger.error(`Funding data: ${JSON.stringify(funding)}`);
                }
              }
            }
          }
        } catch (error) {
          this.logger.error(`Error processing WebSocket message: ${error.message}`);
          this.logger.error(`Raw message: ${data.toString()}`);
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
      this.logger.log('Fetching initial perpetual market data from Bybit API...');
      
      // Obtener datos de la API de Bybit para cada símbolo
      for (const symbol of this.symbols) {
        try {
          this.logger.log(`Fetching data for ${symbol}USDT...`);
          
          const tickerResponse = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
            params: {
              category: 'linear',
              symbol: `${symbol}USDT`
            }
          });
          
          this.logger.debug(`Ticker response for ${symbol}: ${JSON.stringify(tickerResponse.data)}`);
          
          if (tickerResponse.data?.result?.list?.[0]) {
            const ticker = tickerResponse.data.result.list[0];
            
            // Obtener datos de funding
            const fundingResponse = await axios.get(`https://api.bybit.com/v5/market/funding/history`, {
              params: {
                category: 'linear',
                symbol: `${symbol}USDT`,
                limit: 1
              }
            });
            
            this.logger.debug(`Funding response for ${symbol}: ${JSON.stringify(fundingResponse.data)}`);
            
            // Formatear los datos
            const price = parseFloat(ticker.lastPrice);
            const changePercent = parseFloat(ticker.price24hPcnt) * 100;
            
            // Calcular próximo tiempo de funding (cada 8 horas: 00:00, 08:00, 16:00 UTC)
            const now = new Date();
            const hours = now.getUTCHours();
            const nextFundingHour = Math.ceil(hours / 8) * 8 % 24;
            const nextFundingDate = new Date(Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth(),
              now.getUTCDate() + (nextFundingHour <= hours ? 1 : 0),
              nextFundingHour,
              0,
              0
            ));
            
            // Obtener funding rate
            let fundingRate = '0.0000%';
            if (fundingResponse.data?.result?.list?.[0]) {
              const fundingData = fundingResponse.data.result.list[0];
              fundingRate = `${(parseFloat(fundingData.fundingRate) * 100).toFixed(4)}%`;
            }
            
            // Actualizar el ticker
            const updatedTicker: PerpetualMarketTicker = {
              symbol,
              price: price.toFixed(2),
              lastPrice: price.toFixed(2),
              indexPrice: parseFloat(ticker.indexPrice).toFixed(2),
              markPrice: parseFloat(ticker.markPrice).toFixed(2),
              change: `${changePercent.toFixed(2)}%`,
              volume: parseFloat(ticker.volume24h).toFixed(2),
              high24h: parseFloat(ticker.highPrice24h).toFixed(2),
              low24h: parseFloat(ticker.lowPrice24h).toFixed(2),
              volumeUSDT: this.formatVolume(parseFloat(ticker.turnover24h)),
              marketType: 'perpetual',
              openInterest: this.formatVolume(parseFloat(ticker.openInterest)),
              fundingRate: fundingRate,
              nextFundingTime: nextFundingDate.getTime(),
              leverage: '10x', // Valor por defecto
              bidPrice: parseFloat(ticker.bid1Price).toFixed(2),
              askPrice: parseFloat(ticker.ask1Price).toFixed(2),
              favorite: false
            };
            
            this.perpetualTickers.set(symbol, updatedTicker);
            this.logger.log(`Initial perpetual data set for ${symbol}`);
            this.logger.debug(`Initial data for ${symbol}: ${JSON.stringify(updatedTicker)}`);
          } else {
            this.logger.warn(`No initial perpetual ticker data found for ${symbol}USDT`);
          }
        } catch (error) {
          this.logger.error(`Error fetching initial perpetual data for ${symbol}: ${error.message}`);
          if (error.response) {
            this.logger.error(`Response status: ${error.response.status}`);
            this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
          }
        }
      }
      
      this.logger.log('Initial perpetual market data fetched successfully');
      this.logger.debug(`All tickers: ${JSON.stringify(Array.from(this.perpetualTickers.entries()))}`);
    } catch (error) {
      this.logger.error(`Error fetching initial perpetual market data: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
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
} 