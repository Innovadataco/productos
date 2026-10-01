-- SPEC-772 · Modelo SolicitudHabeasData: registro REGISTRADO y VENCEABLE de una petición de habeas
-- data (Ley 1581 de 2012, arts. 14-15), espejo de ApelacionIdentificador. Es el ÚNICO rastro durable
-- de la petición (no había dónde: AuditConsentimiento es inmutable/aceptación, AuditLog es efecto de
-- acción, el correo entrante vive en un buzón externo).
--
-- Las restricciones van ESTRUCTURALES (la base rechaza, no el servicio) y nacen VALIDADAS: la tabla se
-- crea vacía en esta misma migración, así que cada ADD CONSTRAINT ... CHECK valida trivialmente (no hay
-- fila que indultar) y queda como candado duro de INSERT/UPDATE. NUNCA NOT VALID (indulta e inmoviliza).

-- CreateEnum
CREATE TYPE "TipoSolicitudHabeasData" AS ENUM ('CONSULTA', 'RECTIFICACION', 'SUPRESION');

-- CreateEnum
CREATE TYPE "CalidadPeticionario" AS ENUM ('TITULAR_CUENTA', 'REPRESENTANTE_LEGAL', 'TITULAR_MAYORIA_EDAD');

-- CreateEnum
CREATE TYPE "EstadoSolicitudHabeasData" AS ENUM ('RECIBIDA', 'EN_REVISION', 'RESUELTA');

-- CreateEnum
CREATE TYPE "OrigenSolicitudHabeasData" AS ENUM ('APLICACION', 'CORREO', 'OTRO');

-- CreateEnum · resultado DESPOJADO: la disposición es un conjunto CERRADO, la base no admite narrativa.
CREATE TYPE "ResultadoSolicitudHabeasData" AS ENUM ('ATENDIDA_COMPLETA', 'ATENDIDA_PARCIAL', 'RECHAZADA');

-- CreateEnum · CLASE de dato afectada (nunca el contenido): un operador no puede teclear un nombre acá.
CREATE TYPE "ClaseDatoTitular" AS ENUM ('PERFIL', 'HIJOS', 'IDENTIFICADORES_CIRCULO', 'RELATO_CITA', 'CONTENIDO_REPORTE', 'OTRO');

-- CreateTable
CREATE TABLE "SolicitudHabeasData" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSolicitudHabeasData" NOT NULL,
    "estado" "EstadoSolicitudHabeasData" NOT NULL DEFAULT 'RECIBIDA',
    "calidad" "CalidadPeticionario" NOT NULL,
    "peticionarioUsuarioId" TEXT,
    "sujetoDelDato" TEXT,
    "plazoDias" INTEGER NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibidoEn" TIMESTAMPTZ(6) NOT NULL,
    "origen" "OrigenSolicitudHabeasData" NOT NULL,
    "venceEn" TIMESTAMPTZ(6) NOT NULL,
    "resueltaEn" TIMESTAMPTZ(6),
    "resultado" "ResultadoSolicitudHabeasData",
    "clasesDatoAfectadas" "ClaseDatoTitular"[],

    CONSTRAINT "SolicitudHabeasData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudHabeasData_estado_venceEn_idx" ON "SolicitudHabeasData"("estado", "venceEn");

-- CreateIndex
CREATE INDEX "SolicitudHabeasData_peticionarioUsuarioId_idx" ON "SolicitudHabeasData"("peticionarioUsuarioId");

-- AddForeignKey
ALTER TABLE "SolicitudHabeasData" ADD CONSTRAINT "SolicitudHabeasData_peticionarioUsuarioId_fkey" FOREIGN KEY ("peticionarioUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK 1 · EJE DE SUJETO (FR-6). El sujeto del dato tiene que ser coherente con la calidad:
--   · TITULAR_CUENTA pide sobre SÍ MISMO → NO nombra un sujeto aparte (sujetoDelDato IS NULL).
--   · REPRESENTANTE_LEGAL / TITULAR_MAYORIA_EDAD piden sobre OTRO (el menor, o su yo-menor histórico)
--     → sujetoDelDato OBLIGATORIO.
-- A propósito NO menciona peticionarioUsuarioId: así el SET NULL del FK (al borrar la cuenta) nunca puede
-- volver la fila inconstruible. El HECHO sobrevive; el enlace al actor puede vaciarse. La combinación
-- «peticionario ≠ dueño de la cuenta del dato» queda CONSTRUIBLE (A-9): el modelo no la ata a ningún dueño.
ALTER TABLE "SolicitudHabeasData" ADD CONSTRAINT "SolicitudHabeasData_eje_sujeto_check" CHECK (
    ("calidad" = 'TITULAR_CUENTA' AND "sujetoDelDato" IS NULL)
    OR ("calidad" IN ('REPRESENTANTE_LEGAL', 'TITULAR_MAYORIA_EDAD') AND "sujetoDelDato" IS NOT NULL)
);

-- CHECK 2 · TECHO LEGAL DEL PLAZO (Ley 1581 arts. 14-15): consulta ≤ 10 días hábiles, reclamo
-- (rectificación/supresión) ≤ 15. El plazo OPERACIONAL puede ser MENOR (prometer una respuesta más
-- rápida) pero JAMÁS mayor, y nunca < 1. Mismos valores que src/lib/habeas-data/plazos-legales.ts [NORMA].
ALTER TABLE "SolicitudHabeasData" ADD CONSTRAINT "SolicitudHabeasData_plazo_techo_legal_check" CHECK (
    ("tipo" = 'CONSULTA' AND "plazoDias" BETWEEN 1 AND 10)
    OR ("tipo" IN ('RECTIFICACION', 'SUPRESION') AND "plazoDias" BETWEEN 1 AND 15)
);

-- CHECK 3 · COHERENCIA TEMPORAL: el vencimiento va DESPUÉS de la recepción (venceEn = recibidoEn + N
-- días hábiles, N ≥ 1). Se ancla en recibidoEn, NO en creadoEn: una petición recibida por correo y
-- tecleada días después tendría venceEn anterior a creadoEn, y un CHECK contra creadoEn la rechazaría.
ALTER TABLE "SolicitudHabeasData" ADD CONSTRAINT "SolicitudHabeasData_vence_gt_recibido_check" CHECK (
    "venceEn" > "recibidoEn"
);

-- INMUTABILIDAD de recibidoEn (transición, no estado → va en TRIGGER, no en CHECK). recibidoEn es la
-- PRUEBA de que atendimos en término: si la fecha de inicio se pudiera mover, la prueba no valdría nada.
-- El trigger solo bloquea el cambio de recibidoEn; el resto de columnas (estado, resueltaEn, resultado,
-- y el vaciado de peticionarioUsuarioId por el FK SET NULL) se actualizan con normalidad.
CREATE OR REPLACE FUNCTION "solicitudHabeasData_recibidoEn_inmutable"()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."recibidoEn" IS DISTINCT FROM NEW."recibidoEn" THEN
        RAISE EXCEPTION 'SolicitudHabeasData.recibidoEn es inmutable (SPEC-772): ancla el plazo legal y es la prueba del término; no se puede cambiar una vez fijado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "solicitudHabeasData_recibidoEn_inmutable_trg"
    BEFORE UPDATE ON "SolicitudHabeasData"
    FOR EACH ROW
    EXECUTE FUNCTION "solicitudHabeasData_recibidoEn_inmutable"();
