import { Response } from 'express';

export interface SSEClient {
  id: string;
  res: Response;
  matchIds?: number[];
}

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  /**
   * Register a new SSE client
   */
  addClient(clientId: string, res: Response, matchIds?: number[]): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection message
    this.sendToClient(res, 'connected', {
      message: 'Connected to live scores',
      timestamp: new Date().toISOString(),
    });

    this.clients.set(clientId, { id: clientId, res, matchIds });

    // Remove client on connection close
    res.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected. Active clients: ${this.clients.size}`);
    });

    console.log(`Client ${clientId} connected. Active clients: ${this.clients.size}`);
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Broadcast score update to all clients interested in a specific match
   */
  broadcastScoreUpdate(matchId: number, scoreData: any): void {
    let sentCount = 0;

    this.clients.forEach((client) => {
      // Send to all clients or only those subscribed to this match
      if (!client.matchIds || client.matchIds.includes(matchId)) {
        this.sendToClient(client.res, 'score-update', {
          matchId,
          ...scoreData,
          timestamp: new Date().toISOString(),
        });
        sentCount++;
      }
    });

    console.log(`Score update broadcasted to ${sentCount} clients for match ${matchId}`);
  }

  /**
   * Broadcast match status change (scheduled -> live -> finished)
   */
  broadcastMatchStatusChange(matchId: number, status: string, matchData: any): void {
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (!client.matchIds || client.matchIds.includes(matchId)) {
        this.sendToClient(client.res, 'match-status', {
          matchId,
          status,
          ...matchData,
          timestamp: new Date().toISOString(),
        });
        sentCount++;
      }
    });

    console.log(`Match status change broadcasted to ${sentCount} clients for match ${matchId}`);
  }

  /**
   * Send heartbeat to all clients to keep connection alive
   */
  sendHeartbeat(): void {
    this.clients.forEach((client) => {
      this.sendToClient(client.res, 'heartbeat', {
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Get number of active clients
   */
  getActiveClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Remove a specific client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.res.end();
      this.clients.delete(clientId);
    }
  }
}

// Singleton instance
export const sseService = new SSEService();

// Send heartbeat every 30 seconds to keep connections alive
setInterval(() => {
  sseService.sendHeartbeat();
}, 30000);
