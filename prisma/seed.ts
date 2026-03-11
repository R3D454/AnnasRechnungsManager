import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo user
  const passwordHash = await bcrypt.hash("annas_password", 12);
  const user = await prisma.user.upsert({
    where: { email: "anna@example.de" },
    update: {},
    create: {
      email: "anna@example.de",
      passwordHash,
      name: "Anna Musterfrau",
    },
  });
  console.log(`✓ User created: ${user.email}`);

  // Create demo company
  const company = await prisma.company.upsert({
    where: { id: "demo-company-1" },
    update: {},
    create: {
      id: "demo-company-1",
      name: "Muster GmbH",
      legalForm: "GmbH",
      taxId: "123/456/78901",
      vatId: "DE123456789",
      address: "Musterstraße 1",
      zip: "10115",
      city: "Berlin",
      email: "info@muster-gmbh.de",
      phone: "+49 30 12345678",
      bankName: "Musterbank",
      bankIban: "DE89 3704 0044 0532 0130 00",
      bankBic: "COBADEFFXXX",
      invoicePrefix: "RE",
      userId: user.id,
    },
  });
  console.log(`✓ Company created: ${company.name}`);

  // Create demo customer
  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer-1" },
    update: {},
    create: {
      id: "demo-customer-1",
      companyId: company.id,
      name: "Beispiel AG",
      address: "Beispielweg 5",
      zip: "20095",
      city: "Hamburg",
      email: "kontakt@beispiel-ag.de",
    },
  });
  console.log(`✓ Customer created: ${customer.name}`);

  // Create demo invoice
  const invoice = await prisma.invoice.upsert({
    where: { id: "demo-invoice-1" },
    update: {},
    create: {
      id: "demo-invoice-1",
      number: "RE-2024-001",
      companyId: company.id,
      customerId: customer.id,
      issueDate: new Date("2024-01-15"),
      deliveryDate: new Date("2024-01-15"),
      dueDate: new Date("2024-02-14"),
      status: "SENT",
      netTotal: 1000.0,
      taxTotal: 190.0,
      grossTotal: 1190.0,
      items: {
        create: [
          {
            position: 1,
            description: "Buchhaltungsleistungen Januar 2024",
            quantity: 10,
            unit: "h",
            unitPrice: 100.0,
            taxRate: 19.0,
            netAmount: 1000.0,
            taxAmount: 190.0,
            grossAmount: 1190.0,
          },
        ],
      },
    },
  });
  console.log(`✓ Invoice created: ${invoice.number}`);

  // Update company sequence
  await prisma.company.update({
    where: { id: company.id },
    data: { invoiceSequence: 1 },
  });

  console.log("\n✅ Seed complete!");
  console.log("Login: anna@example.de / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
