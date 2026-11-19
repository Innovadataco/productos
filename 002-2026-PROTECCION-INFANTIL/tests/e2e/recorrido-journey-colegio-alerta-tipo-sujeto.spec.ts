/**
 * SPEC-926 (Calidad) · JOURNEY — un reporte sobre un identificador registrado por el colegio
 * genera la ALERTA del colegio con el TIPO DE SUJETO correcto, para los CUATRO sujetos:
 * ESTUDIANTE · PROFESOR · ACUDIENTE · INTEGRANTE_COMITE. (Pedido de Jelkin vía CEO, 19-11.)
 *
 * QUÉ PROTEGE. Es la promesa central del canal de colegios: «si reportan a alguien de su
 * comunidad, su colegio se entera». Encadena las piezas REALES:
 *   (1) El rector REGISTRA un identificador para cada sujeto por SUS endpoints:
 *       estudiante → `POST /api/colegio/alumnos/[id]/identificadores`
 *       profesor   → `POST /api/colegio/profesores/[id]/identificadores`
 *       acudiente  → `POST /api/colegio/alumnos/[id]/acudientes` + `/api/colegio/acudientes/[id]/identificadores`
 *       comité     → `POST /api/colegio/comite/cuenta` + `/comite/integrantes` + `/comite/integrantes/[id]/identificadores`
 *       Los valores se registran con MAYÚSCULAS mezcladas y se REPORTAN en MAYÚSCULAS: la alerta
 *       tiene que salir sin importar el casing (hoy lo garantizan la normalización y la búsqueda
 *       `mode: insensitive` del motor). OJO: por esa búsqueda insensible, este journey NO prueba
 *       que las dos normalizaciones (colegio y núcleo) sigan atadas — eso lo vigila el candado
 *       unitario de SPEC-674.
 *   (2) Un tercero REPORTA cada valor por el endpoint público real (`POST /api/reportes`, anónimo).
 *   (3) El motor de alertas del colegio (`notificarColegioSiCorresponde`) crea UNA alerta por
 *       reporte, con el `tipoSujeto` y la FK al identificador que corresponde.
 *   (4) El rector la VE: `GET /api/colegio/alertas?tipoSujeto=…` (1 por tipo) y la bandeja
 *       `/dashboard/colegio/alertas` con los cuatro rótulos; y le llega la notificación in-app.
 *
 * PUENTE DECLARADO (el arnés no corre el worker). En producción quien llama al motor es
 * `scripts/worker-reportes.mjs` (`avisosCoincidencia.colegio`), tras clasificar el reporte o
 * rescatarlo a REVISION_MANUAL (SPEC-671). Acá el journey hace lo que hace el worker: deja el
 * reporte en estado visible (CLASIFICADO) y llama a LA MISMA función del motor. Nada más se
 * simula: registro, reporte, cruce, alerta, bandeja y notificación son el código real.
 *
 * CONTROLES (para que el verde no sea vacío):
 *   - ANTES del puente (reporte PENDIENTE, no visible) el motor NO crea alertas → la alerta
 *     depende de la visibilidad, no de que el motor «alerte todo».
 *   - Un 5º reporte con un valor NO registrado → CERO alertas (el cruce es por valor, no
 *     «cualquier reporte alerta al colegio»).
 *   - Re-llamar al motor no duplica (dedupe por colegio+reporte+identificador).
 *
 * AISLAMIENTO. Corrida por `randomUUID`. Prisma solo LEE para afirmar, salvo el puente de estado
 * (declarado arriba). Limpieza profunda FK-safe en `afterAll` que AFIRMA que el colegio quedó
 * borrado. Corre en el arnés (guardia SPEC-770: BD `*_test`); NUNCA contra prod.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { notificarColegioSiCorresponde } from "@/lib/colegio/alertas";
import { disposeBoss } from "@/lib/queue";
import { crearColegioOnboarded, type ColegioOnboarded } from "./fixtures/colegio-onboarded";
import { limpiarColegioProfundo } from "./fixtures/colegio-limpieza-profunda";

const CORRIDA = randomUUID().slice(0, 8);
const PASSWORD_RECTOR = "RectorSpec926Alertas!Secure";
const FECHA_INCIDENTE = "2026-07-10T15:00:00Z";

type TipoSujeto = "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE" | "INTEGRANTE_COMITE";

const ETIQUETA: Record<TipoSujeto, string> = {
    ESTUDIANTE: "Estudiante",
    PROFESOR: "Profesor",
    ACUDIENTE: "Acudiente",
    INTEGRANTE_COMITE: "Integrante del comité",
};

/** Valor registrado (casing mezclado) por sujeto. Se reporta en MAYÚSCULAS. */
const VALOR_REGISTRADO: Record<TipoSujeto, string> = {
    ESTUDIANTE: `Est926_${CORRIDA}`,
    PROFESOR: `Prof926_${CORRIDA}`,
    ACUDIENTE: `Acud926_${CORRIDA}`,
    INTEGRANTE_COMITE: `Comite926_${CORRIDA}`,
};
const VALOR_NO_REGISTRADO = `Nadie926_${CORRIDA}`;

