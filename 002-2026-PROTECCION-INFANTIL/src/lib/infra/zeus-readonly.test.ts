import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

const ZEUS_USER = "zeus_readonly";
const ZEUS_PASSWORD = "ZeusReadOnlyTestPass123!";

async function crearZeusReadonly() {
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(
        `CREATE ROLE ${ZEUS_USER} WITH LOGIN PASSWORD '${ZEUS_PASSWORD.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`
    );
    await prisma.$executeRawUnsafe(`REVOKE ALL ON SCHEMA public FROM ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ZEUS_USER}`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ZEUS_USER}`);
    // Endurecimiento: evitar que PUBLIC cree objetos en public (zeus_readonly hereda de PUBLIC).
    await prisma.$executeRawUnsafe("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await prisma.$executeRawUnsafe("GRANT CREATE ON SCHEMA public TO proteccion");
}

async function eliminarZeusReadonly() {
    await prisma.$executeRawUnsafe(`DROP OWNED BY ${ZEUS_USER} CASCADE`);
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ZEUS_USER}`);
}

async function expectSqlFails(sql: string) {
    await expect(
        prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL ROLE ${ZEUS_USER}`);
            await tx.$executeRawUnsafe(sql);
        })
    ).rejects.toThrow();
}

async function expectSqlOk(sql: string) {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${ZEUS_USER}`);
        await tx.$executeRawUnsafe(sql);
    });
}

describe("zeus_readonly isolation", () => {
    beforeEach(async () => {
        await resetDatabase();
        await eliminarZeusReadonly().catch(() => {
            // ignora si no existía
        });
        await crearZeusReadonly();
    });

    afterEach(async () => {
        await eliminarZeusReadonly().catch(() => {
            // ignora si ya no existe
        });
    });

    it("puede hacer SELECT en tablas del schema public", async () => {
        await expectSqlOk("SELECT 1 FROM \"Reporte\" LIMIT 1");
    });

    it("INSERT es denegado", async () => {
        await expectSqlFails("INSERT INTO \"Reporte\" (id) VALUES ('00000000-0000-0000-0000-000000000000')");
    });

    it("UPDATE es denegado", async () => {
        await expectSqlFails("UPDATE \"Reporte\" SET estado = 'PENDIENTE' WHERE false");
    });

    it("DELETE es denegado", async () => {
        await expectSqlFails("DELETE FROM \"Reporte\" WHERE false");
    });

    it("TRUNCATE es denegado", async () => {
        await expectSqlFails("TRUNCATE \"Reporte\"");
    });

    it("CREATE TABLE es denegado", async () => {
        await expectSqlFails("CREATE TABLE public.zeus_test_table (id int)");
    });

    it("DROP TABLE es denegado", async () => {
        await expectSqlFails("DROP TABLE IF EXISTS \"Reporte\"");
    });

    it("no puede leer pg_shadow", async () => {
        await expectSqlFails("SELECT * FROM pg_shadow LIMIT 1");
    });

    it("no puede leer pg_authid", async () => {
        await expectSqlFails("SELECT * FROM pg_authid LIMIT 1");
    });

    it("puede leer tablas creadas después del setup (default privileges)", async () => {
        await prisma.$executeRawUnsafe("CREATE TABLE public.zeus_future_table_test (id int)");
        try {
            await expectSqlOk("SELECT * FROM public.zeus_future_table_test LIMIT 1");
        } finally {
            await prisma.$executeRawUnsafe("DROP TABLE IF EXISTS public.zeus_future_table_test");
        }
    });
});
