import { Form, useActionData, useNavigation } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import bcrypt from "bcryptjs";
import { log } from "@/lib/logger.server";
import { Button } from "@/components/ui/button";
import { KeyRound, CheckCircle2 } from "lucide-react";

export const handle = {
  breadcrumbs: () => [{ label: "Passwort ändern" }],
};

export async function loader({ request }: { request: Request }) {
  await requireUser(request);
  return null;
}

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const form = await request.formData();

  const current = form.get("current") as string;
  const next = form.get("next") as string;
  const confirm = form.get("confirm") as string;

  if (!current || !next || !confirm) {
    return { error: "Alle Felder sind erforderlich." };
  }

  if (next.length < 8) {
    return { error: "Das neue Passwort muss mindestens 8 Zeichen lang sein." };
  }

  if (next !== confirm) {
    return { error: "Die neuen Passwörter stimmen nicht überein." };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "Benutzer nicht gefunden." };

  const valid = await bcrypt.compare(current, dbUser.passwordHash);
  if (!valid) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }

  const passwordHash = await bcrypt.hash(next, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await log({ userId: user.id, action: "CHANGE_PASSWORD", entity: "User", entityId: user.id, request });

  return { success: true };
}

export default function ChangePasswordPage() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <KeyRound className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Passwort ändern</h1>
        </div>
        <p className="text-slate-500 text-sm">Geben Sie Ihr aktuelles und ein neues Passwort ein.</p>
      </div>

      {result?.success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-3 text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="font-medium">Passwort erfolgreich geändert.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {result?.error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {result.error}
            </div>
          )}

          <Form method="post" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="current">
                Aktuelles Passwort
              </label>
              <input
                id="current"
                name="current"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="next">
                Neues Passwort
              </label>
              <input
                id="next"
                name="next"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <p className="text-xs text-slate-400 mt-1">Mindestens 8 Zeichen.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="confirm">
                Neues Passwort bestätigen
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? "Wird gespeichert…" : "Passwort ändern"}
            </Button>
          </Form>
        </div>
      )}
    </div>
  );
}
