import { Link, useLoaderData } from "react-router";
import { requireAdmin } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { UserPlus, Shield, User } from "lucide-react";

export async function loader({ request }: { request: Request }) {
  await requireAdmin(request);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { companies: true } },
    },
  });
  return {
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  };
}

export default function AdminUsersPage() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Benutzerverwaltung</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} Benutzer registriert</p>
        </div>
        <Link
          to="/admin/users/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}
        >
          <UserPlus className="w-4 h-4" />
          Neuer Benutzer
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Benutzername</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">E-Mail</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Rolle</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Firmen</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Erstellt</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                style={{ borderBottom: i < users.length - 1 ? "1px solid #f1f5f9" : "none" }}
              >
                <td className="px-5 py-3.5 font-medium text-slate-800">{user.name}</td>
                <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{user.username}</td>
                <td className="px-5 py-3.5 text-slate-600">{user.email}</td>
                <td className="px-5 py-3.5">
                  {user.role === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      <User className="w-3 h-3" /> Benutzer
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{user._count.companies}</td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                  >
                    Bearbeiten
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
