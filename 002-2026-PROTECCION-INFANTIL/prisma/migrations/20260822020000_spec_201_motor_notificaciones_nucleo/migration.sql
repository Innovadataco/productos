-- SPEC-201 (002-PI-098): Motor de Notificaciones · núcleo
-- Migración aditiva. Cero DROPs.

-- Enums del motor (bilingual DB: valores en español)
CREATE TYPE "EstadoNotificacion" AS ENUM (
    'ENCOLADA',
    'ENVIANDO',
    'ENVIADA',
    'ABIERTA',
    'CLICADA',
    'FALLIDA',
    'REINTENTANDO',
    'CANCELADA'
);

CREATE TYPE "CanalNotificacion" AS ENUM (
    'EMAIL',
    'IN_APP'
);

-- Tabla de envíos individuales (cola + auditoría)
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "destinatarioUsuarioId" TEXT,
    "destinatarioEmail" TEXT NOT NULL,
    "plantillaClave" TEXT NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "variables" JSONB NOT NULL,
    "sujetoTipo" TEXT,
    "sujetoId" TEXT,
    "enviarEn" TIMESTAMPTZ(6),
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'ENCOLADA',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "proveedorId" TEXT,
    "sentAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "openedAt" TIMESTAMPTZ(6),
    "clickedAt" TIMESTAMPTZ(6),
    "bouncedAt" TIMESTAMPTZ(6),
    "canceladoEn" TIMESTAMPTZ(6),
    "motivoCancelacion" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_notificaciones_estado_enviarEn" ON "notificaciones" ("estado", "enviarEn");
CREATE INDEX "idx_notificaciones_destinatarioUsuarioId_createdAt" ON "notificaciones" ("destinatarioUsuarioId", "createdAt" DESC);
CREATE INDEX "idx_notificaciones_evento_createdAt" ON "notificaciones" ("evento", "createdAt" DESC);
CREATE INDEX "idx_notificaciones_proveedorId" ON "notificaciones" ("proveedorId");

-- Tabla de plantillas
CREATE TABLE "notificacion_plantillas" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "asunto" TEXT,
    "cuerpoMarkdown" TEXT NOT NULL,
    "variablesSchema" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaPor" TEXT,
    "actualizadaPor" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_plantillas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notificacion_plantillas_clave_key" UNIQUE ("clave")
);

-- Tabla de reglas programables
CREATE TABLE "notificacion_reglas" (
    "id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "offset" TEXT NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "plantillaClave" TEXT NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaPor" TEXT,
    "actualizadaEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_reglas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_notificacion_reglas_evento_activa" ON "notificacion_reglas" ("evento", "activa");

-- Tabla de preferencias de usuario (opt-out)
CREATE TABLE "notificacion_preferencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "eventoRegla" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_preferencias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notificacion_preferencias_usuarioId_eventoRegla_key" UNIQUE ("usuarioId", "eventoRegla")
);

CREATE INDEX "idx_notificacion_preferencias_usuarioId" ON "notificacion_preferencias" ("usuarioId");

-- Tabla de contactos bloqueados por bounces
CREATE TABLE "notificacion_contactos_bloqueados" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bounceCount" INTEGER NOT NULL DEFAULT 1,
    "ultimoBounce" TIMESTAMPTZ(6) NOT NULL,
    "motivo" TEXT NOT NULL,
    "bloqueadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificadoAdminEn" TIMESTAMPTZ(6),

    CONSTRAINT "notificacion_contactos_bloqueados_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notificacion_contactos_bloqueados_email_key" UNIQUE ("email")
);

CREATE INDEX "idx_notificacion_contactos_bloqueados_email" ON "notificacion_contactos_bloqueados" ("email");
