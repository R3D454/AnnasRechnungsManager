import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
  Link,
} from "react-router";
import { requireAdmin } from "@/session.server";
import { log } from "@/lib/logger.server";
import prisma from "@/lib/prisma.server";
import bcrypt from "bcryptjs";
import { AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  await requireAdmin(request);
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, username: true, email: true, role: true },
  });
  if (!user) throw new Response("Nicht gefunden", { status: 404 });
  return { user };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    if (params.id === admin.id) {
      return { error: "Sie können Ihr eigenes Konto nicht löschen." };
    }
    await prisma.user.delete({ where: { id: params.id } });
    await log({
      userId: admin.id,
      action: "DELETE_USER",
      entity: "User",
      entityId: params.id,
      request,
    });
    return redirect("/admin/users");
  }

  // intent === "update"
  const name = (formData.get("name") as string).trim();
  const username = (formData.get("username") as string).trim().toLowerCase();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const role = formData.get("role") as "USER" | "ADMIN";
  const password = (formData.get("password") as string).trim();

  if (!name || !username || !email) {
    return { error: "Name, Benutzername und E-Mail sind Pflichtfelder." };
  }

  const conflict = await prisma.user.findFirst({
    where: {
      AND: [
        { id: { not: params.id } },
        { OR: [{ email }, { username }] },
      ],
    },
  });
  if (conflict) {
    return { error: "E-Mail oder Benutzername bereits von einem anderen Nutzer vergeben." };
  }

  const updateData: Record<string, unknown> = {
    name,
    username,
    email,
    role: role === "ADMIN" ? "ADMIN" : "USER",
  };

  if (password) {
    if (password.length < 8) {
      return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
    }
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({ where: { id: params.id }, data: updateData });
  await log({
    userId: admin.id,
    action: "UPDATE_USER",
    entity: "User",
    entityId: params.id,
    metadata: { name, username, email, role, passwordChanged: !!password },
    request,
  });

  return redirect("/admin/users");
}

export default function AdminUserEditPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const loading = navigation.state === "submitting";

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/users" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Benutzer bearbeiten</h1>
          <p className="text-slate-500 text-sm mt-0.5">{user.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update" />

          {actionData?.error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              {actionData.error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" defaultValue={user.name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Benutzername</Label>
              <Input id="username" name="username" type="text" defaultValue={user.username} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" defaultValue={user.email} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Neues Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Leer lassen, um Passwort beizubehalten"
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Rolle</Label>
            <select
              id="role"
              name="role"
              defaultValue={user.role}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="USER">Benutzer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Speichern..." : "Speichern"}
            </Button>
            <Link to="/admin/users">
              <Button type="button" variant="outline">Abbrechen</Button>
            </Link>
          </div>
        </Form>
      </div>

      {/* Delete zone */}
      <div className="mt-6 bg-white rounded-xl border border-red-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Benutzer löschen</h2>
        <p className="text-xs text-slate-500 mb-4">
          Löscht den Benutzer und alle zugehörigen Firmen, Kunden und Rechnungen unwiderruflich.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <Button
            type="submit"
            variant="destructive"
            className="flex items-center gap-2 text-sm"
            disabled={loading}
            onClick={(e) => {
              if (!confirm(`Benutzer "${user.name}" wirklich löschen?`)) e.preventDefault();
            }}
          >
            <Trash2 className="w-4 h-4" />
            Benutzer löschen
          </Button>
        </Form>
      </div>
    </div>
  );
}
