/**
 * SPEC-425 (A-75 · L5) · Candados del panel del profesional, sin BD.
 *
 * Dos cosas que se rompen por descuido y que este lote decidió a propósito:
 *
 *  1. **No se pintan botones sin motor.** El mockup dibuja cinco controles;
 *     solo dos tienen implementación (`Confirmar`, `No puedo`, los de L4).
 *     «Proponer otro horario», «Se dio, cerrar y cobrar» y «No se presentó»
 *     **no existen** — nada en `src/` escribe `CUMPLIDA` ni `NO_ASISTIO_PADRE`.
 *     El brief §7 los pone en L6/L7. Pintar el botón igual sería la cuarta
 *     repetición de I-289/I-290/I-297 en el mismo día, puesta por nosotros.
 *  2. **El porcentaje de servicio vive en un solo lugar.** Si la pantalla y el
 *     cobro sacan el número de sitios distintos, un día dicen cosas distintas.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { desglosarTarifa, PORCENTAJE_SERVICIO_DEFAULT } from "../cita/comision";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

const RAIZ = path.resolve(__dirname, "../../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

const PANEL = "src/components/modules/profesional/PanelProfesional.tsx";
const ACCIONES = "src/components/modules/profesional/SolicitudAcciones.tsx";
const SERVICIO = "src/lib/profesional/panel/panel.service.ts";

describe("SPEC-425 · el panel no promete lo que no puede hacer", () => {
    it("solo se pintan los DOS botones que tienen motor", () => {
        const acciones = leerCodigo(ACCIONES);
        // La URL se arma con plantilla: `.../solicitudes/${id}/${accion}`, y la
        // acción sale del tipo — por eso se afirma el tipo y el endpoint base.
        expect(acciones).toContain('"confirmar" | "rechazar"');
        expect(acciones).toContain("/api/profesional/solicitudes/");
        const botones = (leerCodigo(PANEL) + acciones).match(/<button/g) ?? [];
        expect(botones, "dos botones: Confirmar y No puedo").toHaveLength(2);
    });

    it("no aparece ninguno de los tres controles sin motor", () => {
        const todo = leerCodigo(PANEL) + leerCodigo(ACCIONES);
        for (const muerto of ["Proponer otro horario", "cerrar y cobrar", "No se presentó"]) {
            expect(todo, `"${muerto}" no tiene implementación: no puede ser un control`).not.toContain(muerto);
        }
    });

    it("en su lugar dice qué falta, y no con un control apagado", () => {
        const panel = leer(PANEL);
        expect(panel).toContain("todavía no está disponible");
        // Un `disabled` fijo sería un botón apagado prometiendo algo. El único
        // `disabled` legítimo es el de los dos botones vivos mientras trabajan.
        expect(leerCodigo(PANEL)).not.toContain("disabled");
    });

    it("los estados de cierre siguen sin tener quien los escriba (base de la decisión)", () => {
        // Si un día alguien implementa el cierre, este test cae y obliga a
        // volver acá a pintar los botones. Es la contraparte del candado.
        const src = path.join(RAIZ, "src");
        const hallazgos: string[] = [];
        const recorrer = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const r = path.join(dir, e.name);
                if (e.isDirectory()) recorrer(r);
                else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                    const t = fs.readFileSync(r, "utf-8");
                    if (/estado:\s*"(CUMPLIDA|NO_ASISTIO_PADRE)"/.test(t)) hallazgos.push(r);
                }
            }
        };
        recorrer(src);
        expect(
            hallazgos,
            "alguien implementó el cierre: volvé a PanelProfesional y pintá los botones",
        ).toEqual([]);
    });
});

describe("SPEC-425 · el marcador respeta el brief §3", () => {
    it("las SIN_CONFIRMAR se cuentan aparte y NO suman a lo atendido", () => {
        const servicio = leerCodigo(SERVICIO);
        expect(servicio).toContain('ESPERAN_RESPUESTA: EstadoSolicitudCita[] = ["SIN_CONFIRMAR", "PAGADA_PENDIENTE"]');
        const marcador = servicio.slice(servicio.indexOf("CUENTAN_EN_EL_MARCADOR"));
        expect(marcador.slice(0, 160)).not.toContain("SIN_CONFIRMAR");
    });

    it("el marcador se cuenta en la base, no sobre la lista con `take: 100`", () => {
        const servicio = leerCodigo(SERVICIO);
        expect(servicio).toContain("contarFamiliasAtendidas");
        expect(servicio).toContain("contarPorProfesional");
        // Contar sobre la lista capada haría que el número mienta a partir de 100.
        expect(servicio).not.toMatch(/familiasAtendidas: new Set\(/);
    });

    it("los expedientes compartidos se listan, no se abren (brief §9)", () => {
        const panel = leerCodigo(PANEL);
        expect(panel).not.toMatch(/href=.*expediente/i);
        expect(leer(PANEL)).toContain("se abre con el código que la familia te entrega");
    });
});

describe("SPEC-425 · el desglose de la tarifa sale de un solo lugar", () => {
    it("el cobro y la pantalla usan la MISMA constante", () => {
        const ruta = leerCodigo("src/app/api/padre/citas/route.ts");
        expect(ruta).toContain('from "@/lib/profesional/cita/comision"');
        expect(ruta).not.toMatch(/const PORCENTAJE_SERVICIO_DEFAULT\s*=/);
    });

    it("el desglose usa el mismo redondeo que el cobro", () => {
        // `cita.service.ts:93` hace round(consulta * pct / 100).
        const d = desglosarTarifa(180000, 15);
        expect(d.servicioRed).toBe(27000);
        expect(d.pagaElPadre).toBe(207000);
        expect(d.tarifaProfesional).toBe(180000);
    });

    it("una tarifa impar redondea igual que el motor", () => {
        expect(desglosarTarifa(99999, 15).servicioRed).toBe(Math.round((99999 * 15) / 100));
    });

    it("el default es el que aplica el producto hoy", () => {
        expect(PORCENTAJE_SERVICIO_DEFAULT).toBe(15);
    });
});

describe("SPEC-425 · el profesional aterriza en su panel, en los DOS mapas", () => {
    it("`homeParaRol` (cliente) lo manda a /dashboard/profesional", () => {
        expect(leerCodigo("src/lib/auth/home-para-rol.ts")).toContain('return "/dashboard/profesional"');
    });

    it("`homeForRole` (proxy) también — el gemelo no puede quedar divergente", () => {
        // Sin este caso caía al default /dashboard/admin, que su propia puerta
        // le niega: el doble rebote que SPEC-127 documentó para el padre.
        expect(leerCodigo("src/lib/proxy.ts")).toContain('rol === "PROFESIONAL"');
    });

    it("la página existe donde los dos mapas apuntan", () => {
        expect(fs.existsSync(path.join(RAIZ, "src/app/dashboard/profesional/page.tsx"))).toBe(true);
    });

    it("y la puerta lo DEJA entrar — apuntar a una ruta que se le niega es el rebote de I-25", () => {
        // No alcanza con que el mapa apunte bien: si `esDestinoPermitidoPorRol`
        // dijera que no, el profesional rebotaría en bucle. Se comprueba el
        // predicado real, no la tabla generada.
        expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/profesional")).toBe(true);
        // Y sigue sin poder entrar al área interna.
        expect(esDestinoPermitidoPorRol("PROFESIONAL", "/dashboard/admin")).toBe(false);
    });
});
