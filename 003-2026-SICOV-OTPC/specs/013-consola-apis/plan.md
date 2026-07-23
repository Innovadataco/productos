# Implementation Plan — 013-consola-apis (Fase 1)

**Branch**: `feature/001-scaffolding` · **Date**: 2026-07-23 · **Spec**: [spec.md](./spec.md)

**Status**: PLANEADO — **MODO PLAN: gate de ZEUS antes de implementar** (Fase 1 D-047; regla CEO
AGENTS §6: cero Super; se construye junto a la spec 009 — comparten módulo Configuración y guard)

## 1. Resumen técnico

Consola de APIs (submódulo `apis` de `configuracion`, solo rol 1) que en Fase 1 ejecuta
EXCLUSIVAMENTE contra el **cliente stub existente** (doble gate apagado) y construye desde ya el
**logging permanente** de llamadas. El diseño deja Fase 2 como "quitar el candado", no como
reestructura: el catálogo declara para cada operación el MÉTODO del cliente que la ejecutará, y
ese cliente es la MISMA interfaz `ClienteSupertransporte` que en modo real resuelve a `ClienteHttp`.

## 2. Cómo queda lista para Fase 2 SIN ejecutar real ahora (lo pedido)

1. **Un solo camino de ejecución:** `ejecutarOperacion(clave, payload, usuario)` llama SIEMPRE
   `getClienteSupertransporte()` — la factory existente que hoy devuelve stub porque el doble gate
   (`INTEGRACIONES_MODO=stub` + `SUPERTRANSPORTE_HABILITADO=false`) está apagado. En Fase 2, la
   decisión EXPLÍCITA del CEO enciende el gate y la consola ejecuta real **sin tocar su código**.
2. **Candado de fase ADICIONAL en código (no en env):** constante `FASE_CONSOLA = 1` en
   `catalogo.ts`; el endpoint de "ejecutar en real" responde 403 mientras sea 1. Así ni un `.env`
   mal cargado puede adelantar la Fase 2 desde la consola: cambiarla exige commit revisado.
3. **Catálogo declarativo:** cada entrada = {clave, título, método HTTP, pathExterno, cabeceras
   (nombres), ejemplo, ejecutor: "postTransaccional"|"postMantenimiento"|"getMantenimiento"|
   "consultarIntegradora"|"consultarRutasActivas"|"consultarAutorizaciones", opciones (p. ej.
   `conVigiladoId`)}. El mapeo ejecutor→método del cliente es una tabla, no un switch disperso.
4. **La bitácora ya registra `modo`** (`stub|real` leído de `modoIntegracion()`): en Fase 2 las
   filas reales caen en la MISMA tabla con el mismo esquema.

## 3. Modelo de datos (única tabla NUEVA, aditiva — propia del 003)

```prisma
/// Bitácora de la consola de APIs (spec 013). Fase 1: todas las filas modo=stub.
model ApiLlamada {
  id         Int       @id @default(autoincrement()) @map("apl_id")
  usuarioId  Int       @map("apl_usuario_id")
  rolId      Int?      @map("apl_rol_id")
  nitEfectivo String?  @map("apl_nit_efectivo") @db.VarChar(30)
  operacion  String    @map("apl_operacion") @db.VarChar(60)
  modo       String    @map("apl_modo") @db.VarChar(10)      // stub | real
  metodo     String?   @map("apl_metodo") @db.VarChar(10)
  endpoint   String?   @map("apl_endpoint") @db.VarChar(255) // path externo declarado (no secreto)
  request    Json?     @map("apl_request") @db.JsonB         // REDACTADO RECURSIVO (claves sensibles → "***") y truncado
  respuesta  Json?     @map("apl_respuesta") @db.JsonB       // truncada
  status     Int?      @map("apl_status")
  duracionMs Int?      @map("apl_duracion_ms")
  error      String?   @map("apl_error") @db.Text
  creado     DateTime? @default(now()) @map("apl_creado") @db.Timestamptz()

  @@index([creado])
  @@index([operacion])
  @@index([modo])
  @@map("tbl_api_llamadas")
  @@schema("sicov")
}
```

