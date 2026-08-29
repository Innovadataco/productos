> DEPENDE DE: SPEC-200 (timezone Bogotá).

# Plan de implementación: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

## Resumen

Implementar el núcleo del motor de notificaciones: modelos Prisma, repositorios DAL, API pública en `src/lib/notificaciones/`, worker `scripts/worker-notificaciones.mjs`, seed de reglas/parámetros, gestión de bounces y quiet hours. El motor es 100% lógica, usa `date-fns-tz` con `America/Bogota`, y se integra con Resend para email y con la bandeja in-app existente.

## Cambios de código

### 1. Modelo de datos

#### 1.1 `prisma/schema.prisma`

Añadir 5 modelos según BRIEF §5.1-5.5 (todos con `@db.Timestamptz(6)` por SPEC-200):

```prisma
enum CanalNotificacion {
  EMAIL
  IN_APP
}

enum EstadoNotificacion {
  ENCOLADA
  ENVIANDO
  ENVIADA
  ABIERTA
  CLICADA
  FALLIDA
  REINTENTANDO
  CANCELADA
}

model Notificacion {
  id                    String              @id @default(cuid())
  evento                String
  destinatarioUsuarioId String?
  destinatarioEmail     String
  plantillaClave        String
  canal                 CanalNotificacion
  variables             Json
  sujetoTipo            String?
  sujetoId              String?
  enviarEn              DateTime?           @db.Timestamptz(6)
  estado                EstadoNotificacion
  intentos              Int                 @default(0)
  ultimoError           String?
  proveedorId           String?
  sentAt                DateTime?           @db.Timestamptz(6)
  deliveredAt           DateTime?           @db.Timestamptz(6)
  openedAt              DateTime?           @db.Timestamptz(6)
  clickedAt             DateTime?           @db.Timestamptz(6)
  bouncedAt             DateTime?           @db.Timestamptz(6)
  canceladoEn           DateTime?           @db.Timestamptz(6)
  motivoCancelacion     String?
  createdAt             DateTime            @default(now()) @db.Timestamptz(6)

  @@index([estado, enviarEn])
  @@index([destinatarioUsuarioId, createdAt(sort: Desc)])
  @@index([evento, createdAt(sort: Desc)])
}

model NotificacionPlantilla {
  id             String            @id @default(cuid())
  clave          String            @unique
  canal          CanalNotificacion
  asunto         String?
  cuerpoMarkdown String
  variablesSchema Json
  version        Int               @default(1)
  activa         Boolean           @default(true)
  creadaPor      String?
  actualizadaPor String?
  createdAt      DateTime          @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime          @updatedAt @db.Timestamptz(6)
}

model NotificacionRegla {
  id             String            @id @default(cuid())
  evento         String
  rol            String
  offset         String
  canal          CanalNotificacion
  plantillaClave String
  obligatoria    Boolean           @default(false)
  activa         Boolean           @default(true)
  creadaPor      String?
  actualizadaPor String?
  createdAt      DateTime          @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime          @updatedAt @db.Timestamptz(6)

  @@index([evento, activa])
}

model NotificacionPreferencia {
  id          String  @id @default(cuid())
  usuarioId   String
  eventoRegla String
  habilitado  Boolean @default(true)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)

  @@unique([usuarioId, eventoRegla])
}

model NotificacionContactoBloqueado {
  id                String   @id @default(cuid())
  email             String   @unique
  bounceCount       Int      @default(1)
  ultimoBounce      DateTime @db.Timestamptz(6)
  motivo            String
  bloqueadoEn       DateTime @db.Timestamptz(6)
  notificadoAdminEn DateTime? @db.Timestamptz(6)
}
```

#### 1.2 Migración aditiva

```bash
npx prisma migrate dev --name add_motor_notificaciones
```

### 2. Seed

#### 2.1 `prisma/seed.ts`

Añadir bloque que crea:
- Plantillas semilla (una por cada `clave` usada por las reglas: email + in-app).
- Las 6 reglas del BRIEF §6.
- Parámetros del BRIEF §5.6.

Todas las inserciones idempotentes con `upsert` (excepto donde el BRIEF indique forzar versión).

### 3. API pública del motor

#### 3.1 `src/lib/notificaciones/motor.ts`

Exportar:

