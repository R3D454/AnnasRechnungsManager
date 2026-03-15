import { Form, useActionData, useNavigation, redirect } from "react-router";
import { login, createUserSession, getUserSession } from "@/session.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export async function loader({ request }: { request: Request }) {
  const { userId } = await getUserSession(request);
  if (userId) throw redirect("/");
  return null;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const identifier = formData.get("identifier") as string;
  const password = formData.get("password") as string;

  const user = await login(identifier, password, request);
  if (!user) return { error: "Benutzername/E-Mail oder Passwort falsch." };

  return createUserSession(user.id, user.name, user.role, "/");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const loading = navigation.state === "submitting";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: "var(--sidebar-bg)" }}>
        <div className="absolute inset-0">
          {/* Decorative gradient blobs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute top-2/3 left-1/3 w-32 h-32 bg-blue-600/15 rounded-full blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-14">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg">Rechnungsmanager</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Buchhaltung<br />
            <span className="text-indigo-400">einfach gemacht.</span>
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            Verwalten Sie Mandanten, erstellen Sie Rechnungen und behalten Sie den Überblick über alle Zahlungen.
          </p>

          <div className="mt-12 space-y-4">
            {[
              { label: "Mandantenverwaltung", desc: "Alle Firmen im Blick" },
              { label: "Rechnungserstellung", desc: "Schnell und professionell" },
              { label: "Zahlungsübersicht", desc: "Offene Posten auf einen Blick" },
            ].map((feat) => (
              <div key={feat.label} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <div>
                  <span className="text-slate-200 text-sm font-medium">{feat.label}</span>
                  <span className="text-slate-500 text-sm"> — {feat.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-base">Rechnungsmanager</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Willkommen zurück</h1>
            <p className="text-slate-500 mt-1 text-sm">Benutzername oder E-Mail und Passwort eingeben</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <Form method="post" className="space-y-5">
              {actionData?.error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 p-3.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  {actionData.error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="identifier">Benutzername oder E-Mail</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="anna oder anna@example.de"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-10 mt-2" disabled={loading}>
                {loading ? "Anmelden..." : "Anmelden"}
              </Button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
