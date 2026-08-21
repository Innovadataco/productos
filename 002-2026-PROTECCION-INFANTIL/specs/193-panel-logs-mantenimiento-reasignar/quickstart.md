# Quickstart — Panel de Logs + Mantenimiento + Reasignar Operador

**Feature**: [spec.md](spec.md)

Este quickstart asume que el entorno local ya está levantado (Postgres en Docker, app en `localhost:5005`, migraciones aplicadas).

---

## 1. Preparar el entorno

```bash
# Asegurar variables de entorno
cp .env.example .env
# Editar .env con DATABASE_URL, JWT_SECRET, etc.

# Levantar base de datos
docker compose up -d db

# Instalar dependencias y aplicar migraciones
npm install
npm run db:migrate

# Sembrar parámetros nuevos y datos base
npm run db:seed
```

Verificar que los parámetros nuevos existen:

```bash
npx prisma studio
# Buscar en ParametroSistema:
#   monitoreo.logs.enabled = true
#   monitoreo.logs.nivel_minimo = WARN
#   monitoreo.logs.max_muestras_ui = 500
```

---

## 2. Crear logs de prueba

### Opción A: desde un worker instrumentado

Levantar el worker correspondiente:

```bash
# App
npm run dev

# Worker de reportes
npm run worker

# Monitor y simulador (según instrucciones del proyecto)
npm run worker:monitor
npm run worker:simulador-abuso
```

Cada proceso emitirá logs a `stdout`; los de nivel `>= WARN` se reflejarán en `WorkerLog`.

### Opción B: desde un script de prueba

Crear un script temporal (no commitear) para llenar la tabla:

```ts
import { PrismaClient, NivelLog } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.workerLog.createMany({
    data: [
      { servicio: 'pi-worker', nivel: NivelLog.ERROR, mensaje: 'Timeout Ollama', contextoJson: { reporteId: 'r1' } },
      { servicio: 'pi-app', nivel: NivelLog.WARN, mensaje: 'Rate limit cercano', contextoJson: { scope: 'reporte' } },
      { servicio: 'pi-monitor', nivel: NivelLog.INFO, mensaje: 'Heartbeat OK', contextoJson: {} },
    ],
  });
}

main().finally(() => prisma.$disconnect());
```

> Nota: el script requiere que el modelo `WorkerLog` ya exista en el cliente de Prisma tras la migración.

---

## 3. Probar el endpoint de consulta de logs

Iniciar sesión como `ADMIN` y obtener la cookie de sesión.

```bash
curl -s 'http://localhost:5005/api/admin/monitoreo/logs?limit=10' \
  -H 'Cookie: session=<cookie_admin>' | jq
```

Probar filtros:

```bash
# Solo errores del worker
curl -s 'http://localhost:5005/api/admin/monitoreo/logs?servicio=pi-worker&nivel=ERROR' \
  -H 'Cookie: session=<cookie_admin>' | jq

# Rango de fechas + búsqueda
curl -s 'http://localhost:5005/api/admin/monitoreo/logs?desde=2026-08-20T00:00:00Z&hasta=2026-08-21T23:59:59Z&q=timeout' \
  -H 'Cookie: session=<cookie_admin>' | jq
```

Verificar acceso denegado con otro rol:

```bash
curl -s 'http://localhost:5005/api/admin/monitoreo/logs?limit=10' \
  -H 'Cookie: session=<cookie_operador>' | jq
# Esperado: { "error": "Forbidden" } con status 403
```

---

## 4. Probar la purga manual

Abrir la UI en `/dashboard/admin/configuracion`, sección "Mantenimiento", o usar el endpoint directamente.

```bash
curl -s -X DELETE 'http://localhost:5005/api/admin/monitoreo/logs' \
  -H 'Cookie: session=<cookie_admin>' \
  -H 'Content-Type: application/json' \
  -d '{
    "hasta": "2026-08-20T23:59:59.999Z",
    "motivo": "Limpieza de prueba de logs antiguos previos a la feature"
  }' | jq
```

Verificar:

1. El `DELETE` devuelve `{ "filasBorradas": N }`.
2. Los logs anteriores a la fecha límite desaparecen de `GET /api/admin/monitoreo/logs`.
3. Existe un `AuditLog` con `accion='LOGS_MANTENIMIENTO_PURGA'`.
4. Intentar borrar con `hasta` igual a hoy retorna `400`.

---

## 5. Probar la reasignación

### Requisitos previos

- Un reporte en estado `REVISION_MANUAL` o `PROCESADO` con `operadorId` asignado.
- Un usuario destino con rol `OPERADOR` y estado activo.
- Sesión de `ADMIN`.

### Desde la UI

1. Ir a `/dashboard/admin/operadores/asignar` o a la ficha de un operador.
2. Hacer clic en "Reasignar" de un caso.
3. Seleccionar operador destino e ingresar motivo (mínimo 20 caracteres).
4. Confirmar.
5. Verificar que el caso aparece ahora bajo el operador destino.

### Desde curl

```bash
curl -s -X PATCH 'http://localhost:5005/api/admin/operadores/reasignar' \
  -H 'Cookie: session=<cookie_admin>' \
  -H 'Content-Type: application/json' \
  -d '{
    "reporteId": "<reporte_id>",
    "operadorDestinoId": "<operador_destino_id>",
    "motivo": "Reasignación de prueba para validar trazabilidad del cambio"
  }' | jq
```

Verificar:

1. `Reporte.operadorId` ahora apunta al operador destino.
2. Existe una fila en `TransicionReporte` con metadatos de reasignación.
3. Existe un `AuditLog` con `accion='REPORTE_REASIGNADO_MANUAL'`.
4. Intentar reasignar un reporte `PENDIENTE` retorna `400`.
5. Intentar reasignar a un usuario inactivo o no `OPERADOR` retorna `400`/`404`.

---

## 6. Verificar la UI de monitoreo

1. Abrir `/dashboard/admin/estadisticas/operacion`.
2. Seleccionar el sub-tab "Logs".
3. Aplicar filtros y observar la tabla.
4. Hacer clic en una fila para ver el `contextoJson` en un modal.
5. Activar/desactivar el autorefresco de 30 s.
6. Navegar a `/dashboard/admin/configuracion` y editar "Monitoreo → Logs".

---

## 7. Gate local

Antes de cerrar la feature, ejecutar:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
./scripts/dev-restart.sh
```

Verificar que todos los checks pasan.
