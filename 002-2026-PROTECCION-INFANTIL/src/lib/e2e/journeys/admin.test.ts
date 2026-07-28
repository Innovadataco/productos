/**
 * SPEC-114 · Journey admin — el panel de plataforma por los caminos reales:
 * bandeja, estadísticas, operadores, colegios, dataset, spam, auditoría y Centro IA
 * cargan; y el admin crea un OPERADOR de verdad (la creación de colegio de verdad
 * está en el journey colegio, como parte del primer ingreso institucional). §9 en BD.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo, sembrarBancoCiclo } from "../seed-ciclo";
import { entrarComo, verificarHashBcrypt, verificarAuditLog, salirYExigirSesionMuerta, HOME_POR_ROL } from "../helpers";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

async function getJson(importPath: string, url: string) {
    const mod = (await import(importPath)) as { GET: (req: Request) => Promise<Response> };
    const res = await mod.GET(new Request(url));
    return res;
}

describe(`SPEC-114 · admin (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("recorre los módulos del panel y todos cargan", async () => {
        const datos = datosCiclo(CICLO);
        await sembrarBancoCiclo(datos);
        const sesion = await entrarComo("ADMIN", `e2e-c${CICLO}-admin@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });

        const superficies: [string, string][] = [
            ["bandeja de reportes", "@/app/api/admin/reportes-revision/route"],
            ["estadísticas", "@/app/api/admin/estadisticas/route"],
            ["operadores", "@/app/api/admin/operadores/route"],
            ["colegios", "@/app/api/admin/colegios/route"],
            ["dataset de entrenamiento", "@/app/api/admin/dataset-entrenamiento/route"],
            ["spam pendientes", "@/app/api/admin/spam/pendientes/route"],
            ["audit logs", "@/app/api/admin/audit-logs/route"],
            ["Centro IA · modelos", "@/app/api/admin/ia/modelos/route"],
        ];
        for (const [nombre, importPath] of superficies) {
            const res = await getJson(importPath, "http://localhost:5005/api/admin/x?page=1&pageSize=5");
            expect(res.status, `${nombre} debe cargar para el admin`).toBe(200);
        }
    });

    it("crea un operador DE VERDAD con contraseña temporal (con §9)", async () => {
        const sesion = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-op@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });

        const emailOperador = `e2e-c${CICLO}-operador@test.local`;
        const { POST: operadoresPOST, GET: operadoresGET } = await import("@/app/api/admin/operadores/route");
        const res = await operadoresPOST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailOperador, nombre: "Operador E2E", rol: "OPERADOR" }),
            })
        );
        expect(res.status, "el admin debe poder crear un operador").toBe(201);
        const creado = (await res.json()) as {
            operador: { id: string; debeCambiarPassword: boolean };
            passwordTemporal: string;
        };
        expect(creado.passwordTemporal, "el alta entrega una contraseña temporal").toBeTruthy();
        expect(creado.operador.debeCambiarPassword).toBe(true);

        // §9: usuario con hash bcrypt, perfil de operador persistido y AuditLog
        const usuario = await prisma.usuario.findUnique({ where: { email: emailOperador }, include: { perfilOperador: true } });
        expect(usuario).toBeTruthy();
        expect(usuario!.rol).toBe("OPERADOR");
        verificarHashBcrypt(usuario!.passwordHash, creado.passwordTemporal);
        expect(usuario!.perfilOperador, "§9: el perfil de operador debe persistirse").toBeTruthy();
        await verificarAuditLog("OPERADOR_CREADO", creado.operador.id);

        // Aparece en el listado de operadores
        const lista = await operadoresGET(new Request("http://localhost:5005/api/admin/operadores"));
        expect(lista.status).toBe(200);
        const { operadores } = (await lista.json()) as { operadores: { email: string }[] };
        expect(operadores.some((o) => o.email === emailOperador)).toBe(true);

        await salirYExigirSesionMuerta(sesion, HOME_POR_ROL.ADMIN);
    });
});
