import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import WebSocket from 'ws';

interface OrderbookData {
  s: string; // Symbol
  b: [string, string][]; // Bids [price, size]
  a: [string, string][]; // Asks [price, size]
  u: number; // Update ID
  seq: number; // Sequence
  cts: number; // Timestamp
}

interface OrderbookMessage {
  topic: string;
  type: 'snapshot' | 'delta';
  ts: number;
  data: OrderbookData;
  cts: number;
}

@Injectable()
export class OrderbookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderbookService.name);
  private ws: WebSocket | null = null;
  private activeSubscriptions: Map<string, Set<string>> = new Map();
  private orderbooks: Map<string, OrderbookData> = new Map();
  private readonly BYBIT_WS_URL = 'wss://stream.bybit.com/v5/public/linear';
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  private connect() {
    try {
      this.logger.log('Conectando al WebSocket de Bybit...');
      this.ws = new WebSocket(this.BYBIT_WS_URL);

      this.ws.on('open', () => {
        this.logger.log('Conexión establecida con Bybit WebSocket');
        this.reconnectAttempts = 0;
        
        // Resubscribe to all active subscriptions
        this.resubscribeAll();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle ping/pong for keeping connection alive
          if (message.op === 'ping') {
            this.sendPong();
            return;
          }

          // Handle orderbook messages
          if (message.topic && message.topic.startsWith('orderbook.')) {
            this.handleOrderbookMessage(message);
          }
        } catch (error) {
          this.logger.error(`Error al procesar mensaje: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`Error en WebSocket: ${error.message}`);
      });

      this.ws.on('close', () => {
        this.logger.warn('Conexión WebSocket cerrada');
        this.attemptReconnect();
      });
    } catch (error) {
      this.logger.error(`Error al conectar WebSocket: ${error.message}`);
      this.attemptReconnect();
    }
  }

  private disconnect() {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(`Máximo número de intentos de reconexión (${this.MAX_RECONNECT_ATTEMPTS}) alcanzado`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff with max 30s

    this.logger.log(`Intentando reconectar en ${delay}ms (intento ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Resubscribe to all active topics
    this.activeSubscriptions.forEach((clientIds, topic) => {
      if (clientIds.size > 0) {
        this.subscribe(topic);
      }
    });
  }

  private sendPong() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 'pong' }));
    }
  }

  private handleOrderbookMessage(message: OrderbookMessage) {
    try {
      const { topic, type, data } = message;
      const symbol = data.s;
      
      // Store the orderbook data
      if (type === 'snapshot') {
        // For snapshot, replace the entire orderbook
        this.orderbooks.set(symbol, data);
      } else if (type === 'delta') {
        // For delta, update the existing orderbook
        const existingOrderbook = this.orderbooks.get(symbol);
        
        if (!existingOrderbook) {
          this.logger.warn(`Recibido delta para ${symbol} sin snapshot previo`);
          return;
        }

        // Update bids
        for (const [price, size] of data.b) {
          if (parseFloat(size) === 0) {
            // Remove the price level
            existingOrderbook.b = existingOrderbook.b.filter(([p]) => p !== price);
          } else {
            // Find if the price level exists
            const existingIndex = existingOrderbook.b.findIndex(([p]) => p === price);
            
            if (existingIndex >= 0) {
              // Update existing price level
              existingOrderbook.b[existingIndex] = [price, size];
            } else {
              // Add new price level and sort
              existingOrderbook.b.push([price, size]);
              existingOrderbook.b.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])); // Sort descending
            }
          }
        }

        // Update asks
        for (const [price, size] of data.a) {
          if (parseFloat(size) === 0) {
            // Remove the price level
            existingOrderbook.a = existingOrderbook.a.filter(([p]) => p !== price);
          } else {
            // Find if the price level exists
            const existingIndex = existingOrderbook.a.findIndex(([p]) => p === price);
            
            if (existingIndex >= 0) {
              // Update existing price level
              existingOrderbook.a[existingIndex] = [price, size];
            } else {
              // Add new price level and sort
              existingOrderbook.a.push([price, size]);
              existingOrderbook.a.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])); // Sort ascending
            }
          }
        }

        // Update sequence and update ID
        existingOrderbook.u = data.u;
        existingOrderbook.seq = data.seq;
        existingOrderbook.cts = data.cts;
      }
    } catch (error) {
      this.logger.error(`Error al procesar mensaje de orderbook: ${error.message}`);
    }
  }

  // Public methods for API endpoints

  /**
   * Subscribe to an orderbook topic
   * @param symbol The trading pair symbol (e.g., BTCUSDT)
   * @param depth The orderbook depth (1, 50, 200, 500)
   * @param clientId A unique identifier for the client
   */
  subscribeToOrderbook(symbol: string, depth: number, clientId: string): void {
    const validDepths = [1, 50, 200, 500];
    if (!validDepths.includes(depth)) {
      throw new Error(`Profundidad inválida: ${depth}. Valores válidos: ${validDepths.join(', ')}`);
    }

    const topic = `orderbook.${depth}.${symbol}`;
    
    // Add to active subscriptions
    if (!this.activeSubscriptions.has(topic)) {
      this.activeSubscriptions.set(topic, new Set());
    }
    
    const clients = this.activeSubscriptions.get(topic);
    const isNewSubscription = clients.size === 0;
    
    clients.add(clientId);
    
    // Only send subscription message if this is the first client
    if (isNewSubscription) {
      this.subscribe(topic);
    }
  }

  /**
   * Unsubscribe from an orderbook topic
   * @param symbol The trading pair symbol
   * @param depth The orderbook depth
   * @param clientId The client identifier
   */
  unsubscribeFromOrderbook(symbol: string, depth: number, clientId: string): void {
    const topic = `orderbook.${depth}.${symbol}`;
    
    if (this.activeSubscriptions.has(topic)) {
      const clients = this.activeSubscriptions.get(topic);
      clients.delete(clientId);
      
      // If no more clients are subscribed, unsubscribe from the topic
      if (clients.size === 0) {
        this.unsubscribe(topic);
      }
    }
  }

  /**
   * Get the current orderbook for a symbol
   * @param symbol The trading pair symbol
   */
  getOrderbook(symbol: string): OrderbookData | null {
    return this.orderbooks.get(symbol) || null;
  }

  private subscribe(topic: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        op: 'subscribe',
        args: [topic],
      };
      
      this.ws.send(JSON.stringify(message));
      this.logger.log(`Suscrito a: ${topic}`);
    } else {
      this.logger.warn(`No se puede suscribir a ${topic}: WebSocket no está conectado`);
    }
  }

  private unsubscribe(topic: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        op: 'unsubscribe',
        args: [topic],
      };
      
      this.ws.send(JSON.stringify(message));
      this.logger.log(`Desuscrito de: ${topic}`);
    }
  }
} 