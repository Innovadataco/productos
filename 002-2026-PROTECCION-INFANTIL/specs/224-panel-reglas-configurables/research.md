# Research: SPEC-224 — Panel de reglas configurables

## 1. Contexto del problema

El módulo Análisis dinero-vs-valor (mesa ARQ_12, BRIEF-ANALISIS-DINERO-VS-VALOR) define un cerebro comercial 100% reglas SQL configurables, sin IA (D-67 por analogía). SPEC-221 construye el motor (modelos + worker + 7 reglas semilla en `RECOMIENDA`), pero sin un panel admin toda calibración exigiría un deploy o SQL directo — contradice el principio del brief §2: "todos los pesos, reglas, umbrales parametrizables desde admin, cero deploys para tunear".

El instructivo 002-PI-125 fija el alcance: CRUD en `/dashboard/admin/analisis/reglas`, editor con SQL preview + test contra datos reales, promoción `RECOMIENDA → EJECUTA` con confirmación fuerte (D-77) y versionado.

Esta investigación resuelve las incógnitas contra el código real del repo.

## 2. Incógnitas resueltas contra el código

### 2.1 ¿Existe ya algo del módulo Análisis en la rama?

- `grep` por `ReglaRecomendacion|Recomendacion|ModoRegla|analisis` en `prisma/schema.prisma` → **cero coincidencias**. Los modelos llegan con SPEC-220/221 dentro del mismo mega-lote (rama compartida `work/002-PI-mega-cola-restante`).
- `src/app/dashboard/admin/` tiene: `anti-abuso, colegios, comite, configuracion, dataset-entrenamiento, estadisticas, ia, monitoreo, operadores, padres, pagos, spam, usuarios` — **no existe `analisis/`**. La ruta es nueva.
- **Conclusión**: SPEC-224 documenta su consumo de `ReglaRecomendacion`/`Recomendacion` como dependencia de SPEC-221 y añade de forma aditiva lo que le falte (`version`, historial).

### 2.2 Patrón de endpoint admin existente (fuente de verdad)

`src/app/api/admin/pagos/planes/route.ts:13-21` muestra el patrón canónico que esta spec replica:

```typescript
const admin = await verifyAuth("ADMIN");
await assertModulo(admin, "pagos_admin");
const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
```

- `verifyAuth` es la única fuente de verdad de auth (`src/lib/auth.ts`, según AGENTS.md).
- `assertModulo(user, clave)` lanza `AppError` 403 si el rol no tiene el permiso (`src/lib/permisos-modulos.ts:61-67`).
- Errores se serializan con `errorToResponse(error, "[MODULO]")` (`src/lib/api-handler.ts`).
- Paginación `{ items, pagination }` con helper `paginatedResponse` (`src/lib/pagos/api-helpers.ts`, usado en la misma route).
- Schemas Zod viven en `src/lib/schemas/` (ej. `pagosQuerySchema` en `src/lib/schemas/pagos.ts`).

**Conclusión**: los 6 endpoints de SPEC-224 siguen este patrón sin variantes; nuevo módulo `analisis_admin`.

### 2.3 Catálogo de permisos y navegación

- `src/lib/permisos-catalogo.ts:57` registra `pagos_admin` con `{ clave, nombre, categoria: "admin", esCritico: true, orden: 75 }`; `audit_logs` en orden 80. **Hueco natural en orden 76** para `analisis_admin`.
- `src/lib/nav-items.ts:24` registra `{ href: "/dashboard/admin/pagos", label: "Pagos", modulo: "pagos_admin" }` — mismo formato para el item nuevo.

**Conclusión**: aditivo en ambos archivos; seed de `PermisoModulo` concede la clave a `ADMIN` de forma idempotente (patrón upsert de `prisma/seed.ts`, ver SPEC-236 research §2.2).

### 2.4 ¿Hay precedente de SQL raw en el repo?

Sí, parametrizado con tagged templates:

- `src/lib/expediente/compilacion/queries/senal-comunitaria.ts:40,55,66,76,87` — `$queryRaw<T>` con interpolación segura.
- `src/lib/dal/repositories/alerta-colegio.ts:208` — idem.
- `src/lib/audit-nuevas-acciones.ts:67,90,109` — `$executeRaw` / `$queryRaw`.

**No existe** precedente de `$queryRawUnsafe` (SQL libre). SPEC-224 lo introduce acotado a un único servicio (`src/lib/analisis/reglas/test-sql.ts`), justificado: la query es definición de la regla escrita por el ADMIN, no input de usuario final; la seguridad la da la TX `READ ONLY` + `statement_timeout` + validador estático, no la parametrización. Los AGENTS.md exigen `Prisma.XWhereInput` tipado para filtros dinámicos — eso aplica al CRUD de reglas (que usa Prisma normal); el test-sql es la excepción documentada y encapsulada.

### 2.5 Auditoría

