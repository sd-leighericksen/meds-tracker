import type { ServerResponse } from 'node:http';

const clients = new Set<ServerResponse>();

export function sseAddClient(res: ServerResponse): void {
  clients.add(res);
}

export function sseRemoveClient(res: ServerResponse): void {
  clients.delete(res);
}

export function sseBroadcast(): void {
  for (const res of clients) {
    try {
      res.write('event: change\ndata: {}\n\n');
    } catch {
      clients.delete(res);
    }
  }
}
