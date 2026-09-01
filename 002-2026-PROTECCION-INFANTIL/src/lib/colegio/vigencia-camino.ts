/**
 * SPEC-357 (I-254) — El colegio que está EN el camino guiado no se corta por vigencia.
 *
 * El encierro que arregla esta función, verificado en vivo por Calidad (prod
 * `e137caab`): un colegio con la vigencia caída a mitad del camino recibe del
 * guardián la orden de terminar el paso 3 y, al intentarlo, el handler le
 * responde 403 «El servicio del colegio ha vencido». El camino le exige
 * terminar y el cobro le impide terminar — solo un administrador podía sacarlo.
 *
 * La decisión: mientras `derivarPasoPendienteColegio` devuelva un paso, el
 * colegio está TERMINANDO SU CONFIGURACIÓN y las cinco familias de rutas que el
 * camino necesita (profesores, cursos, materias, alumnos, carga) le quedan
 * abiertas. Apenas el camino cierra (paso `null`), la vigencia vuelve a mandar
 * exactamente como antes: un colegio configurado y vencido sigue cortado.
 *
 * Esto NO es una exención nueva de producto: el middleware ya eximía estas
 * rutas del guardián de vigencia (SPEC-344/355 · `vigencia.SCHOOL_ADMIN`); el
 * handler las cerraba por dentro. Son las dos capas del mismo guardián puestas
 * de acuerdo (familia I-211).
 */
import { verificarVigenciaCliente, type ResultadoVigencia } from "./vigencia";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

const VIGENTE_POR_CAMINO: ResultadoVigencia = { vigente: true, estado: "vigente", mensaje: "" };

/**
 * Igual que `verificarVigenciaColegio`, salvo que un SCHOOL_ADMIN con el camino
 * guiado a medias pasa aunque su servicio esté vencido (SPEC-357 · I-254).
 *
 * Se usa en las rutas que el camino del colegio necesita para completarse. Para
 * cualquier otra ruta sigue valiendo `verificarVigenciaColegio` a secas.
 */
export async function verificarVigenciaColegioSalvoCamino(usuarioId: string): Promise<ResultadoVigencia> {
    const vigencia = await verificarVigenciaCliente(usuarioId);
    if (vigencia.vigente) return vigencia;

    // La excepción cubre SOLO la ventana de servicio vencida — el encierro de
    // I-254. Un colegio `inactivo` (dado de baja por un administrador) o
    // `sin_colegio` sigue cortado: ahí el corte no es de cobro, es de estado, y
    // el camino no puede ser una puerta trasera para volver a operar.
    if (vigencia.estado !== "vencido") return vigencia;

    // Solo el rector recorre el camino del colegio; el resto de roles conserva
    // el corte tal cual (el comité no configura, consume).
    const usuario = await new UsuarioRepository().findVigenciaCliente(usuarioId);
    if (usuario?.rol !== "SCHOOL_ADMIN") return vigencia;

    const paso = await derivarPasoPendienteColegio(usuarioId);
    return paso === null ? vigencia : VIGENTE_POR_CAMINO;
}
