import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET as GETBandeja } from "./route";
import { GET as GETDetalle } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearApelacionConDocumento, crearReporteParaIdentificador } from "@/lib/apelacion-test-utils";
import * as auth from "@/lib/auth";

const storageDir = mkdtempSync(path.join(tmpdir(), "apelaciones-bandeja-test-"));
process.env.APELACIONES_STORAGE_DIR = storageDir;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

const IDENT = "+573009660001";

function diasAtras(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

describe("GET /api/admin/comite/apelaciones (bandeja) y /[id] (detalle)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        rmSync(storageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        await prisma.$disconnect();
    });

    async function plataformaId(): Promise<string> {
        return (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id;
    }

    async function setupComite() {
        return crearUsuario("COMITE_VALIDACION");
    }

    it("la bandeja lista los casos con estado y días hábiles; 403 a un PARENT", async () => {
        const apelante = await crearUsuario("PARENT");
        const pid = await plataformaId();
        await crearApelacionConDocumento({ usuarioId: apelante.id, identificador: IDENT, plataformaId: pid, estado: "RECIBIDA" });

        const comite = await setupComite();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await GETBandeja(new Request("http://localhost:5005/api/admin/comite/apelaciones"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].estado).toBe("RECIBIDA");
        expect(typeof body.items[0].diasHabilesTranscurridos).toBe("number");
        expect(body.items[0].proximoAVencer).toBe(false);

        // Un PARENT no accede a la bandeja del comité.
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(apelante);
        const resPadre = await GETBandeja(new Request("http://localhost:5005/api/admin/comite/apelaciones"));
        expect(resPadre.status).toBe(403);
    });

    it("la marca próximo a vencer respeta apelacion.aviso_previo_dias (efecto del parámetro)", async () => {
        const apelante = await crearUsuario("PARENT");
        const pid = await plataformaId();
        // 7 días calendario atrás ⇒ ~5 días hábiles transcurridos, sin resolver.
        await crearApelacionConDocumento({ usuarioId: apelante.id, identificador: IDENT, plataformaId: pid, estado: "RECIBIDA", creadoEn: diasAtras(7) });

        const comite = await setupComite();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);

        // Umbral por defecto (10 días): no está próximo a vencer.
        await prisma.parametroSistema.create({ data: { clave: "apelacion.aviso_previo_dias", valor: "10", tipo: "INTEGER", categoria: "LEGAL" } });
        const res10 = await GETBandeja(new Request("http://localhost:5005/api/admin/comite/apelaciones"));
        const body10 = await res10.json();
        expect(body10.items[0].proximoAVencer).toBe(false);

        // Bajo el umbral a 3 días: el mismo caso pasa a estar próximo a vencer.
        await prisma.parametroSistema.update({ where: { clave: "apelacion.aviso_previo_dias" }, data: { valor: "3" } });
        const res3 = await GETBandeja(new Request("http://localhost:5005/api/admin/comite/apelaciones"));
        const body3 = await res3.json();
        expect(body3.items[0].proximoAVencer).toBe(true);
    });

    it("el detalle expone motivo, acreditación, metadatos del documento y los reportes", async () => {
        const apelante = await crearUsuario("PARENT");
        const pid = await plataformaId();
        const { apelacion, documento } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador: IDENT,
            plataformaId: pid,
            estado: "RECIBIDA",
        });
        await prisma.apelacion.update({ where: { id: apelacion.id }, data: { esRepresentante: true, acreditacion: "Madre del titular, registro civil." } });
        await crearReporteParaIdentificador({ identificador: IDENT, plataformaId: pid });
        await crearReporteParaIdentificador({ identificador: IDENT, plataformaId: pid });

        const comite = await setupComite();
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);
        const res = await GETDetalle(new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}`), { params: Promise.resolve({ id: apelacion.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.apelacion.motivo).toContain("titular");
        expect(body.apelacion.acreditacion).toContain("registro civil");
        expect(body.documento.nombreOriginal).toBe("evidencia.pdf");
        expect(body.documento.hashSha256).toBe(documento.hashSha256);
        expect(body.reportes).toHaveLength(2);
        // El comité SÍ puede ver el contenido de los reportes (decide bajas).
        expect(body.reportes[0].texto).toBeTruthy();
    });
});