```ts
export async function programar(input: {
  evento: string;
  sujetoTipo?: string;
  sujetoId?: string;
  destinatarios: Array<{
    usuarioId?: string;
    email?: string;
    variables: Record<string, unknown>;
  }>;
  enviarEn?: Date;
  metadatos?: Record<string, unknown>;
}): Promise<{ programadas: number; canceladasPorReemplazo: number }>;

export async function cancelar(criterio: {
  evento?: string;
  sujetoTipo?: string;
  sujetoId?: string;
  destinatarioUsuarioId?: string;
  soloProgramadas?: boolean;
}): Promise<{ canceladas: number }>;

export async function estado(id: string): Promise<Notificacion | null>;

export async function recalcular(input: {
  evento: string;
  motivo: string;
}): Promise<{ recalculadas: number; reglaAnterior: unknown; reglaNueva: unknown }>;
```

Responsabilidades:
- Leer reglas activas del evento.
- Para cada destinatario, resolver email (usuario o explícito).
- Calcular `enviarEn` con `date-fns-tz` + offset de regla.
- Aplicar quiet hours (desplazar fuera de ventana).
- Verificar preferencia si regla no obligatoria.
- Renderizar variables contra `variablesSchema` (Zod/JSON Schema).
- Insertar `Notificacion` en estado `ENCOLADA`.
- `recalcular`: cancelar programadas y reprogramar.

#### 3.2 Helpers

- `src/lib/notificaciones/calcular-envio.ts`: cálculo de `enviarEn` con timezone y quiet hours.
- `src/lib/notificaciones/render-plantilla.ts`: render de markdown con variables `{{nombre}}`.
- `src/lib/notificaciones/quiet-hours.ts`: parseo de `notificaciones.horario.silencio`.
- `src/lib/notificaciones/preferencias.ts`: lectura/creación de preferencias efectivas.

### 4. Worker

#### 4.1 `scripts/worker-notificaciones.mjs`

- Usar `pg-boss` (mismo `src/lib/queue.ts`) o poll directo a BD con advisory lock.
- Decisión: poll directo es más simple para v1 (igual que worker-reportes).
- Loop: cada `notificaciones.worker.intervalo_segundos`.
- Query: `SELECT ... FROM Notificacion WHERE estado IN ('ENCOLADA','REINTENTANDO') AND enviarEn <= now() AND enviarEn fuera de quiet hours ORDER BY enviarEn LIMIT batch`.
- Marcar `ENVIANDO`, enviar, marcar resultado.
- Para email: llamar a Resend (reutilizar `src/lib/email.ts` o función interna).
- Para in-app: crear fila en `NotificacionInApp` (reutilizar `NotificacionInAppRepository`).
- Registrar bounces.

#### 4.2 Advisory lock

Usar el mismo patrón que `scripts/worker-supervisor.mjs`: advisory lock en PostgreSQL; segundo worker sale con código 2.

### 5. Webhook Resend

#### 5.1 `src/app/api/webhooks/resend/route.ts`

- Verificar firma si Resend la envía (o token secreto).
- Mapear eventos: `delivered` → `ENVIADA`, `opened` → `ABIERTA`, `clicked` → `CLICADA`, `bounced`/`complained` → `FALLIDA` + bounce.
- Idempotencia por `proveedorId`.
- Tests `src/app/api/webhooks/resend/route.test.ts`.

### 6. Docker

#### 6.1 `docker-compose.prod.yml`

Añadir servicio:

```yaml
notificaciones:
  image: pi-app:${PI_APP_TAG:-latest}
  container_name: pi-notificaciones
  restart: always
  env_file: .env.production
  command: node scripts/worker-notificaciones.mjs
  environment:
    WORKER_RUN_DIR: /app/run
    TZ: America/Bogota
    API_BASE_URL: http://app:3000
  volumes:
    - pi_worker_run:/app/run
  depends_on:
    db:
      condition: service_healthy
    app:
      condition: service_started
```

### 7. Tests

#### 7.1 Tests unitarios

- `src/lib/notificaciones/calcular-envio.test.ts`
- `src/lib/notificaciones/render-plantilla.test.ts`
- `src/lib/notificaciones/quiet-hours.test.ts`
- `src/lib/notificaciones/preferencias.test.ts`

#### 7.2 Tests de integración

- `src/lib/notificaciones/motor.test.ts`
- `src/app/api/webhooks/resend/route.test.ts`

### 8. Documentación

- `specs/201-motor-notificaciones-nucleo/quickstart.md`
- `specs/201-motor-notificaciones-nucleo/data-model.md`
- Actualizar `docs/architecture/06-stack.md` si se agrega worker.

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
