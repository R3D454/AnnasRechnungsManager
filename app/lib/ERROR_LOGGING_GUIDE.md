/**
 * Error Logging Usage Examples
 * 
 * Use these patterns in your routes to get better error debugging
 */

// ============================================================================
// PATTERN 1: In a loader (data fetching)
// ============================================================================

import { json, type LoaderFunction } from "react-router";
import { logRouteError } from "@/lib/error-logger.server";
import prisma from "@/lib/prisma.server";

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
    });

    if (!company) {
      throw new Error(`Company not found: ${params.id}`);
    }

    return json({ company });
  } catch (error) {
    logRouteError(error, {
      request,
      route: request.url,
      userId: params.userId, // if available
      metadata: {
        companyId: params.id,
      },
    });
    throw error; // Re-throw to let React Router handle it
  }
};

// ============================================================================
// PATTERN 2: In an action (mutation/form submission)
// ============================================================================

import { logActionError } from "@/lib/error-logger.server";

export const action: LoaderFunction = async ({ request, params }) => {
  try {
    const formData = await request.formData();
    const result = await prisma.company.update({
      where: { id: params.id },
      data: { name: formData.get("name") },
    });
    return json({ success: true, result });
  } catch (error) {
    logActionError(error, {
      request,
      action: "UPDATE_COMPANY",
      metadata: {
        companyId: params.id,
        method: request.method,
      },
    });
    throw error;
  }
};

// ============================================================================
// PATTERN 3: In an API route (POST/PUT/DELETE)
// ============================================================================

import { logApiError } from "@/lib/error-logger.server";

export const action: LoaderFunction = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Validate
    if (!data.name) {
      return json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Process
    const result = await prisma.company.create({ data });
    return json({ success: true, result }, { status: 201 });
  } catch (error) {
    logApiError(error, {
      request,
      endpoint: "/api/companies",
      statusCode: 500,
      metadata: {
        method: request.method,
      },
    });
    return json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

// ============================================================================
// PATTERN 4: Database operations with error context
// ============================================================================

import { logDatabaseError } from "@/lib/error-logger.server";

async function fetchCompanyWithUsers(companyId: string) {
  try {
    return await prisma.company.findUnique({
      where: { id: companyId },
      include: { users: true },
    });
  } catch (error) {
    logDatabaseError(error, "company.findUnique", {
      metadata: { companyId },
    });
    throw error;
  }
}

// ============================================================================
// OUTPUT EXAMPLE (Server Console)
// ============================================================================

/*
================================================================================
[ROUTE_ERROR] | 2026-05-02T22:10:30.123Z | Company not found | route: /companies/123 | GET /companies/123 | user: user-id-456
Stack at Object.loader (file:///app/routes/companies.$id.tsx:12:13)
    at process._tickCallback (internal/timers.ts:203:26)
Metadata: {
  "companyId": "123"
}
================================================================================
*/
