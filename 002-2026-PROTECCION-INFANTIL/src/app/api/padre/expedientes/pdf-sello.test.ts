/**
 * SPEC-340 (A-68 §4.3 · T031) — el sello del informe, de punta a punta.
 *
 * El contrato de SPEC-234 replicado: el CÓDIGO va impreso (decidido antes);
 * el HASH es del buffer FINAL y jamás entra al PDF. Un byte alterado no
 * verifica; el código impreso sí; y cada generación queda numerada para
 * siempre sin vía de mutación.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name, value: mockToken } : undefined),
    }),
}));

import { GET as getPdf } from "./[id]/pdf/route";
import { GET as getVerificar } from "../../publico/verificar-pdf/[hash]/route";
import { POST as postExpediente } from "./route";
import { POST as postReporte } from "../../reportes/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { createHash } from "node:crypto";

function reqVerificar(hash: string): [Request, { params: Promise<{ hash: string }> }] {
    return [
        new Request(`http://localhost:5005/api/publico/verificar-pdf/${hash}`, {
            headers: { "X-Forwarded-For": `203.0.113.${Math.floor(Math.random() * 200)}` },
        }),
        { params: Promise.resolve({ hash }) },
    ];
}

async function montarExpediente(): Promise<string> {
    const res = await postReporte(
        new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({
                identificador: "+57300SELLO1",
                plataforma: "whatsapp",
                texto: "Un adulto contacta a la menor con insistencia pidiendo fotos personales cada noche.",
                fechaIncidente: "2026-08-25T21:00:00Z",
                ciudad: "Bogotá",
                pais: "Colombia",
            }),
        })
    );
    const { reporte } = await res.json();
    const resExp = await postExpediente(
        new Request("http://localhost:5005/api/padre/expedientes", {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
            body: JSON.stringify({ reportePrincipalId: reporte.id }),
        })
    );
    return (await resExp.json()).expedienteId as string;
}

describe("el sello del informe (SPEC-340)", { timeout: 60_000 }, () => {
    let expedienteId: string;

    beforeEach(async () => {
        await resetDatabase();
        await prisma.$executeRaw`DELETE FROM pgboss.job`;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await resetRateLimitStore();
        const padre = await crearUsuario("PARENT", `sello-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expedienteId = await montarExpediente();
    });

    it("genera el PDF, registra el informe, y el hash del ARCHIVO verifica en la página pública", async () => {
        const res = await getPdf(new Request("http://x"), { params: Promise.resolve({ id: expedienteId }) });
        expect(res.status).toBe(200);
        const buffer = Buffer.from(await res.arrayBuffer());
        expect(buffer.length).toBeGreaterThan(1000);

        const registro = await prisma.informePadre.findFirstOrThrow({ where: { expedienteId } });
        // El hash registrado ES el sha256 del archivo entregado, byte a byte.
        expect(registro.pdfHash).toBe(createHash("sha256").update(buffer).digest("hex"));

        // Verificación pública por HASH (integridad).
        const [vq, vc] = reqVerificar(registro.pdfHash);
        const rv = await getVerificar(vq, vc);
        expect(rv.status).toBe(200);
        expect((await rv.json()).versionSecuencial).toBe(1);

        // Y por el CÓDIGO impreso (lo que la autoridad teclea del papel).
        const [cq, cc] = reqVerificar(registro.codigoVerificacion);
        expect((await getVerificar(cq, cc)).status).toBe(200);
    });

    it("un PDF ALTERADO no verifica: el hash de un byte cambiado no existe", async () => {
        const res = await getPdf(new Request("http://x"), { params: Promise.resolve({ id: expedienteId }) });
        const buffer = Buffer.from(await res.arrayBuffer());
        buffer[buffer.length - 10] = buffer[buffer.length - 10] ^ 0xff; // un byte
        const hashAlterado = createHash("sha256").update(buffer).digest("hex");

        const [vq, vc] = reqVerificar(hashAlterado);
        expect((await getVerificar(vq, vc)).status).toBe(404);
    });

    it("dos generaciones = dos registros numerados, permanentes, con códigos distintos", async () => {
        await getPdf(new Request("http://x"), { params: Promise.resolve({ id: expedienteId }) });
        await getPdf(new Request("http://x"), { params: Promise.resolve({ id: expedienteId }) });

        const registros = await prisma.informePadre.findMany({
            where: { expedienteId },
            orderBy: { numeroSecuencial: "asc" },
        });
        expect(registros.map((r) => r.numeroSecuencial)).toEqual([1, 2]);
        expect(registros[0].codigoVerificacion).not.toBe(registros[1].codigoVerificacion);
        expect(registros[0].pdfHash).not.toBe(registros[1].pdfHash);
    });

    it("el CÓDIGO entra al render y el HASH no (contrato SPEC-234, probado por construcción)", async () => {
        // El texto del PDF viaja codificado por glifos de fuente embebida — no
        // se puede grepear el binario. El contrato se prueba por construcción:
        // (1) dos códigos distintos con el MISMO timestamp → renders distintos
        //     ⇒ el código afecta el documento (está impreso);
        // (2) el hash se calcula DESPUÉS del render sobre el buffer final y el
        //     generador jamás lo recibe ⇒ no puede estar dentro (lo afirma el
        //     test del hash: sha256(buffer entregado) === registrado).
        const { generarPdfExpediente } = await import("@/lib/expediente/pdf-expediente");
        const base = {
            identificadorReportado: "300contrato",
            fechaApertura: new Date("2026-08-01T00:00:00Z"),
            padreEmail: "x@y.co",
            padreNombre: "Prueba",
            eventosPropios: [],
            contextoOtros: [],
            fechaGeneracion: new Date("2026-09-01T12:00:00Z"),
            urlVerificacion: "https://pi.example/verificar/x",
        };
        const conA = await generarPdfExpediente({ ...base, codigoVerificacion: "aaaaaaaaaaaaaaaa" });
        const conB = await generarPdfExpediente({ ...base, codigoVerificacion: "bbbbbbbbbbbbbbbb" });
        expect(Buffer.from(conA).equals(Buffer.from(conB)), "el código cambia el documento: está impreso").toBe(false);
    });
});
