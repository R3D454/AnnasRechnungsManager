/**
 * INTEGRATION EXAMPLE: How to use error logging in your existing routes
 * This shows the new error-logger.server in real-world usage
 */

// Before (old code - minimal logging):
/*
export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });

  try {
    const customer = await prisma.customer.create({ data: parsed.data });
    await log({ userId: user.id, action: "CREATE_CUSTOMER", entity: "Customer", entityId: customer.id, request });
    return Response.json(customer, { status: 201 });
  } catch (error) {
    console.error(error);  // ❌ Not helpful for debugging
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
*/

// After (with comprehensive error logging):
import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { log } from "@/lib/logger.server";
import { logApiError } from "@/lib/error-logger.server";
import { customerSchema } from "@/lib/schemas";

export async function action({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues }, { status: 400 });
    }

    const customer = await prisma.customer.create({ data: parsed.data });
    await log({
      userId: user.id,
      action: "CREATE_CUSTOMER",
      entity: "Customer",
      entityId: customer.id,
      request,
    });
    return Response.json(customer, { status: 201 });
  } catch (error) {
    // ✅ Now with full context: stack trace, request details, metadata
    logApiError(error, {
      request,
      endpoint: "/api/customers",
      userId: user.id,
      statusCode: 500,
      metadata: {
        method: request.method,
      },
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ============================================================================
// WHAT YOU'LL SEE IN THE SERVER LOGS NOW:
// ============================================================================

/*
================================================================================
[API_ERROR] | 2026-05-02T22:15:45.789Z | duplicate entry for unique field 'email'
POST /api/customers | user: user-abc123 | ip: 192.168.1.100 | endpoint: /api/customers | statusCode: 500
Error: Customer with email 'john@example.com' already exists
    at Object.create (file:///app/lib/customer.server.ts:25:13)
    at action (file:///app/routes/api.customers.ts:30:7)
    at processRequest (file:///app/routes/_middleware.ts:12:3)

Metadata: {
  "method": "POST",
  "endpoint": "/api/customers"
}
================================================================================

✓ You can now see:
  - Exact error message with context
  - HTTP method & endpoint
  - User ID & IP address
  - Stack trace for debugging
  - Custom metadata
  - Timestamp
*/
