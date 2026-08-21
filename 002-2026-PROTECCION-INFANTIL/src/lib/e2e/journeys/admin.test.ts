/**
 * SPEC-114 · Journey admin — el panel de plataforma por los caminos reales:
 * bandeja, estadísticas, operadores, colegios, dataset, spam, auditoría y Centro IA
 * cargan; y el admin crea un OPERADOR de verdad (la creación de colegio de verdad
 * está en el journey colegio, como parte del primer ingreso institucional). §9 en BD.
 * SPEC-133 (fase 5): parámetros de configuración (leer/cambiar/restaurar con
 * auditoría) → resolución de spam (falso positivo y spam real, con purga D4) →
 * correcciones RAG (categoría corregida alimenta el dataset). Todo cierra en BD (§9).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo, sembrarBancoCiclo } from "../seed-ciclo";
import { entrarComo, verificarHashBcrypt, verificarAuditLog, salirYExigirSesionMuerta, HOME_POR_ROL } from "../helpers";
import { MARCADOR_TEXTO_PURGADO } from "@/lib/texto-reporte-cifrado";

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
        ];
        for (const [nombre, importPath] of superficies) {
            const res = await getJson(importPath, "http://localhost:5005/api/admin/x?page=1&pageSize=5");
            expect(res.status, `${nombre} debe cargar para el admin`).toBe(200);
        }

        // Centro IA · modelos: depende del cerebro externo (Ollama). El CAMINO del admin
        // debe funcionar con cerebro presente (200 + lista) o ausente (503 DEGRADADO con
        // error estructurado, el mismo contrato del sondeo de I-24 en
        // /api/admin/ia/ollama/probar). Cierra la deuda #2 del cierre de SPEC-114:
        // el endpoint ya degrada como su hermano — el 500 controlado dejó de ser
        // el contrato (cola nocturna 002-PI-041, bloque B6).
        const resModelos = await getJson("@/app/api/admin/ia/modelos/route", "http://localhost:5005/api/admin/ia/modelos");
        if (resModelos.status === 200) {
            const cuerpo = (await resModelos.json()) as { models?: unknown };
            expect(cuerpo.models, "con cerebro presente, lista modelos").toBeDefined();
        } else {
            expect(resModelos.status, "sin cerebro, degrada a 503 estructurado (nunca 500)").toBe(503);
            const cuerpo = (await resModelos.json()) as { ok?: boolean; error?: { message?: string; code?: string } };
            expect(cuerpo.ok, "la respuesta degradada declara ok:false").toBe(false);
            expect(cuerpo.error?.code, "el error es estructurado, no una excepción sin atrapar").toBe("SERVICE_UNAVAILABLE");
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

    it("parámetros: lee la configuración, cambia un umbral no crítico y lo restaura (§9 en BD)", async () => {
        const sesion = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-par@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });

        const CLAVE = "visibility.report_threshold";
        const antes = (await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } }))!;

        // GET: el listado de configuración carga y expone el parámetro
        const { GET: parametrosGET } = await import("@/app/api/config/parametros/route");
        const resLista = await parametrosGET(new Request("http://localhost:5005/api/config/parametros?page=1&pageSize=100"));
        expect(resLista.status, "el admin debe poder leer la configuración").toBe(200);
        expect(JSON.stringify(await resLista.json()), "el listado incluye el umbral de visibilidad").toContain(CLAVE);

        // PATCH por la ruta real de update (/api/config/parametros/[clave])
        const { PATCH: parametroPATCH } = await import("@/app/api/config/parametros/[clave]/route");
        const resPatch = await parametroPATCH(
            new Request(`http://localhost:5005/api/config/parametros/${CLAVE}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: "4", motivo: `Ajuste E2E ciclo ${CICLO}` }),
            }),
            { params: Promise.resolve({ clave: CLAVE }) }
        );
        expect(resPatch.status, "el admin debe poder cambiar el umbral").toBe(200);

        // §9: el valor cambió en BD, firmado por el admin, y quedó auditado
        const cambiado = (await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } }))!;
        expect(cambiado.valor, "§9: el parámetro tiene el nuevo valor").toBe("4");
        expect(cambiado.actualizadoPorId, "§9: queda quién lo cambió").toBe(sesion.usuarioId);
        await verificarAuditLog("PARAM_UPDATE", cambiado.id);

        // Restaurar (aislamiento: la suite comparte BD con otros journeys)
        const resRestaura = await parametroPATCH(
            new Request(`http://localhost:5005/api/config/parametros/${CLAVE}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: antes.valor, motivo: `Restauración E2E ciclo ${CICLO}` }),
            }),
            { params: Promise.resolve({ clave: CLAVE }) }
        );
        expect(resRestaura.status).toBe(200);
        const restaurado = (await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } }))!;
        expect(restaurado.valor, "§9: el valor original queda restaurado").toBe(antes.valor);
    });

    it("spam: resuelve un falso positivo y confirma otro como spam con purga D4 (§9 en BD)", async () => {
        const sesion = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-spam@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const datos = datosCiclo(CICLO);
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // Siembra directa (sin Ollama): el clasificador ya marcó POSIBLE_SPAM
        const sembrarCasoSpam = async (tag: string) => {
            const reporte = await prisma.reporte.create({
                data: {
                    identificador: datos.identificadorPocos,
                    plataformaId: plataforma.id,
                    texto: `Texto del caso spam ${tag} (ciclo ${CICLO}).`,
                    fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-C${CICLO}-SPAM-${tag.toUpperCase()}`,
                    estado: "POSIBLE_SPAM",
                },
            });
            await prisma.clasificacionIA.create({
                data: {
                    reporteId: reporte.id,
                    categoria: "OTRO",
                    confianza: 0.3,
                    contienePii: false,
                    piiDetectada: [],
                    modeloUsado: "rubrica:gemma2:27b",
                    latenciaMs: 1000,
                    categoriasSecundarias: [],
                },
            });
            return reporte;
        };

        const { POST: resolverSpamPOST } = await import("@/app/api/admin/reportes/[id]/resolver-spam/route");

        // Caso 1 — falso positivo: es reporte válido y se corrige la categoría
        const casoValido = await sembrarCasoSpam("valido");
        const resValido = await resolverSpamPOST(
            new Request(`http://localhost:5005/api/admin/reportes/${casoValido.id}/resolver-spam`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision: "corregir", categoria: "CONTACTO_INSISTENTE", motivo: "Es una conducta real, no spam" }),
            }),
            { params: Promise.resolve({ id: casoValido.id }) }
        );
        expect(resValido.status, "el admin debe poder resolver el falso positivo").toBe(200);

        // §9 caso 1: CLASIFICADO + corrección persistida + transición
        const bdValido = (await prisma.reporte.findUnique({ where: { id: casoValido.id } }))!;
        expect(bdValido.estado, "§9: el falso positivo pasa a CLASIFICADO").toBe("CLASIFICADO");
        expect(bdValido.eliminado, "§9: el reporte válido NO se da de baja").toBe(false);
        const correccionSpam = await prisma.correccionAdmin.findFirst({ where: { clasificacion: { reporteId: casoValido.id } } });
        expect(correccionSpam, "§9: la corrección queda persistida").toBeTruthy();
        expect(correccionSpam!.categoriaCorregida).toBe("CONTACTO_INSISTENTE");
        expect(correccionSpam!.confirmada).toBe(true);
        const transicionValido = await prisma.transicionReporte.findFirst({
            where: { reporteId: casoValido.id, estadoNuevo: "CLASIFICADO" },
        });
        expect(transicionValido, "§9: la transición debe quedar registrada").toBeTruthy();

        // Caso 2 — spam real: baja con purga D4 del texto y ejemplo para el dataset
        const casoSpam = await sembrarCasoSpam("real");
        const resSpam = await resolverSpamPOST(
            new Request(`http://localhost:5005/api/admin/reportes/${casoSpam.id}/resolver-spam`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision: "es_spam", motivo: "Publicidad irrelevante repetida" }),
            }),
            { params: Promise.resolve({ id: casoSpam.id }) }
        );
        expect(resSpam.status, "el admin debe poder confirmar el spam").toBe(200);

        // §9 caso 2: baja persistida, texto purgado (D4), dataset alimentado y auditoría
        const bdSpam = (await prisma.reporte.findUnique({ where: { id: casoSpam.id } }))!;
        expect(bdSpam.eliminado, "§9: el spam queda dado de baja").toBe(true);
        expect(bdSpam.motivoBaja, "§9: motivo de limpieza").toBe("RETIRO_LIMPIEZA");
        expect(bdSpam.texto, "§9: el texto se purga al marcador no-identificable (D4)").toBe(MARCADOR_TEXTO_PURGADO);
        const datasetSpam = await prisma.datasetEntrenamiento.findFirst({
            where: { clasificacionCorrecta: "SPAM", fuente: "spam_revisado" },
        });
        expect(datasetSpam, "§9: el spam confirmado alimenta el dataset").toBeTruthy();
        await verificarAuditLog("CASO_DADO_DE_BAJA", casoSpam.id);
    });

    it("correcciones RAG: corrige la categoría de un reporte clasificado (§9 en BD)", async () => {
        const sesion = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-rag@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const datos = datosCiclo(CICLO);
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // Siembra directa: reporte CLASIFICADO por la IA, con original preservado
        // (textoOriginal no nulo → el handler no invoca al anonimizador/Ollama)
        const reporte = await prisma.reporte.create({
            data: {
                identificador: datos.identificadorComun,
                plataformaId: plataforma.id,
                texto: `${datos.textoBase} (caso corrección RAG)`,
                textoOriginal: `${datos.textoBase} (caso corrección RAG, original)`,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: `RPT-C${CICLO}-RAG`,
                estado: "CLASIFICADO",
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "rubrica:gemma2:27b",
                latenciaMs: 1000,
                categoriasSecundarias: [],
            },
        });

        const comentario = "La conducta es extorsión, no contacto insistente";
        const { POST: correccionesPOST } = await import("@/app/api/admin/correcciones/route");
        const res = await correccionesPOST(
            new Request("http://localhost:5005/api/admin/correcciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reporteId: reporte.id, categoriaCorregida: "EXTORSION", comentario }),
            })
        );
        expect(res.status, "el admin debe poder corregir la categoría").toBe(200);
        const cuerpo = (await res.json()) as { estado: string };
        expect(cuerpo.estado).toBe("CORREGIDO");

        // §9: corrección persistida con sus campos
        const correccion = await prisma.correccionAdmin.findFirst({ where: { clasificacion: { reporteId: reporte.id } } });
        expect(correccion, "§9: la CorreccionAdmin debe persistirse").toBeTruthy();
        expect(correccion!.categoriaOriginal, "§9: categoría original").toBe("CONTACTO_INSISTENTE");
        expect(correccion!.categoriaCorregida, "§9: categoría corregida").toBe("EXTORSION");
        expect(correccion!.adminId, "§9: queda quién corrigió").toBe(sesion.usuarioId);
        expect(correccion!.motivo, "§9: queda el comentario").toBe(comentario);

        // §9: la clasificación queda corregida y el caso pasa a CORREGIDO con transición
        const clasificacion = (await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } }))!;
        expect(clasificacion.categoria, "§9: la clasificación toma la categoría corregida").toBe("EXTORSION");
        expect(clasificacion.confianza, "§9: la corrección humana es confianza plena").toBe(1.0);
        const bdReporte = (await prisma.reporte.findUnique({ where: { id: reporte.id } }))!;
        expect(bdReporte.estado, "§9: el caso pasa a CORREGIDO").toBe("CORREGIDO");
        const transicion = await prisma.transicionReporte.findFirst({ where: { reporteId: reporte.id, estadoNuevo: "CORREGIDO" } });
        expect(transicion, "§9: la transición debe quedar registrada").toBeTruthy();

        // §9: la corrección alimenta el dataset RAG
        const dataset = await prisma.datasetEntrenamiento.findFirst({ where: { correccionId: correccion!.id } });
        expect(dataset, "§9: la corrección alimenta el dataset de entrenamiento").toBeTruthy();
        expect(dataset!.clasificacionCorrecta).toBe("EXTORSION");
        expect(dataset!.fuente).toBe("correccion_admin");
        await verificarAuditLog("CASO_CORREGIDO", reporte.id);
    });
});
