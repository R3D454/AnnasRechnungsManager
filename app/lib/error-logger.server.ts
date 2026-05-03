/**
 * Comprehensive server-side error logging for debugging
 * Captures errors with full context: stack traces, request details, environment
 */

export interface ErrorContext {
  request?: Request;
  userId?: string | null;
  route?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorLogEntry {
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  context?: {
    method?: string;
    url?: string;
    route?: string;
    userId?: string | null;
    ipAddress?: string | null;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  };
  environment: string;
}

/**
 * Extract error message and stack from any error type
 */
function extractErrorInfo(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    return {
      message: (err.message as string) || String(error),
      stack: (err.stack as string) || undefined,
    };
  }

  return { message: String(error) };
}

/**
 * Extract request context
 */
function extractRequestContext(
  request?: Request
): ErrorLogEntry["context"] {
  if (!request) return {};

  const url = new URL(request.url);
  const ipAddress =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent");

  return {
    method: request.method,
    url: url.pathname + url.search,
    ipAddress,
    userAgent: userAgent ?? undefined,
  };
}

/**
 * Build comprehensive error log entry
 */
function buildErrorLogEntry(
  type: string,
  error: unknown,
  context?: ErrorContext
): ErrorLogEntry {
  const { message, stack } = extractErrorInfo(error);
  const requestContext = extractRequestContext(context?.request);

  return {
    timestamp: new Date().toISOString(),
    type,
    message,
    stack,
    context: {
      ...requestContext,
      route: context?.route,
      userId: context?.userId,
      metadata: context?.metadata,
    },
    environment: process.env.NODE_ENV || "development",
  };
}

/**
 * Format error log for console output
 */
function formatErrorLog(entry: ErrorLogEntry): string {
  const parts = [
    `[${entry.type}]`,
    `${entry.timestamp}`,
    entry.message,
  ];

  if (entry.context?.route) parts.push(`route: ${entry.context.route}`);
  if (entry.context?.method && entry.context?.url) {
    parts.push(`${entry.context.method} ${entry.context.url}`);
  }
  if (entry.context?.userId) parts.push(`user: ${entry.context.userId}`);
  if (entry.context?.ipAddress) parts.push(`ip: ${entry.context.ipAddress}`);

  let output = parts.join(" | ");

  if (entry.stack) {
    output += "\n" + entry.stack;
  }

  if (entry.context?.metadata) {
    output += "\nMetadata: " + JSON.stringify(entry.context.metadata, null, 2);
  }

  return output;
}

/**
 * Log a route/loader error
 */
export function logRouteError(
  error: unknown,
  context: ErrorContext & { route: string }
): void {
  const entry = buildErrorLogEntry("ROUTE_ERROR", error, context);
  console.error("\n" + "=".repeat(80));
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}

/**
 * Log an action/mutation error
 */
export function logActionError(
  error: unknown,
  context: ErrorContext & { action: string }
): void {
  const entry = buildErrorLogEntry("ACTION_ERROR", error, {
    ...context,
    metadata: {
      action: context.action,
      ...context.metadata,
    },
  });
  console.error("\n" + "=".repeat(80));
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}

/**
 * Log a database error
 */
export function logDatabaseError(
  error: unknown,
  operation: string,
  context?: Omit<ErrorContext, "metadata">
): void {
  const entry = buildErrorLogEntry("DATABASE_ERROR", error, {
    ...context,
    metadata: { operation },
  });
  console.error("\n" + "=".repeat(80));
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}

/**
 * Log an API error
 */
export function logApiError(
  error: unknown,
  context: ErrorContext & { endpoint: string; statusCode?: number }
): void {
  const entry = buildErrorLogEntry("API_ERROR", error, {
    ...context,
    metadata: {
      endpoint: context.endpoint,
      statusCode: context.statusCode || 500,
      ...context.metadata,
    },
  });
  console.error("\n" + "=".repeat(80));
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}

/**
 * Log a server startup error
 */
export function logStartupError(error: unknown): void {
  const entry = buildErrorLogEntry("STARTUP_ERROR", error);
  console.error("\n" + "=".repeat(80));
  console.error("🚨 CRITICAL: Server failed to start");
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}

/**
 * Log a generic error with type
 */
export function logError(
  type: string,
  error: unknown,
  context?: ErrorContext
): void {
  const entry = buildErrorLogEntry(type, error, context);
  console.error("\n" + "=".repeat(80));
  console.error(formatErrorLog(entry));
  console.error("=".repeat(80) + "\n");
}
