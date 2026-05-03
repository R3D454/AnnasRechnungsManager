import { startCleanupScheduler } from "./lib/cleanup.server";
import { initializeDatabase } from "./lib/db-init.server";
import { logStartupError, logError } from "./lib/error-logger.server";
import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

startCleanupScheduler();

// Initialize database: run migrations on startup
initializeDatabase().catch((error) => {
  logStartupError(error);
  process.exit(1);
});

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");
    const readyCallback = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [readyCallback]() {
          shellRendered = true;
          const body = new PassThrough();
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          logError("SHELL_ERROR", error, {
            request,
            route: new URL(request.url).pathname,
          });
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            logError("RENDER_ERROR", error, {
              request,
              route: new URL(request.url).pathname,
            });
          }
        },
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
