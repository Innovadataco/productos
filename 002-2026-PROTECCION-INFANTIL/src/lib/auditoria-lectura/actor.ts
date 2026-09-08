import { AsyncLocalStorage } from "node:async_hooks";

/**
 * SPEC-584 (Fase 2) · Hilo conductor del actor de lectura del texto del reporte.
 *
 * Por qué AsyncLocalStorage (y no un parámetro explícito en `descifrarCamposReporte`):
 * los lectores actuales son ~9 call-sites entre rutas, servicios del DAL y libs de
 * negocio (spam, comité, expediente); un parámetro explícito obligaría a cambiar TODAS
 * las firmas y cada llamador interno, con riesgo real de perder el hilo en un camino
 * nuevo. ALS propaga la identidad por el async context con cero cambios de firma — es
 * el mecanismo estándar de la industria para contexto de request (OpenTelemetry,
 * continuation-local storage). La alternativa (parámetro explícito) queda descartada
 * salvo que ALS falle en algún entorno; los tests cubren propagación y aislamiento.
 *
 * La frontera DAL del descifrado (`src/lib/dal/services/descifrar-contenido.ts`) lee
 * el store al registrar la auditoría de cada campo visto.
 */

export type TipoActorLectura = "PLATAFORMA" | "EXTERNO";

export interface ActorLectura {
    /** Usuario autenticado que ve el texto (interno) o que canjeó el código (externo). */
    usuarioId?: string;
    /** Snapshot del rol al momento de la lectura. */
    rol?: string;
    ip?: string;
    userAgent?: string;
    /** PLATAFORMA (interno autenticado) | EXTERNO (sesión por código temporal). Default PLATAFORMA. */
    tipoActor?: TipoActorLectura;
    /** Vínculo con el código temporal canjeado (solo lecturas EXTERNO). */
    codigoAccesoId?: string;
}

const almacen = new AsyncLocalStorage<ActorLectura>();

/** Ejecuta `fn` con el actor de lectura disponible para todo el subárbol async. */
export async function conActor<T>(actor: ActorLectura, fn: () => Promise<T> | T): Promise<T> {
    return almacen.run(actor, () => Promise.resolve(fn()));
}

/** Actor del contexto actual; `undefined` fuera de `conActor` (lectores no instrumentados). */
export function actorActual(): ActorLectura | undefined {
    return almacen.getStore();
}

/** Extrae el actor desde la sesión del usuario y la petición (wrapper de ruta). */
export function actorDesdeRequest(
    usuario: { id: string; rol: string },
    request: Request
): ActorLectura {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) ?? request.headers.get("x-real-ip") ?? undefined;
    const userAgent = request.headers.get("user-agent");
    return {
        usuarioId: usuario.id,
        rol: usuario.rol,
        ...(ip ? { ip } : {}),
        ...(userAgent ? { userAgent } : {}),
    };
}
