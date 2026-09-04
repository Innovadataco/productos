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
import { desglosarTarifa, CLAVE_COMISION } from "../cita/comision";
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
const CERRAR = "src/components/modules/profesional/CerrarConCodigo.tsx";
const ABRIR = "src/components/modules/profesional/AbrirExpediente.tsx";

describe("SPEC-425 · el panel no promete lo que no puede hacer", () => {
    it("solo se pintan los botones que tienen motor", () => {
        const acciones = leerCodigo(ACCIONES);
        // La URL se arma con plantilla: `.../solicitudes/${id}/${accion}`, y la
        // acción sale del tipo — por eso se afirma el tipo y el endpoint base.
        expect(acciones).toContain('"confirmar" | "rechazar"');
        expect(acciones).toContain("/api/profesional/solicitudes/");
        // SPEC-427 sumó el cierre; SPEC-427b, abrir el expediente con su código.
        // Cada botón nuevo apunta a un endpoint real.
        expect(leerCodigo(CERRAR)).toContain("/api/profesional/citas/");
        expect(leerCodigo(ABRIR)).toContain("/api/profesional/citas/");
        const botones = (leerCodigo(PANEL) + acciones + leerCodigo(CERRAR) + leerCodigo(ABRIR)).match(/<button/g) ?? [];
        // Confirmar, No puedo, Cerrar cita, No se presentó, Abrir expediente.
        expect(botones, "cinco botones, todos con motor").toHaveLength(5);
    });

    it("no aparece ninguno de los controles que siguen sin motor", () => {
        const todo = leerCodigo(PANEL) + leerCodigo(ACCIONES) + leerCodigo(CERRAR) + leerCodigo(ABRIR);
        // «cerrar y cobrar» sigue muerto aunque SPEC-427 implementó el cierre:
        // el COBRO es de L7. Cerrar sí; cobrar todavía no. «No se presentó» dejó
        // esta lista el 03-09: ya tiene motor (`marcarNoAsistioElPadre`).
        for (const muerto of ["Proponer otro horario", "cerrar y cobrar"]) {
            expect(todo, `"${muerto}" no tiene implementación: no puede ser un control`).not.toContain(muerto);
        }
    });

    it("sigue diciendo qué falta, y no con un control apagado", () => {
        // Lo que falta cambió: el cierre ya está, el GIRO de la plata no (L7).
        // La pantalla lo dice en palabras en vez de insinuarlo con un botón gris.
        expect(leer(PANEL)).toContain("todavía no está disponible");
        // Un `disabled` fijo sería un botón apagado prometiendo algo. Los
        // `disabled` legítimos son los de los botones vivos mientras trabajan.
        expect(leerCodigo(PANEL)).not.toContain("disabled");
    });

    /** Los .ts/.tsx de producción bajo src/, sin tests. */
    function fuentesDeProduccion(): string[] {
        const salida: string[] = [];
        const recorrer = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const r = path.join(dir, e.name);
                if (e.isDirectory()) recorrer(r);
                else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) salida.push(r);
            }
        };
        recorrer(path.join(RAIZ, "src"));
        return salida;
    }

    it("SPEC-427 · `CUMPLIDA` se escribe en UN solo lugar, y es el del cierre", () => {
        // Este test decía «nadie escribe CUMPLIDA» y cayó el día que SPEC-427
        // implementó el cierre — que era exactamente para lo que estaba puesto.
        // Ahora custodia lo siguiente: que haya UNA sola puerta. Dos lugares
        // escribiendo el mismo estado terminan discrepando.
        const escritores = fuentesDeProduccion().filter((r) =>
            /estado:\s*"CUMPLIDA"/.test(fs.readFileSync(r, "utf-8")),
        );
        expect(escritores.map((r) => path.relative(RAIZ, r))).toEqual([
            "src/lib/dal/repositories/solicitud-cita.ts",
        ]);
    });

    it("SPEC-427 · `NO_ASISTIO_PADRE` también tiene UN solo escritor", () => {
        // Los dos estados de cierre viven en el mismo lugar. Que un segundo
        // archivo empiece a escribir cualquiera de los dos es el principio de
        // que digan cosas distintas según por dónde entre la petición.
        const escritores = fuentesDeProduccion().filter((r) =>
            /estado:\s*"NO_ASISTIO_PADRE"/.test(fs.readFileSync(r, "utf-8")),
        );
        expect(escritores.map((r) => path.relative(RAIZ, r))).toEqual([
            "src/lib/dal/repositories/solicitud-cita.ts",
        ]);
    });

    it("CONTRAPRUEBA · los dos estados de cierre se buscan de verdad en el árbol", () => {
        // Un candado que no encuentra nada porque el patrón está mal siempre
        // pasa. Este comprueba que el patrón SÍ encuentra al escritor legítimo.
        const repo = fs.readFileSync(
            path.join(RAIZ, "src/lib/dal/repositories/solicitud-cita.ts"),
            "utf-8",
        );
        expect(/estado:\s*"CUMPLIDA"/.test(repo)).toBe(true);
        expect(/estado:\s*"NO_ASISTIO_PADRE"/.test(repo)).toBe(true);
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

    it("SPEC-427b · el expediente se abre SOLO con el código, nunca por un enlace", () => {
        // SPEC-425 los dejaba listados sin abrir. 427b los abre —pero solo con
        // el código que dicta el padre—. Lo que NO puede haber es un `href` que
        // lleve al expediente saltándose el código: el acceso pasa por el POST
        // que consume el código, no por un link.
        const panel = leerCodigo(PANEL);
        expect(panel).not.toMatch(/href=.*expediente/i);
        // El componente que abre existe y entra por el endpoint, no por navegación.
        expect(panel).toContain("AbrirExpediente");
        const abrir = leerCodigo(ABRIR);
        expect(abrir).toContain("/api/profesional/citas/");
        expect(abrir).not.toMatch(/href=.*expediente/i);
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

    it("SPEC-403: el porcentaje ya no es una constante del código", () => {
        // El número correcto es 10 y lo edita el admin sin desplegar (I-288).
        expect(CLAVE_COMISION).toBe("comision.porcentaje");
        const comision = leerCodigo("src/lib/profesional/cita/comision.ts");
        expect(comision).not.toMatch(/=\s*1[05]\s*;/);
        expect(comision).toContain("getParametroSistemaValor");
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
