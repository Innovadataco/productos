import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { GET as PublicGET } from "./publicos/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

describe("GET /api/config/parametros/publicos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.parametroSistema.create({
            data: {
                clave: "visibility.report_threshold",
                valor: "3",
                tipo: "INTEGER",
                categoria: "VISIBILITY",
                esPublico: true,
            },
        });
    });

    it("returns public parameters without auth", async () => {
        const res = await PublicGET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body["visibility.report_threshold"].valor).toBe(3);
    });
});

describe("GET /api/config/parametros", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("requires authentication", async () => {
        const res = await GET(new Request("http://localhost/api/config/parametros"));
        expect(res.status).toBe(401);
    });
});