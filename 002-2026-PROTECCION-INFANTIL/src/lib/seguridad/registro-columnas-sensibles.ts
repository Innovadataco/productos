/**
 * SPEC-765 (D-121) · Registro de columnas sensibles con eje de SUPERFICIE — FUENTE ÚNICA
 * de «esta columna es sensible PARA QUIÉN».
 *
 * ═══ §1 · INVENTARIO (la clasificación estaba DISPERSA en 5 fuentes) ═══
 * Una columna no es sensible en abstracto: lo es para una SUPERFICIE. `direccionAtencion` es
 * interna para el directorio público pero se expone CON cita confirmada; `email` del padre es
 * normal para él pero el profesional no debería verlo. Una lista plana no puede decir esto.
 * Las 5 fuentes que este registro CONSOLIDA (relación (b) ESPEJO VERIFICADO: el registro vive
 * aparte y un candado cruza cada fuente contra él y FALLA si discrepan — no se derivan de él;
 * derivarlas sería mover a 002 un control legal que aplica Jelkin en 006):
 *   1. Whitelist de `bi_replica` — `006/scripts/replica-setup/02-pi-db-publicacion.sql`
 *      (allow-list por columna, deny-by-default, Ley 1581, 45 tablas). Superficie `replica-bi`.
 *   2. REVOKEs del rol `bi_replica` (SPEC-762, `006/.../01,02,03,08`) — ContenidoReporte/LlaveReporte.
 *   3. `CAMPOS_INTERNOS_PROFESIONAL` (`src/lib/profesional/dto.ts`). Superficie `directorio-publico`.
 *   4. `CAMPOS_INTERNOS_CITA` (`src/lib/profesional/cita/dto.ts`). Superficie `cliente-cita`.
 *   5. Cifrado at-rest (ContenidoReporte.texto*Cifrado por DEK). Superficie `en-reposo`.
 *
 * DEJADAS AFUERA a propósito (responden OTRA pregunta, no clasificación de columna):
 *   · `demo_marcado` — clasifica FILAS por procedencia (demo/sintética), no columnas.
 *   · `pii-patterns`/anonimizador — clasifican TEXTO como PII (`detectar…(texto)`), no columnas.
 *
 * ═══ HALLAZGO DECLARADO · NO existe mapa de columnas para anonimización ═══
 * Se anonimiza POR INVOCACIÓN, NO POR CLASIFICACIÓN: `anonimizarTexto(modelo, texto)` se llama
 * a mano en 4 sitios sueltos —`api/admin/correcciones/route.ts`, `lib/ai/sandbox.ts`,
 * `lib/ai/dataset-anonimizacion-backfill.ts`, `lib/dal/services/reporte-processing/anonimizacion.ts`—
 * sobre `reporte.texto`. NO hay respuesta a «¿qué columnas se anonimizan?», así que nadie puede
 * verificar cobertura ni saber si una columna de texto libre NUEVA debería entrar. Cuando el CEO
 * le dé número, entra a ESTE registro como una superficie propia (`anonimizacion-texto`).
 *
 * ═══ LÍMITES DECLARADOS (un verde acá NO es cobertura total) ═══
 *   · ASIMETRÍA: el candado verifica la dirección PELIGROSA (algo marcado sensible-para-`replica-bi`
 *     que SIGUE en el whitelist). La otra dirección —algo en el whitelist que deberíamos haber
 *     clasificado y no clasificamos— NINGÚN registro la caza: es el desconocido desconocido.
 *   · ALCANCE: enfocado en las columnas donde el eje de superficie APORTA. NO espejo las 45 tablas
 *     del whitelist columna por columna (eso sería la relación (a)); el candado hace SUBSET contra él.
 *   · ACOPLAMIENTO CROSS-PRODUCTO: el candado LEE el SQL de 006. Si 006 mueve/renombra ese archivo,
 *     el candado se entera ROMPIÉNDOSE (falla ruidoso; nunca pasa en verde con cero tablas).
 */

