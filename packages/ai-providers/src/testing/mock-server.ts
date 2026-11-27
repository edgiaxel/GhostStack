import type { FetchLike } from '../platform';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface Scripted {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Wait before answering. */
  delayMs?: number;
  /** Close the socket without answering. */
  reset?: boolean;
  /** Send headers and part of a body, then never finish. */
  hang?: boolean;
}

export type Script = (request: RecordedRequest, index: number) => Scripted;

export interface MockServer {
  url: string;
  requests: RecordedRequest[];
  setScript(script: Script): void;
  close(): Promise<void>;
}

/** A local HTTP server on 127.0.0.1 and an ephemeral port. Tests make no other connection. */
export async function startMockServer(initial: Script): Promise<MockServer> {
  let script = initial;
  const requests: RecordedRequest[] = [];
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = chunks.map((c) => new TextDecoder().decode(c)).join('');
      const recorded: RecordedRequest = {
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body,
      };
      requests.push(recorded);
      const reply = script(recorded, requests.length - 1);
      const send = (): void => {
        if (reply.reset) {
          req.socket.destroy();
          return;
        }
        if (reply.hang) {
          res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
          res.write('{"partial":');
          return;
        }
        res.writeHead(reply.status ?? 200, { 'content-type': 'application/json', ...reply.headers });
        res.end(reply.body ?? '');
      };
      if (reply.delayMs) setTimeout(send, reply.delayMs);
      else send();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    setScript: (next) => {
      script = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/**
 * Wraps the platform `fetch` and refuses any address except loopback, so a test that reaches for
 * the internet fails instead of connecting.
 */
export function loopbackOnlyFetch(): FetchLike {
  return (url, init) => {
    const host = /^https?:\/\/([^/:]+|\[[^\]]+\])/.exec(url)?.[1] ?? '';
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error(`Test attempted a non-loopback request: ${host}`);
    }
    return fetch(url, init);
  };
}