const colegiosCreados: ColegioOnboarded[] = [];
const reportesCreados: string[] = [];

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

async function postOk(req: APIRequestContext, url: string, data: unknown, que: string): Promise<Record<string, unknown>> {
    const res = await req.post(url, { data });
    const texto = await res.text();
    expect(res.status(), `${que} → 201 · body=${texto}`).toBe(201);
    return JSON.parse(texto) as Record<string, unknown>;
}

test.describe.serial("SPEC-926 · journey: identificador registrado → reporte → alerta del colegio con el tipo de sujeto correcto", () => {
    test.afterAll(async () => {
        for (const colegio of colegiosCreados) {
            const { colegioBorrado } = await limpiarColegioProfundo(colegio, reportesCreados);
            expect(colegioBorrado, `limpieza: el colegio ${colegio.colegioId} debe quedar borrado`).toBe(true);
        }
        colegiosCreados.length = 0;
        reportesCreados.length = 0;
        // El motor encola avisos en pg-boss desde ESTE proceso: se cierra para no dejar el worker colgado.
        await disposeBoss().catch(() => undefined);
    });

    test("estudiante, profesor, acudiente e integrante del comité: cada reporte genera SU alerta y el rector la ve", async ({ page }) => {
        test.setTimeout(180_000);
        const rector = page.request;

        const colegio = await test.step("1 · colegio onboarded completo (endpoints reales)", async () => {
            const c = await crearColegioOnboarded({
                request: rector,
                email: `rector-926a-${CORRIDA}@e2e.local`,
                password: PASSWORD_RECTOR,
                corrida: `926a-${CORRIDA}`,
            });
            colegiosCreados.push(c);
            return c;
        });

        const idRegistrado = await test.step("2 · el rector registra un identificador en cada uno de los 4 sujetos", async () => {
            const estudiante = await prisma.estudiante.findFirstOrThrow({
                where: { colegioId: colegio.colegioId, estado: "activo" },
                select: { id: true },
            });
            const profesor = await prisma.profesor.findFirstOrThrow({
                where: { colegioId: colegio.colegioId, estado: "activo" },
                select: { id: true },
            });

            const est = await postOk(rector, `/api/colegio/alumnos/${estudiante.id}/identificadores`,
                { valor: VALOR_REGISTRADO.ESTUDIANTE }, "identificador de estudiante");
            const prof = await postOk(rector, `/api/colegio/profesores/${profesor.id}/identificadores`,
                { valor: VALOR_REGISTRADO.PROFESOR }, "identificador de profesor");

            const acudiente = await postOk(rector, `/api/colegio/alumnos/${estudiante.id}/acudientes`,
                { orden: 1, nombre: "Marta Acudiente", relacion: "Madre", telefono: "3009260001" }, "acudiente");
            const acudienteId = (acudiente.acudiente as { id: string }).id;
            const acud = await postOk(rector, `/api/colegio/acudientes/${acudienteId}/identificadores`,
                { valor: VALOR_REGISTRADO.ACUDIENTE }, "identificador de acudiente");

            await postOk(rector, "/api/colegio/comite/cuenta", { email: `comite-926-${CORRIDA}@e2e.local` }, "cuenta del comité");
            const integrante = await postOk(rector, "/api/colegio/comite/integrantes", {
                nombres: "Integrante",
                apellidos: `Comité ${CORRIDA}`,
                tipoIdentificacion: "CEDULA_CIUDADANIA",
                numeroIdentificacion: `4${Date.now() % 1_000_000_000}`,
                email: `integrante-926-${CORRIDA}@e2e.local`,
                cargo: "Docente orientador",
            }, "integrante del comité");
            const integranteId = (integrante.integrante as { id: string }).id;
            const com = await postOk(rector, `/api/colegio/comite/integrantes/${integranteId}/identificadores`,
                { valor: VALOR_REGISTRADO.INTEGRANTE_COMITE }, "identificador de integrante del comité");

            const ids: Record<TipoSujeto, string> = {
                ESTUDIANTE: (est.identificador as { id: string }).id,
                PROFESOR: (prof.identificador as { id: string }).id,
                ACUDIENTE: (acud.identificador as { id: string }).id,
                INTEGRANTE_COMITE: (com.identificador as { id: string }).id,
            };
            for (const id of Object.values(ids)) expect(id, "cada registro devuelve su id").toBeTruthy();
            return ids;
        });

        const reportes = await test.step("3 · un tercero reporta cada valor por el endpoint público (otro casing) + un valor NO registrado", async () => {
            const anonimo = await playwrightRequest.newContext({ baseURL: baseURL() });
            try {
                const paises = await (await anonimo.get("/api/paises")).json();
                const colombia = paises.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
                expect(colombia, "Colombia en el seed").toBeDefined();
                const ciudades = await (await anonimo.get(`/api/ciudades?paisId=${colombia.id}`)).json();
                const bogota = ciudades.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
                expect(bogota, "Bogotá en el seed").toBeDefined();

                const reportar = async (identificador: string, n: number): Promise<string> => {
                    const body = await postOk(anonimo, "/api/reportes", {
                        identificador,
                        plataforma: "whatsapp",
                        texto: `Caso ${n} de la corrida ${CORRIDA}: este usuario le escribe a un menor ofreciéndole regalos y pidiéndole que no le cuente a nadie.`,
                        fechaIncidente: FECHA_INCIDENTE,
                        ciudad: "Bogotá",
                        pais: "Colombia",
                        paisId: colombia.id,
                        ciudadId: bogota.id,
                    }, `reporte anónimo #${n}`);
                    const id = (body.reporte as { id: string } | undefined)?.id;
                    expect(id, "el reporte trae su id").toBeTruthy();
                    reportesCreados.push(id!);
                    return id!;
                };

                const porTipo = {} as Record<TipoSujeto, string>;
                let n = 1;
                for (const tipo of Object.keys(VALOR_REGISTRADO) as TipoSujeto[]) {
                    porTipo[tipo] = await reportar(VALOR_REGISTRADO[tipo].toUpperCase(), n++);
                }
                const control = await reportar(VALOR_NO_REGISTRADO.toUpperCase(), n);
                return { porTipo, control };
            } finally {
                await anonimo.dispose();
            }
        });
        const todos = [...Object.values(reportes.porTipo), reportes.control];

        await test.step("4 · control: con el reporte PENDIENTE (no visible) el motor NO alerta", async () => {
            const estados = await prisma.reporte.findMany({ where: { id: { in: todos } }, select: { estado: true } });
            expect(estados.every((r) => r.estado === "PENDIENTE"), `recién creados = PENDIENTE (${JSON.stringify(estados)})`).toBe(true);
            for (const id of todos) await notificarColegioSiCorresponde(id);
            expect(await prisma.alertaColegio.count({ where: { colegioId: colegio.colegioId } }), "PENDIENTE → 0 alertas").toBe(0);
        });

        await test.step("5 · puente declarado (lo que hace el worker): reporte visible → el motor crea UNA alerta por sujeto, con su tipo", async () => {
            await prisma.reporte.updateMany({ where: { id: { in: todos } }, data: { estado: "CLASIFICADO" } });
            for (const id of todos) await notificarColegioSiCorresponde(id);
            for (const id of todos) await notificarColegioSiCorresponde(id); // idempotente: no duplica

            const campoFk: Record<TipoSujeto, "identificadorEstudianteId" | "identificadorProfesorId" | "identificadorAcudienteId" | "identificadorIntegranteComiteId"> = {
                ESTUDIANTE: "identificadorEstudianteId",
                PROFESOR: "identificadorProfesorId",
                ACUDIENTE: "identificadorAcudienteId",
                INTEGRANTE_COMITE: "identificadorIntegranteComiteId",
            };
            for (const tipo of Object.keys(reportes.porTipo) as TipoSujeto[]) {
                const alertas = await prisma.alertaColegio.findMany({
                    where: { reporteId: reportes.porTipo[tipo] },
                    select: {
                        colegioId: true,
                        tipoSujeto: true,
                        identificadorEstudianteId: true,
                        identificadorProfesorId: true,
                        identificadorAcudienteId: true,
                        identificadorIntegranteComiteId: true,
                    },
                });
                expect(alertas, `${tipo}: exactamente UNA alerta para su reporte`).toHaveLength(1);
                const [alerta] = alertas;
                expect(alerta.colegioId, `${tipo}: alerta de ESTE colegio`).toBe(colegio.colegioId);
                expect(alerta.tipoSujeto, `${tipo}: tipoSujeto correcto`).toBe(tipo);
                expect(alerta[campoFk[tipo]], `${tipo}: FK al identificador registrado`).toBe(idRegistrado[tipo]);
                for (const otro of Object.values(campoFk).filter((c) => c !== campoFk[tipo])) {
                    expect(alerta[otro], `${tipo}: las otras FK de sujeto vacías (${otro})`).toBeNull();
                }
            }
            expect(await prisma.alertaColegio.count({ where: { reporteId: reportes.control } }), "valor NO registrado → 0 alertas").toBe(0);
            expect(await prisma.alertaColegio.count({ where: { colegioId: colegio.colegioId } }), "total del colegio = 4").toBe(4);
        });

        await test.step("6 · el rector las ve: API filtrada por tipo, bandeja con los 4 rótulos y notificación in-app", async () => {
            // La bandeja resuelve a QUIÉN señala cada alerta (el nombre del sujeto registrado).
            const sujetoEsperado: Record<TipoSujeto, string> = {
                ESTUDIANTE: "Alumno E2E",
                PROFESOR: "Profe E2E",
                ACUDIENTE: "Marta Acudiente",
                INTEGRANTE_COMITE: `Integrante Comité ${CORRIDA}`,
            };
            for (const tipo of Object.keys(ETIQUETA) as TipoSujeto[]) {
                const res = await rector.get(`/api/colegio/alertas?tipoSujeto=${tipo}`);
                expect(res.status(), `GET alertas ${tipo}`).toBe(200);
                const body = (await res.json()) as { total: number; items: { tipoSujeto: string; sujetoNombre: string | null }[] };
                expect(body.total, `API: 1 alerta de tipo ${tipo}`).toBe(1);
                expect(body.items[0].tipoSujeto, `API: el ítem es ${tipo}`).toBe(tipo);
                expect(body.items[0].sujetoNombre ?? "", `API: la alerta ${tipo} señala al sujeto registrado`).toContain(sujetoEsperado[tipo]);
            }

            // La bandeja es de TARJETAS (no tabla): cada una lleva su casilla «Seleccionar alerta <id>».
            // Se ata cada alerta (por id, desde la BD) a SU rótulo de tipo y al nombre de SU sujeto.
            const alertasBd = await prisma.alertaColegio.findMany({
                where: { colegioId: colegio.colegioId },
                select: { id: true, tipoSujeto: true },
            });
            await page.goto("/dashboard/colegio/alertas");
            await expect(page.getByRole("checkbox", { name: /^Seleccionar alerta / }), "bandeja: 4 tarjetas").toHaveCount(4);
            for (const { id, tipoSujeto } of alertasBd) {
                const tipo = tipoSujeto as TipoSujeto;
                const filaBadges = page.getByRole("checkbox", { name: `Seleccionar alerta ${id}`, exact: true }).locator("xpath=..");
                await expect(filaBadges.getByText(ETIQUETA[tipo], { exact: true }), `tarjeta ${id}: rótulo «${ETIQUETA[tipo]}»`).toBeVisible();
                const tarjeta = filaBadges.locator("xpath=ancestor::div[contains(@class,'border-l-4')][1]");
                await expect(tarjeta.getByText(sujetoEsperado[tipo], { exact: false }), `tarjeta ${id}: muestra al sujeto`).toBeVisible();
            }

            const alertaIds = alertasBd.map((a) => a.id);
            await expect
                .poll(
                    () => prisma.notificacionInApp.count({
                        where: { colegioId: colegio.colegioId, usuarioId: colegio.rectorUsuarioId, tipo: "ALERTA_NUEVA", entidadId: { in: alertaIds } },
                    }),
                    { message: "el rector recibe una notificación in-app ALERTA_NUEVA por alerta", timeout: 10_000 },
                )
                .toBe(4);
        });
    });
});
