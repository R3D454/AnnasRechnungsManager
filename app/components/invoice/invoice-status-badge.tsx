import { Badge } from "@/components/ui/badge";
import { InvoiceStatus } from "@prisma/client";

const statusConfig: Record<InvoiceStatus, { label: string; variant: "secondary" | "default" | "success" | "destructive" | "warning" }> = {
  DRAFT: { label: "Entwurf", variant: "secondary" },
  SENT: { label: "Versendet", variant: "warning" },
  PAID: { label: "Bezahlt", variant: "success" },
  CANCELLED: { label: "Storniert", variant: "destructive" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
