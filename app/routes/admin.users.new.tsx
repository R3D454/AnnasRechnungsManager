import { Form, useActionData, useNavigation, redirect, Link } from "react-router";
import { requireAdmin } from "@/session.server";
import { log } from "@/lib/logger.server";
import prisma from "@/lib/prisma.server";
import bcrypt from "bcryptjs";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  return null;
}

export async function action({ request }: { request: Request }) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string).trim();
  const username = (formData.get("username") as string).trim().toLowerCase();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = formData.get("role") as "USER" | "ADMIN";

  if (!name || !username || !email || !password) {
    return { error: "Alle Felder sind Pflichtfelder." };
  }
  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return { error: "E-Mail oder Benutzername bereits vergeben." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, username, email, passwordHash, role: role === "ADMIN" ? "ADMIN" : "USER" },
  });

  await log({
    userId: admin.id,
    action: "CREATE_USER",
    entity: "User",
    entityId: user.id,
    metadata: { name, username, email, role },
    request,
  });

  return redirect("/admin/users");
}

export default function AdminUsersNewPage() {
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
          <h1 className="text-2xl font-bold text-slate-900">Neuer Benutzer</h1>
          <p className="text-slate-500 text-sm mt-0.5">Zugangsdaten und Rolle festlegen</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Form method="post" className="space-y-4">
          {actionData?.error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              {actionData.error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" placeholder="Anna Musterfrau" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Benutzername</Label>
              <Input id="username" name="username" type="text" placeholder="anna" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" placeholder="anna@example.de" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
            <p className="text-xs text-slate-400">Mindestens 8 Zeichen</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Rolle</Label>
            <select
              id="role"
              name="role"
              defaultValue="USER"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="USER">Benutzer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Erstellen..." : "Benutzer erstellen"}
            </Button>
            <Link to="/admin/users">
              <Button type="button" variant="outline">Abbrechen</Button>
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
