# Resumen de Trabajo — 9 de Julio de 2026

## Contexto

Fecha: 2026-07-09
Proyecto: 001-2026-INNOVADATACO
Rama: feature/001-scaffolding
Hash final: `85fa271`

---

## 1. Implementación del Sistema de Cola con pg-boss

### Objetivo
Implementar un sistema de procesamiento asíncrono de documentos PDF usando PostgreSQL + pg-boss como cola de trabajos, con un worker que procesa los documentos usando IA (Ollama).

### Arquitectura implementada

```
┌─────────────┐     POST /api/documents      ┌─────────────┐
│  Navegador  │ ─────────────────────────────>│  Next.js    │
│             │     (responde inmediatamente) │  API Route  │
└─────────────┘                               └──────┬──────┘
                                                     │
                              ┌──────────────────────┘
                              │ encola job en pg-boss
                              ▼
                       ┌─────────────┐
                       │  PostgreSQL │
                       │  pgboss.job │
                       └──────┬──────┘
                              │
                              │ worker lee job
                              ▼
                       ┌─────────────┐
                       │   Worker    │
                       │  (PM2)      │
                       │  tsx + .mjs │
                       └──────┬──────┘
                              │
                              │ llama Ollama
                              ▼
                       ┌─────────────┐
                       │  qwen2.5:32b│
                       │  (local)    │
                       └─────────────┘
```

### Componentes creados

| Componente | Archivo | Descripción |
|-----------|---------|-------------|
| Worker | `scripts/worker.mjs` | Procesa documentos de la cola pg-boss |
| API Route | `src/app/api/documents/route.ts` | Recibe PDFs, extrae texto, encola en pg-boss |
| Inicializador | `scripts/init-pgboss.mjs` | Crea tablas de pg-boss en PostgreSQL |
| Verificación | `scripts/check-db.mjs` | Verifica estado de documentos en BD |
| Verificación cola | `scripts/check-queue.mjs` | Verifica jobs en pg-boss |
| Verificación doc | `scripts/check-doc.mjs` | Verifica documento específico |
| Debug worker | `scripts/debug-worker.mjs` | Worker simplificado para debugging |

### Scripts de npm agregados

```bash
npm run worker        # Ejecutar worker manualmente
npm run init-pgboss   # Inicializar tablas de pg-boss
npm run start:all     # Levantar dev-server + worker con PM2
npm run stop:all      # Detener todos los procesos PM2
npm run logs          # Ver logs de PM2
npm run status        # Ver estado de procesos PM2
```

---

## 2. Bugs Corregidos

### Bug 1: Condición de carrera en getBoss()
**Problema**: Dos requests concurrentes creaban instancias de pg-boss que se pisaban.
**Solución**: Usar `bossPromise` en lugar de `boss` para que todas las llamadas esperen la misma inicialización.

### Bug 2: Proceso de cola bloqueado en BaseTab
**Problema**: `setQueue` es asíncrono, `currentItem` asignado dentro del callback no persistía fuera.
**Solución**: Usar `queueRef` para lectura sincrónica del estado actual.

### Bug 3: useProcessingDocs no cargaba documentos
**Problema**: El filtro `?status=queued,processing` no funcionaba en el endpoint.
**Solución**: Fetch todos los documentos y filtrar en cliente.

### Bug 4: Caracteres UTF-8 rotos
**Problema**: Labels mostraban `T\u00edtulo`, `N\u00famero`, etc. (16+ ocurrencias en BaseTab, 23 en entidadesColombia, etc.)
**Solución**: Reemplazar secuencias de escape `\uXXXX` con caracteres UTF-8 reales en 6 archivos.

### Bug 5: pg-boss no tenía tablas en PostgreSQL
**Problema**: El schema de pg-boss nunca fue creado en la BD.
**Solución**: Script `init-pgboss.mjs` + comando `npm run init-pgboss`.

### Bug 6: pg-boss v12 pasa jobs como array
**Problema**: `job.data` era `undefined` porque pg-boss v12 pasa `[{id, name, data}]` en lugar de `{id, name, data}`.
**Solución**: `const job = Array.isArray(jobs) ? jobs[0] : jobs`

### Bug 7: PATCH /api/documents falla con fechaExpedicion inválida
**Problema**: Prisma rechazaba fechas no ISO-8601 completas.
**Solución**: `parseDateSafe()` convierte string vacío → null, fecha inválida → null, válida → Date. Whitelist de campos editables.

### Bug 8: Worker moría silenciosamente
**Problema**: El worker era un proceso sin supervisión; si moría, los documentos se quedaban en cola indefinidamente.
**Solución**: PM2 con `autorestart: true`. Detectado y confirmado con `kill -9` + reinicio automático en 5 segundos.

---

## 3. Mejoras de UX

### Detección de cola estancada
En `BaseTab.tsx`, si un documento lleva >10 minutos en `queued`, muestra advertencia visible:
> ⚠️ El procesamiento parece detenido — verifica que el worker esté corriendo (npm run status)

### Logging explícito en Ollama
En `modelClients.ts`:
```javascript
[Ollama] Iniciando llamada a qwen2.5:32b en http://localhost:11434...
[Ollama] Respuesta recibida en 43281ms, ok: true
```

### Mensaje de confirmación al subir
Al subir un PDF, aparece mensaje verde: "X documentos en cola de procesamiento. Puedes salir de esta página."

### Advertencia de modelo grande
Si el modelo activo es de 32B/70B+, muestra advertencia: "El procesamiento puede tardar varios minutos."

---

## 4. Verificación de funcionamiento

### Evidencia de procesamiento exitoso

```
[Ollama] Iniciando llamada a qwen2.5:32b en http://localhost:11434...
[Ollama] Respuesta recibida en 43281ms, ok: true
[Worker] Metadata parseada: {
  titulo: 'RESOLUCIÓN NÚMERO 20203040034065',
  entidad: 'Ministra de Transporte',
  sector: 'Transporte',
  fecha: '2020-12-29',
  resumen: 'Esta resolución reglamenta las condiciones...',
  ...
}
[Worker] Documento procesado exitosamente. Status: completed
```

### Evidencia de reinicio automático PM2

```
ANTES:  worker PID 50659, uptime 81s, restarts 0
kill -9 50659
DESPUÉS: worker PID 53437, uptime 5s, restarts 1
```

---

## 5. Comandos para operar el sistema

```bash
# Setup inicial (solo una vez)
npm install
npx prisma migrate deploy
npm run init-pgboss
node scripts/seedApis.mjs
node scripts/seedUser.mjs

# Levantar todo (forma oficial con PM2)
npm run start:all

# Monitorear
npm run status   # Estado de procesos
npm run logs     # Logs en tiempo real

# Detener
npm run stop:all
```

---

## 6. Próximas tareas identificadas

| Prioridad | Tarea | Descripción |
|-----------|-------|-------------|
| Alta | ParametrizaciónTab.tsx | Crear pestaña de parametrización en módulo Configuración |
| Media | Tests del worker | Agregar tests unitarios para processDocument |
| Media | Manejo de errores Ollama | Retry con backoff exponencial si Ollama no responde |
| Baja | Dashboard de métricas | Mostrar estadísticas de procesamiento en UI |
| Baja | Procesamiento paralelo | Configurar múltiples workers con PM2 cluster mode |

---

## Gobierno

Desarrollado bajo contrato ODIN / Fábrica de Software ZEUS.