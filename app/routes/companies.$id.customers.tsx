import { useState } from "react";
import { Link, useLoaderData, useParams, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Edit, Trash2, ChevronLeft, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Pflichtfeld"),
  vatId: z.string().optional(),
  address: z.string().min(1, "Pflichtfeld"),
  zip: z.string().min(1, "Pflichtfeld"),
  city: z.string().min(1, "Pflichtfeld"),
  country: z.string().optional(),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Customer {
  id: string;
  name: string;
  vatId?: string | null;
  address: string;
  zip: string;
  city: string;
  email?: string | null;
  phone?: string | null;
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const customers = await prisma.customer.findMany({
    where: { companyId: params.id },
    orderBy: { name: "asc" },
  });

  return { customers, companyId: params.id };
}

function CustomerForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (d: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "DE", ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Name *</Label>
          <Input {...register("name")} placeholder="Beispiel AG" />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Straße & Nr. *</Label>
          <Input {...register("address")} placeholder="Musterstr. 1" />
          {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>PLZ *</Label>
          <Input {...register("zip")} placeholder="10115" />
        </div>
        <div className="space-y-1.5">
          <Label>Ort *</Label>
          <Input {...register("city")} placeholder="Berlin" />
        </div>
        <div className="space-y-1.5">
          <Label>USt-IdNr.</Label>
          <Input {...register("vatId")} placeholder="DE..." />
        </div>
        <div className="space-y-1.5">
          <Label>E-Mail</Label>
          <Input {...register("email")} type="email" placeholder="kontakt@..." />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Telefon</Label>
          <Input {...register("phone")} placeholder="+49..." />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Speichern..." : submitLabel}</Button>
      </div>
    </form>
  );
}

export default function CustomersPage() {
  const { customers, companyId } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [open, setOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  async function handleCreate(data: FormData) {
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, companyId }),
    });
    setOpen(false);
    revalidate();
  }

  async function handleEdit(data: FormData) {
    if (!editCustomer) return;
    await fetch(`/api/customers/${editCustomer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditCustomer(null);
    revalidate();
  }

  async function handleDelete(customerId: string) {
    if (!confirm("Kunden wirklich löschen?")) return;
    await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    revalidate();
  }

  return (
    <div>
      <Link
        to={`/companies/${companyId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zum Mandanten
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
          <p className="text-gray-500 mt-1">{customers.length} Kunden</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Kunde anlegen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuer Kunde</DialogTitle>
            </DialogHeader>
            <CustomerForm onSubmit={handleCreate} submitLabel="Anlegen" />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editCustomer} onOpenChange={(o) => !o && setEditCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunde bearbeiten</DialogTitle>
          </DialogHeader>
          {editCustomer && (
            <CustomerForm
              defaultValues={{
                name: editCustomer.name,
                address: editCustomer.address,
                zip: editCustomer.zip,
                city: editCustomer.city,
                vatId: editCustomer.vatId ?? undefined,
                email: editCustomer.email ?? undefined,
                phone: editCustomer.phone ?? undefined,
              }}
              onSubmit={handleEdit}
              submitLabel="Speichern"
            />
          )}
        </DialogContent>
      </Dialog>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Noch keine Kunden angelegt</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{customer.address}, {customer.zip} {customer.city}</p>
                    {customer.vatId && <p className="text-xs text-gray-400 mt-0.5">USt-IdNr.: {customer.vatId}</p>}
                    <div className="flex gap-3 mt-2">
                      {customer.email && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />{customer.email}
                        </span>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />{customer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditCustomer(customer)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(customer.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
