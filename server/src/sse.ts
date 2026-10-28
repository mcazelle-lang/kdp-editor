import type { Response } from 'express';

/** Ouvre un flux Server-Sent Events ; le signal est annulé si le client se déconnecte avant la fin. */
export function openSse<E extends { type: string }>(res: Response) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  const ping = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);
  return {
    signal: controller.signal,
    send(e: E) {
      if (!res.writableEnded) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    },
    close() {
      clearInterval(ping);
      res.end();
    },
  };
}