- `logAudit(params)` en `src/lib/audit.ts:19-48`: acepta `accion: AccionAudit`, `tipoRecurso`, `recursoId`, `valorAnterior`, `valorNuevo`, `metadatos`, `tx` (soporta transacción — clave para el versionado atómico), y hashea la IP automáticamente (`protegerIp`, líneas 11-16).
- Enum `AccionAudit` en `prisma/schema.prisma:46` — convención SCREAMING_SNAKE_CASE con comentario de SPEC origen (ej. línea 54: `// SPEC-171 (Pilar B) ...`). Los valores nuevos `REGLA_*` se añaden al final con comentario `// SPEC-224 (002-PI-125): ...`. PostgreSQL admite `ALTER TYPE ... ADD VALUE` (aditivo, no destructivo).

### 2.6 Modelos que las reglas consultan

- `Suscripcion` (`prisma/schema.prisma:723-758`): `estado`, `fechaFin`, `tipoTitular`, `esFreemium`, `freemiumFechaFin`, `colegioId`, `usuarioId` — cubre las reglas semilla de vencimiento, mora y freemium.
- `Pago` (`prisma/schema.prisma:760+`): `estado`, `fechaReporte`, `fechaAutorizacion` — cubre mora y puntualidad.
- `ParametroSistema` (`prisma/schema.prisma:592-611`): `clave` única, `valor` string, `tipo`, `categoria`, `reglasValidacion` — los parámetros `analisis.reglas.*` se siembran aquí.
- **Sin PII en agregados**: las queries de reglas operan sobre suscripciones/pagos/colegios (datos comerciales del ADMIN), nunca sobre texto de reportes; el candado del instructivo se cumple por construcción y se refuerza en el validador (las tablas `reportes` no están prohibidas por regla general — una regla de "actividad por ciudad" puede contar reportes — pero el test-sql nunca devuelve texto de reporte al panel más allá de la muestra solicitada por el propio admin, que ya tiene acceso; aun así el AuditLog del test nunca guarda filas).

### 2.7 Sistema visual

- Token `ambar` existe: `tailwind.config.ts:27` (`ambar: "rgb(var(--ambar-rgb) / <alpha-value>)"`). Vidrio Apple y radios 16/12/22 vienen del sistema heredado (instructivo; tokens en `src/lib/design-tokens.test.ts` los verifican).
- Páginas índice admin usan redirect a subruta (ej. `src/app/dashboard/admin/pagos/page.tsx` redirige a `pendientes`); para SPEC-224 la página `reglas` es terminal (no necesita índice intermedio).

### 2.8 Timeouts y límites del test

No existe parámetro previo. Se siembran:

- `analisis.reglas.test_timeout_ms` — INTEGER, default 5000 (acotado 1000..30000 al aplicarse).
- `analisis.reglas.test_max_filas` — INTEGER, default 50 (acotado 1..200).

Coherentes con `analisis.recomendaciones.frecuencia_evaluacion_min` (brief §5.7) y con la filosofía "todo parametrizable" (brief §2).

## 3. Decisiones D-77 verificadas

Texto de D-77 (`05-DECISIONES.md:129`): promoción `RECOMIENDA→EJECUTA` "requiere confirmación fuerte y queda en `AuditLog`"; reglas semilla arrancan todas en `RECOMIENDA`; acciones ejecutables v1: `crear_bono_retencion`, `enviar_notificacion`, `asignar_a_operador`, `crear_alerta_admin`. El instructivo añade el formato concreto: "escribe EJECUTA para confirmar" + motivo obligatorio. SPEC-224 implementa exactamente eso; la ejecución de las acciones es SPEC-226.

## 4. Referencias y dependencias

- **SPEC-221** (002-PI-122, misma rama): modelos `ReglaRecomendacion`/`Recomendacion`, enum `ModoRegla`, worker, reglas semilla. Dependencia bloqueante.
- **SPEC-226** (002-PI-127): ejecución de `accionEjecutable`. SPEC-224 solo configura.
- **SPEC-222** (002-PI-123): panel principal Análisis (tab de estadísticas). Rutas hermanas bajo `analisis`, sin solape de archivos.
- **BRIEF-ANALISIS-DINERO-VS-VALOR.md**: §3 (terminología), §5.3 (modelo regla), §8.2 (reglas semilla + acciones), §9 (anatomía DETECCIÓN/GENERACIÓN/RESOLUCIÓN), §10.3 (wireframe del panel).
- **AGENTS.md** + **`.specify/memory/constitution.md`**: convenciones de código, AppError, códigos canónicos, migraciones aditivas.
- **specs/236-motor-estados-worker-eventos/**: formato de referencia de este set de artefactos.

## 5. Lecciones de specs anteriores

- SPEC-212 (reembolsos) demostró el patrón de campos aditivos con comentario de SPEC origen en el schema.
- SPEC-202 demostró que un módulo admin nuevo (`configuracion_notificaciones`, `permisos-catalogo.ts:56`) entra al catálogo con fila aditiva y seed idempotente.
- SPEC-236 research §2.2 confirmó el patrón de seed `upsert` por `clave` para `ParametroSistema`.

## 6. Preguntas abiertas

Ninguna bloqueante. Items menores resueltos por supuesto documentado en `spec.md §Assumptions`:

1. Ruta final `/dashboard/admin/analisis/reglas` (instructivo) vs `/admin/analisis/reglas` (brief shorthand) → se usa la del instructivo, consistente con el repo.
2. Restauración de versiones → fuera de v1 (solo lectura del historial).
3. `clave` inmutable tras creación → decisión tomada (identidad estable para worker e historial).
