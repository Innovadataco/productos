# Plan de implementación: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

## Resumen

Hardcodear `America/Bogota` como timezone único del producto: contenedores Docker con `TZ=America/Bogota`, almacenamiento tz-aware en Postgres (`@db.Timestamptz(6)`), librería `date-fns-tz` para aritmética temporal, frontend con `timeZone: "America/Bogota"` forzado, y tests de medianoche. Migración aditiva, sin cambios en `src/lib/ai/**` ni en `SHOW TIME ZONE` de Postgres.

## Cambios de código

### 1. Infraestructura Docker

#### 1.1 `docker-compose.prod.yml`

Agregar `TZ: America/Bogota` en la sección `environment` de los cuatro servicios:

- `app` (`pi-app`)
- `worker` (`pi-worker`)
- `monitor` (`pi-monitor`)
- `simulador-abuso` (`pi-simulador-abuso`)

Ejemplo para `app`:

```yaml
environment:
  PORT: "3000"
  HOSTNAME: "0.0.0.0"
  WORKER_RUN_DIR: /app/run
  TZ: America/Bogota
```

No tocar el servicio `db`; `SHOW TIME ZONE` debe seguir siendo `Etc/UTC`.

### 2. Dependencias

#### 2.1 `package.json`

Agregar en `dependencies`:

```json
"date-fns": "^4.1.0",
"date-fns-tz": "^3.2.0"
```

(o la versión de `date-fns-tz` compatible con el entorno; verificar que `date-fns-tz@^3` requiere `date-fns@^4`). Luego ejecutar `npm install` para actualizar `package-lock.json`.

### 3. Modelo de datos

#### 3.1 `prisma/schema.prisma`

Añadir `@db.Timestamptz(6)` a todos los campos `DateTime` que representen momentos. Excepciones:

- Campos con `@db.Date` (representan día calendario sin hora): se mantienen.
- Campos que ya tengan `@db.Timestamptz(3)`: se unifican a `@db.Timestamptz(6)`.

Ejemplo de cambio:

```prisma
// Antes
creadoEn DateTime @default(now())

// Después
creadoEn DateTime @default(now()) @db.Timestamptz(6)
```

No aplicar a campos de catálogos que representen solo fecha si los hubiera (`@db.Date`).

#### 3.2 Migración aditiva

Generar con:

```bash
npx prisma migrate dev --name add_timestamptz_bogota
```

Verificar que el SQL generado sea `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ(6)` sin destruir datos. Si Postgres permite la conversión implícita de `timestamp without time zone` a `timestamp with time zone` usando la sesión actual, asegurar que la migración se ejecute con una sesión UTC (`Etc/UTC`) para no desplazar los valores almacenados.

### 4. Helpers de fecha

#### 4.1 `src/lib/colegio/fechas-humano.ts`

Refactorizar para usar `date-fns-tz` y `America/Bogota`:

```ts
import { formatInTimeZone, toDate } from "date-fns-tz";

const TZ = "America/Bogota";

export function fechaLargaES(fecha: Date): string {
    return formatInTimeZone(fecha, TZ, "eeee d 'de' MMMM 'de' yyyy", { locale: es });
}

export function relativoHumano(fecha: Date, ahora: Date = new Date()): string {
    // Calcular diferencia de tiempo en ms (sin sesgo de TZ).
    const ms = ahora.getTime() - fecha.getTime();
    // ... lógica existente, usando formatInTimeZone para el fallback de fecha corta.
}

export function etiquetaPeriodo(periodo: string, granularidad: GranularidadTendencia): string {
    const fecha = toDate(periodo, { timeZone: TZ });
    if (Number.isNaN(fecha.getTime())) return periodo;
    if (granularidad === "anual") return formatInTimeZone(fecha, TZ, "yyyy");
    if (granularidad === "mensual") return formatInTimeZone(fecha, TZ, "MMM yyyy", { locale: es });
    return formatInTimeZone(fecha, TZ, "d MMM", { locale: es });
}
```

