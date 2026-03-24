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
            username: "anna",
            passwordHash,
            name: "Anna Musterfrau",
            role: "ADMIN",
        },
    });
    console.log(`✓ User created: ${user.email} (username: ${user.username}, role: ${user.role})`);
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
    const invoice2 = await prisma.invoice.upsert({
        where: { id: "demo-invoice-2" },
        update: {},
        create: {
            id: "demo-invoice-2",
            number: "RE-2024-002",
            companyId: company.id,
            customerId: customer.id,
            issueDate: new Date("2026-02-15"),
            deliveryDate: new Date("2026-02-15"),
            dueDate: new Date("2026-03-14"),
            status: "PAID",
            netTotal: 2000.0,
            taxTotal: 380.0,
            grossTotal: 2380.0,
            items: {
                create: [
                    {
                        position: 1,
                        description: "Buchhaltungsleistungen Februar 2024",
                        quantity: 10,
                        unit: "h",
                        unitPrice: 200.0,
                        taxRate: 19.0,
                        netAmount: 2000.0,
                        taxAmount: 380.0,
                        grossAmount: 2380.0,
                    },
                ],
            },
        },
    });
    console.log(`✓ Invoice created: ${invoice2.number}`);
    // Update company sequence
    await prisma.company.update({
        where: { id: company.id },
        data: { invoiceSequence: 1 },
    });
    // Seed BuchungKategorien for demo company
    const einnahmeKategorien = [
        "Fußpflege",
        "Privateinlagen",
        "Darlehen",
        "Steuererstattungen",
        "Versicherungserstattungen",
        "Zinsertrage",
        "Vermietung/Verpachtung",
        "Veräußerungserlös",
        "Eigenverbrauch",
        "Sonstige Einnahmen",
    ];
    const ausgabeKategorien = [
        "Waren und Rohstoffe",
        "Geringwertige Wirtschaftsgüter",
        "Abschreibungen",
        "Miete",
        "Strom und Wasser",
        "Telekommunikation",
        "Fortbildung und Messen",
        "Beiträge",
        "Versicherungen",
        "Werbekosten",
        "Zinsen",
        "Reisekosten",
        "Reparaturen und Instandhaltung",
        "Bürobedarf",
        "Repräsentationskosten",
        "Sonstiger Betriebsbedarf",
        "Nebenkosten Geldverkehr",
    ];
    for (const name of einnahmeKategorien) {
        await prisma.buchungKategorie.upsert({
            where: { companyId_name_typ: { companyId: company.id, name, typ: "EINNAHME" } },
            update: {},
            create: { companyId: company.id, name, typ: "EINNAHME" },
        });
    }
    console.log(`✓ Seeded ${einnahmeKategorien.length} Einnahme categories`);
    for (const name of ausgabeKategorien) {
        await prisma.buchungKategorie.upsert({
            where: { companyId_name_typ: { companyId: company.id, name, typ: "AUSGABE" } },
            update: {},
            create: { companyId: company.id, name, typ: "AUSGABE" },
        });
    }
    console.log(`✓ Seeded ${ausgabeKategorien.length} Ausgabe categories`);
    console.log("\n✅ Seed complete!");
    console.log("Login: anna@example.de / annas_password");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
