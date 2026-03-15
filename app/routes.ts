import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),

  layout("routes/dashboard-layout.tsx", [
    index("routes/home.tsx"),
    route("companies", "routes/companies.tsx"),
    route("companies/new", "routes/companies.new.tsx"),
    route("companies/:id", "routes/companies.$id.tsx"),
    route("companies/:id/edit", "routes/companies.$id.edit.tsx"),
    route("companies/:id/customers", "routes/companies.$id.customers.tsx"),
    route("companies/:id/leistungen", "routes/companies.$id.leistungen.tsx"),
    route("companies/:id/invoices", "routes/companies.$id.invoices.tsx"),
    route("companies/:id/invoices/new", "routes/companies.$id.invoices.new.tsx"),
    route("companies/:id/invoices/:invoiceId", "routes/companies.$id.invoices.$invoiceId.tsx"),
    route("companies/:id/invoices/:invoiceId/edit", "routes/companies.$id.invoices.$invoiceId.edit.tsx"),
    route("companies/:id/reports", "routes/companies.$id.reports.tsx"),
    route("archiv", "routes/archiv.tsx"),
    route("settings/password", "routes/settings.password.tsx"),
  ]),

  // Admin routes
  layout("routes/admin-layout.tsx", [
    route("admin/users", "routes/admin.users.tsx"),
    route("admin/users/new", "routes/admin.users.new.tsx"),
    route("admin/users/:id", "routes/admin.users.$id.tsx"),
    route("admin/logs", "routes/admin.logs.tsx"),
  ]),

  // API resource routes
  route("api/companies", "routes/api.companies.ts"),
  route("api/companies/:id", "routes/api.companies.$id.ts"),
  route("api/companies/:id/customers", "routes/api.companies.$id.customers.ts"),
  route("api/companies/:id/invoices", "routes/api.companies.$id.invoices.ts"),
  route("api/customers", "routes/api.customers.ts"),
  route("api/customers/:id", "routes/api.customers.$id.ts"),
  route("api/services", "routes/api.services.ts"),
  route("api/services/:id", "routes/api.services.$id.ts"),
  route("api/invoices", "routes/api.invoices.ts"),
  route("api/invoices/:id", "routes/api.invoices.$id.ts"),
  route("api/invoices/:id/pdf", "routes/api.invoices.$id.pdf.ts"),
  route("api/invoices/:id/xml", "routes/api.invoices.$id.xml.ts"),
  route("api/reports", "routes/api.reports.ts"),
] satisfies RouteConfig;
