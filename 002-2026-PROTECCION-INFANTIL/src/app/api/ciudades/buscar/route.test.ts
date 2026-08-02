import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { normalizarNombreGeografico } from "@/lib/normalizar";

/**
 * SPEC-115: tests de integración de GET /api/ciudades/buscar.
 * Fixture autocontenido: país ficticio "ZT"/"ZU" con ciudades propias; se limpia en
 * afterAll. El endpoint es público (sin cookie) y el rate-limit real corre contra la
 * BD de test (scope ciudades_buscar: 60 req/60 s por defecto — no estorba).
 */
describe("GET /api/ciudades/buscar (SPEC-115)", () => {
    let paisId: string;
    let otroPaisId: string;
    let departamentoId: string;
    const ciudadIds: string[] = [];
    // La suite corre con DISABLE_RATE_LIMIT=true (.env.test): lo activamos para este
    // archivo para poder verificar que el rate-limit real no rompe la búsqueda.
    const prevDisableRateLimit = process.env.DISABLE_RATE_LIMIT;

    beforeAll(async () => {
        process.env.DISABLE_RATE_LIMIT = "false";
        const pais = await prisma.pais.upsert({
            where: { codigo: "ZT" },
            update: {},
            create: { codigo: "ZT", nombre: "Testlandia" },
        });
        paisId = pais.id;
        const otroPais = await prisma.pais.upsert({
            where: { codigo: "ZU" },
            update: {},
            create: { codigo: "ZU", nombre: "Otralandia" },
        });
        otroPaisId = otroPais.id;
        const dep = await prisma.departamento.upsert({
            where: { codigo: "ZT.01" },
            update: {},
            create: { codigo: "ZT.01", nombre: "Testioquia", paisId },
        });
        departamentoId = dep.id;

        const ciudades = [
            { nombre: "Medellín", poblacion: 1000, departamentoId },
            { nombre: "Amed", poblacion: 999999, departamentoId }, // más poblada pero NO es prefijo de "med"
            { nombre: "Medina", poblacion: 500, departamentoId: null },
            { nombre: "San José del Test", poblacion: 10, departamentoId },
        ];
        for (const c of ciudades) {
            const creada = await prisma.ciudad.create({
                data: {
                    nombre: c.nombre,
                    nombreNormalizado: normalizarNombreGeografico(c.nombre),
                    poblacion: c.poblacion,
                    paisId,
                    departamentoId: c.departamentoId,
                    lat: 1.5,
                    lng: -75.5,
                },
            });
            ciudadIds.push(creada.id);
        }
        // Mismo nombre en otro país: no debe cruzarse el filtro paisId
        const foranea = await prisma.ciudad.create({
            data: {
                nombre: "Medellín",
                nombreNormalizado: normalizarNombreGeografico("Medellín"),
                paisId: otroPaisId,
                lat: 2,
                lng: -70,
            },
        });
        ciudadIds.push(foranea.id);
    });

    afterAll(async () => {
        if (prevDisableRateLimit === undefined) {
            delete process.env.DISABLE_RATE_LIMIT;
        } else {
            process.env.DISABLE_RATE_LIMIT = prevDisableRateLimit;
        }
        await prisma.ciudad.deleteMany({ where: { id: { in: ciudadIds } } });
        await prisma.departamento.deleteMany({ where: { paisId } });
        await prisma.pais.deleteMany({ where: { codigo: { in: ["ZT", "ZU"] } } });
        await prisma.$disconnect();
    });

    function llamar(params: string) {
        return GET(new Request(`http://localhost/api/ciudades/buscar?${params}`));
    }

    it("encuentra una ciudad escribiendo sin tildes y sin autenticación", async () => {
        const res = await llamar(`q=medellin&paisId=${paisId}`);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ciudades.length).toBeGreaterThan(0);
        expect(json.ciudades[0].nombre).toBe("Medellín");
        expect(json.ciudades[0].departamento).toBe("Testioquia");
    });

    it("ordena prefijo primero aunque otra ciudad sea más poblada", async () => {
        const res = await llamar(`q=med&paisId=${paisId}`);
        const json = await res.json();
        const nombres = json.ciudades.map((c: { nombre: string }) => c.nombre);
        expect(nombres[0]).toBe("Medellín");
        expect(nombres).toContain("Medina");
        expect(nombres).toContain("Amed");
        expect(nombres.indexOf("Medellín")).toBeLessThan(nombres.indexOf("Amed"));
    });

    it("respeta el límite de resultados", async () => {
        const res = await llamar(`q=med&paisId=${paisId}&limit=1`);
        const json = await res.json();
        expect(json.ciudades).toHaveLength(1);
    });

    it("respeta el filtro por país (no devuelve la homónima de otro país)", async () => {
        const res = await llamar(`q=medellin&paisId=${paisId}`);
        const json = await res.json();
        expect(json.ciudades.every((c: { paisId: string }) => c.paisId === paisId)).toBe(true);
        expect(json.ciudades).toHaveLength(1);
    });

    it("respeta el filtro por departamento", async () => {
        const res = await llamar(`q=med&paisId=${paisId}&departamentoId=${departamentoId}`);
        const json = await res.json();
        const nombres = json.ciudades.map((c: { nombre: string }) => c.nombre);
        expect(nombres).toContain("Medellín");
        expect(nombres).not.toContain("Medina"); // sin departamento
    });

    it("rechaza parámetros inválidos con 400", async () => {
        expect((await llamar(`q=m&paisId=${paisId}`)).status).toBe(400);
        expect((await llamar("q=medellin")).status).toBe(400);
        expect((await llamar(`q=medellin&paisId=${paisId}&limit=999`)).status).toBe(400);
    });

    it("el rate-limit no rompe la búsqueda y expone sus headers", async () => {
        const res = await llamar(`q=san jose&paisId=${paisId}`);
        expect(res.status).toBe(200);
        expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
        const json = await res.json();
        expect(json.ciudades[0].nombre).toBe("San José del Test");
    });
});
