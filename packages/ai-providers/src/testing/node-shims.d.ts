/** Type declarations for the few Node modules the tests use. The package does not depend on @types/node. */

declare module 'node:http' {
  interface Socket {
    destroy(): void;
  }
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    socket: Socket;
    on(event: 'data', listener: (chunk: Uint8Array) => void): this;
    on(event: 'end', listener: () => void): this;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): this;
    write(chunk: string): boolean;
    end(body?: string): void;
    destroy(): void;
  }
  export interface Server {
    listen(port: number, host: string, callback: () => void): this;
    address(): { port: number } | string | null;
    close(callback?: () => void): this;
    closeAllConnections(): void;
  }
  export function createServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Server;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}

interface ImportMeta {
  readonly url: string;
}

declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare function fetch(
  url: string,
  init?: unknown,
): Promise<{
  readonly status: number;
  readonly ok: boolean;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;
declare class TextDecoder {
  decode(input?: Uint8Array): string;
}
declare class AbortController {
  readonly signal: {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
    removeEventListener(type: 'abort', listener: () => void): void;
  };
  abort(): void;
}