Migración `add_consola_apis` (solo CREATE; `--create-only` + revisión). Prefijo `apl_` propio del
003 (no existe en el legacy — tabla nueva declarada como tal). Columnas `jsonb` (indexable, más
eficiente para la bitácora). Redacción ANTES de persistir: lista de claves (`clave`, `contrasena`,
`token`, `tokenAutorizado`, `Authorization`...) → `"***"`; **RECURSIVA** — recorre el árbol JSON
completo (objetos y arrays anidados a cualquier profundidad), no solo el primer nivel; truncado a
8 KB por columna jsonb (documentado).

## 4. Estructura

```
src/lib/consola-apis/
├── catalogo.ts      # 7 operaciones Fase 1 + pendientes 006/007/008 (listadas, no ejecutables)
│                    # + FASE_CONSOLA = 1 + tabla ejecutor→método del cliente
├── ejecutar.ts      # ejecutarOperacion(): valida contra catálogo, cronometra, llama al cliente
│                    # (stub por gate), redacta y registra en ApiLlamada; nunca lanza sin registrar
└── redactar.ts      # redacción RECURSIVA de sensibles (objetos/arrays anidados) + truncado (+ tests)

src/app/api/configuracion/apis/
├── catalogo/route.ts   # GET catálogo (rol 1 + guard configuracion/apis)
├── ejecutar/route.ts   # POST {operacion, payload} → stub + bitácora; body real=true → 403 Fase 2
└── llamadas/route.ts   # GET bitácora paginada con filtros (operacion, modo, status, fecha)

src/app/dashboard/configuracion/apis/page.tsx   # lista + formulario + resultado + bitácora;
                                                # botón "Ejecutar en real" disabled + nota "Fase 2"
```

Guard: `requiereModulo(u, "configuracion", "apis")` (extensión de submódulo de la spec 009) +
`verifyAuth([1])`. UI hereda breadcrumb del layout (I-14) — sin navegación propia.

## 5. Flujo de una ejecución (Fase 1)

1. `verifyAuth([1])` + guard → 403 a roles 2/3.
2. Valida `operacion` ∈ catálogo y payload JSON (400 si inválido; intento registrado).
3. `t0` → despacho por tabla de ejecutores al método del cliente (`getClienteSupertransporte()` =
   **stub**; cero red — mismo guardarraíl de toda la suite).
4. Redacta request/respuesta → inserta `ApiLlamada` (éxito o error, siempre) → responde
   {respuesta, duracionMs, logId, modo:"stub"}.

## 6. Qué NO entra (explícito)

- **Ninguna ejecución real** ni cliente nuevo: no se escribe NI deshabilitado el código que llame
  `ClienteHttp` directo — el único camino es la factory con gate + candado `FASE_CONSOLA`.
- Operaciones 006/007/008: solo entradas "pendiente" en el catálogo (sin formulario ejecutable).
- Purga/retención y exportación de bitácora (deuda anotada); reintentos desde la consola.

## 7. Fases de implementación (post-aprobación, tras/junto a 009)

1. **Datos:** migración `add_consola_apis` (+ pg_dump previo) — puede ir en la misma tanda de
   datos de la spec 009.
2. **Lib:** catalogo + redactar + ejecutar (+ tests: catálogo válido, redacción, cero red,
   registro en éxito y error, 403 real).
3. **API:** 3 rutas + tests (roles/guard, 400 payload, paginación bitácora).
4. **UI:** página de consola (commit propio) — botón real `disabled` + nota "Fase 2".
5. **Verificación:** suite previa + nuevos; tsc/lint/build; navegador en ventana privada (ejecutar
   una operación stub, ver bitácora, confirmar botón real deshabilitado y 403 del endpoint);
   staging explícito (AGENTS §6).

## 8. Riesgos

- **Tentación de "probar" real:** mitigada por doble candado (gate env apagado + `FASE_CONSOLA`
  en código) y test que asegura 403 del camino real.
- Datos sensibles en bitácora: redacción RECURSIVA testeada con payloads anidados (clave sensible
  en objeto/array profundo → `"***"`); revisión en el gate de implementación con un payload real
  de ejemplo.
- Crecimiento de la bitácora: sin purga en Fase 1 (volumen bajo, solo rol 1); deuda anotada.

---

**⛔ DETENIDO (MODO PLAN).** Tras aprobación: `/speckit.tasks` → `/speckit.analyze` → implementación
coordinada con la spec 009 (misma tanda de datos y módulo Configuración).
