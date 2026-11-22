import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

export type Handler = (request: RecordedRequest, response: ServerResponse) => void;

export interface MockServer {
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  setHandler(handler: Handler): void;
  close(): Promise<void>;
}

export async function startMockServer(initial: Handler): Promise<MockServer> {
  let handler = initial;
  const requests: RecordedRequest[] = [];
  const open = new Set<ServerResponse>();
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const recorded: RecordedRequest = {
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      requests.push(recorded);
      open.add(response);
      response.on('close', () => open.delete(response));
      handler(recorded, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    setHandler(next) {
      handler = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const response of open) response.destroy();
        server.close(() => resolve());
      }),
  };
}

export const sendJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
};

/** An OpenAI-style chat completion carrying `content`. */
export const completion = (content: unknown, finishReason = 'stop') => ({
  choices: [{ finish_reason: finishReason, message: { role: 'assistant', content } }],
});

/** A port nothing listens on: bind, note the port, close. */
export async function closedPort(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}
