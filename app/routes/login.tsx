import { Form, useActionData, useNavigation, redirect } from "react-router";
import { login, createUserSession, getUserSession } from "@/session.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, AlertCircle } from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const { userId } = await getUserSession(request);
  if (userId) throw redirect("/");
  return null;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await login(email, password);
  if (!user) return { error: "E-Mail oder Passwort falsch." };

  return createUserSession(user.id, user.name, "/");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const loading = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Annas Rechnungsmanager</h1>
          <p className="text-gray-500 mt-1">Buchhaltung & Rechnungsverwaltung</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>Geben Sie Ihre Zugangsdaten ein</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-4">
              {actionData?.error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {actionData.error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="anna@example.de"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Anmelden..." : "Anmelden"}
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
