export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageCallbacks: ((message: any) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // 3 seconds

  connect(orderId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(`ws://139.179.211.2:3000`);

      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        
        // Join the order's chat room
        this.ws?.send(JSON.stringify({
          type: 'join',
          orderId: orderId
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);
          this.messageCallbacks.forEach(callback => callback(message));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket Disconnected:', event.code, event.reason);
        this.handleDisconnect(orderId);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleDisconnect(orderId);
    }
  }

  private handleDisconnect(orderId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      setTimeout(() => this.connect(orderId), this.reconnectDelay);
    } else {
      console.log('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      // Reset reconnect attempts when intentionally disconnecting
      this.reconnectAttempts = this.maxReconnectAttempts;
      
      // Send a leave message if still connected
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'leave'
        }));
      }

      this.ws.close();
      this.ws = null;
    }
  }

  sendMessage(message: any) {
    if (!this.ws) {
      console.error('No WebSocket connection');
      return;
    }

    try {
      switch (this.ws.readyState) {
        case WebSocket.CONNECTING:
          console.log('WebSocket is still connecting. Message queued.');
          setTimeout(() => this.sendMessage(message), 1000);
          break;
        
        case WebSocket.OPEN:
          this.ws.send(JSON.stringify(message));
          break;
        
        case WebSocket.CLOSING:
        case WebSocket.CLOSED:
          console.error('WebSocket is not open');
          break;
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallbacks.push(callback);
  }

  removeMessageCallback(callback: (message: any) => void) {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getState(): string {
    switch (this.ws?.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'OPEN';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'NOT_INITIALIZED';
    }
  }
}

export const websocketService = new WebSocketService();