Importar locale `es` de `date-fns/locale`.

#### 4.2 Nuevo helper reutilizable (opcional pero recomendado)

Crear `src/lib/fechas/formato-bogota.ts` con funciones tipo:

```ts
export function formatoFechaBogota(fecha: Date, formato: string): string;
export function formatoCortoBogota(fecha: Date): string;
```

Si no se crea, centralizar en `fechas-humano.ts`.

### 5. Frontend

#### 5.1 `src/lib/colegio/render-informe-mensual.tsx`

Cambiar:

```tsx
return new Date().toLocaleDateString("es-CO", { ... });
```

por:

```tsx
return new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", ... });
```

#### 5.2 `src/lib/expediente/expediente-forense.ts`

Igual: agregar `timeZone: "America/Bogota"` a `toLocaleDateString`.

#### 5.3 Otros usos

Ejecutar grep y aplicar `timeZone: "America/Bogota"` a toda aparición de `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` o `Intl.DateTimeFormat` en `src/`. Si alguno requiere intencionalmente la timezone del usuario, documentar con comentario justificativo; por defecto, todos usan Bogotá.

### 6. Aritmética temporal

#### 6.1 Revisión de `src/lib/apelaciones.ts`

Las funciones `esDiaHabil`, `sumarDiasHabiles`, `diasHabilesTranscurridos` operan sobre día calendario. Convertir para usar `date-fns-tz`:

```ts
import { addDays, formatInTimeZone, getDay } from "date-fns-tz";

function diaCalendarioBogota(fecha: Date): number {
    return Number(formatInTimeZone(fecha, TZ, "d"));
}

function esDiaHabilBogota(fecha: Date): boolean {
    const dia = Number(formatInTimeZone(fecha, TZ, "i")); // 1=lunes...7=domingo
    return dia >= 1 && dia <= 5;
}
```

Mantener la semántica actual de días hábiles (lunes-viernes).

#### 6.2 Otros módulos con aritmética de días

Revisar y adaptar según sea necesario:

- `src/lib/apelacion-mantenimiento.ts`
- `src/lib/spam/analitica.ts`
- `src/lib/spam/sla.ts`
- `src/lib/email.ts`
- `src/lib/colegio/avisos.ts` (ya usa `diaBogota` con `Intl`; verificar que siga siendo consistente)
- `src/lib/colegio/informe-mensual.ts`
- `src/lib/simulacion/progreso.ts`

Criterio: si el cálculo afecta lógica de negocio (SLA, vencimiento, corte, ventana de reportes), debe usar `date-fns-tz` con Bogotá. Si es solo duración pura (ms entre dos timestamps), `Date.getTime()` sigue siendo válido.

### 7. Tests

#### 7.1 `src/lib/colegio/fechas-humano.test.ts`

Añadir tests de medianoche:

```ts
it("muestra el día correcto a las 23:59 Bogotá", () => {
    const fecha = new Date("2026-08-21T23:59:00.000-05:00");
    expect(fechaLargaES(fecha)).toBe("viernes 21 de agosto de 2026");
});

it("muestra el día correcto a las 00:01 Bogotá", () => {
    const fecha = new Date("2026-08-22T00:01:00.000-05:00");
    expect(fechaLargaES(fecha)).toBe("sábado 22 de agosto de 2026");
});
```

Asegurar que los tests corran con `TZ=UTC` en CI para demostrar que no dependen del sistema.

#### 7.2 Tests de helper nuevo

Si se crea `src/lib/fechas/formato-bogota.ts`, añadir `src/lib/fechas/formato-bogota.test.ts` con casos básicos.

### 8. Documentación

- Actualizar `docs/architecture/06-stack.md` si cambia algo del stack (nueva dependencia `date-fns-tz`).
- `specs/200-infra-timezone-bogota/quickstart.md`: instrucciones de prueba manual post-deploy.
- `specs/200-infra-timezone-bogota/data-model.md`: resumen de campos afectados.

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