/** Para QUIÉN es sensible una columna. Una misma columna puede serlo para varias superficies. */
export type Superficie =
    | "replica-bi" // la réplica analítica de BI (whitelist deny-by-default, Ley 1581)
    | "directorio-publico" // el DTO público del directorio de profesionales
    | "cliente-cita" // el DTO de la cita que ve el cliente (padre)
    | "en-reposo" // cifrada en la BD (DEK); ni el operador de BD la lee en claro
    | "operador-soporte" // el operador de SOPORTE (ve contacto para ayudar)
    | "operador-sesion" // el operador de SESIÓN (NO debe ver contacto)
    | "profesional"; // el profesional (ve datos del padre que el padre no expondría)

export interface EntradaColumnaSensible {
    /** Tabla Prisma (PascalCase, como en el schema y en el whitelist de 006). */
    tabla: string;
    /** Columna. */
    columna: string;
    /** Para qué superficies es sensible (≥1). */
    sensiblePara: Superficie[];
    /** Por qué, en una línea. */
    razon: string;
    /** De qué fuente de las 5 sale (para el cruce del candado). */
    fuente: string;
}

export const REGISTRO_COLUMNAS_SENSIBLES: readonly EntradaColumnaSensible[] = [
    // ── Fuente 3 · CAMPOS_INTERNOS_PROFESIONAL → directorio-publico ──
    { tabla: "PerfilProfesional", columna: "numeroTarjetaProfesional", sensiblePara: ["directorio-publico"], razon: "credencial profesional; nunca al DTO público", fuente: "CAMPOS_INTERNOS_PROFESIONAL" },
    { tabla: "PerfilProfesional", columna: "datosFacturacion", sensiblePara: ["directorio-publico"], razon: "dato financiero; nunca al DTO público", fuente: "CAMPOS_INTERNOS_PROFESIONAL" },
    { tabla: "PerfilProfesional", columna: "autorizacionArchivoId", sensiblePara: ["directorio-publico"], razon: "archivo interno de autorización", fuente: "CAMPOS_INTERNOS_PROFESIONAL" },
    { tabla: "PerfilProfesional", columna: "autorizacionSubidaEn", sensiblePara: ["directorio-publico"], razon: "metadato interno de autorización", fuente: "CAMPOS_INTERNOS_PROFESIONAL" },
    { tabla: "PerfilProfesional", columna: "direccionAtencion", sensiblePara: ["directorio-publico"], razon: "contacto H-2 (#665/#708): interno para el directorio, se expone SOLO con cita confirmada", fuente: "CAMPOS_INTERNOS_PROFESIONAL" },
    // ── Fuente 4 · CAMPOS_INTERNOS_CITA → cliente-cita ──
    { tabla: "SolicitudCita", columna: "enlaceReunion", sensiblePara: ["cliente-cita"], razon: "enlace de videollamada; lo crea el operador, gateado por estado (SPEC-750)", fuente: "CAMPOS_INTERNOS_CITA" },
    { tabla: "SolicitudCita", columna: "enlaceOperadorId", sensiblePara: ["cliente-cita"], razon: "quién publicó el enlace; interno", fuente: "CAMPOS_INTERNOS_CITA" },
    { tabla: "SolicitudCita", columna: "enlacePublicadoEn", sensiblePara: ["cliente-cita"], razon: "cuándo se publicó el enlace; interno", fuente: "CAMPOS_INTERNOS_CITA" },
    // ── Fuentes 5 + 2 · cifrado at-rest + REVOKE bi_replica → en-reposo + replica-bi ──
    { tabla: "ContenidoReporte", columna: "textoCifrado", sensiblePara: ["en-reposo", "replica-bi"], razon: "texto del reporte cifrado con DEK; REVOKEado del rol bi_replica (SPEC-762)", fuente: "cifrado-at-rest + REVOKE-762" },
    { tabla: "ContenidoReporte", columna: "textoOriginalCifrado", sensiblePara: ["en-reposo", "replica-bi"], razon: "texto ORIGINAL (evidencia) cifrado con DEK; REVOKEado de bi_replica", fuente: "cifrado-at-rest + REVOKE-762" },
    // ── Adición 2 · superficie profesional (el registro puede decir que 754 la vació) ──
    { tabla: "Usuario", columna: "email", sensiblePara: ["profesional"], razon: "el email del PADRE queda visible al profesional en la cita (calendario.service / cita/dto), gateado por contactoVisiblePorSesion; SPEC-754 lo cierra — cuando lo haga, esta entrada se retira", fuente: "codigo: calendario.service.ts + profesional/cita/dto.ts" },
] as const;
