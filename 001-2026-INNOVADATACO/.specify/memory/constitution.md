<!--
Sync Impact Report — 2026-07-22 (segunda enmienda del día)
Version change: 2.0.0 → 2.1.0
Bump rationale: MINOR — se añaden dos principios rectores nuevos (§0.7
configurabilidad y precedencia / ADR_004; §0.8 agentes / ADR_003) y se corrige
§3.4 con una fe de erratas. No se elimina ni redefine ningún principio previo,
por lo que no procede MAJOR.
Modified principles: §3.4 "Procesamiento asíncrono con pg-boss" — describía
chunking y embeddings como existentes; el hallazgo H-05 (spec 001, T018) probó
que no existen. Ahora separa el flujo REAL del DISEÑO PREVISTO (spec 003).
Added sections: §0.7 Configurabilidad y precedencia (ADR_004); §0.8 Agentes:
persona + corpus + modelo compartido (ADR_003); nota de retiro de Financials
en §1.2.
Removed sections: ninguna.
Templates: ✅ plan-template.md, spec-template.md, tasks-template.md (el
Constitution Check es genérico y absorbe los principios nuevos sin cambios).
Follow-up TODOs: §3.4 debe volver a actualizarse cuando cierre la spec 003, para
describir el pipeline RAG real en vez del diseño previsto.
-->

# SPECKIT CONSTITUTION — 001-2026-INNOVADATACO

> **Versión:** 2.1.0  
> **Ratificada:** 2026-07-11 · **Última enmienda:** 2026-07-22  
> **Stack:** Next.js 16.2.10 + React 19.2.4 + Prisma 5.22.0 + PostgreSQL 16+ + TypeScript 5.x  
> **Runtime:** Node.js >=22  
> **Módulos activos:** Base Oficial, Licitaciones, Investigación, Proyectos, Configuración  
> **Módulo FUERA DE SCOPE:** Financials (permanentemente no implementar)  
> **Arquitectura API:** Next.js App Router API Routes (no PostgREST, no tRPC, no GraphQL)

---

## 0. PRINCIPIOS RECTORES (GOBERNANZA IDC)

Estos ocho principios son la fuente de autoridad del proyecto. Ante cualquier
conflicto con el resto del documento o con una tarea, prevalecen estos principios.

### 0.1 Spec-driven (Regla de Oro 1)
Ningún cambio entra al código sin una spec aprobada por ZEUS (arquitecto) y Jelkin
(CEO). El flujo es: `/speckit-specify` → aprobación → `/speckit-plan` →
`/speckit-tasks` → `/speckit-implement`. Un cambio sin spec aprobada DEBE rechazarse,
sin importar cuán pequeño o "obvio" parezca.

### 0.2 Pruebas obligatorias
Toda ruta API nueva o modificada DEBE llevar test Vitest. La suite DEBE estar en
verde antes de cada commit. No se commitea con tests rojos ni se posterga el test
"para después".

### 0.3 Tipado estricto
Prohibido introducir `any` nuevo (anotaciones, `as any`, supresiones). Los errores
al cliente van SIEMPRE normalizados: mensaje legible y código HTTP correcto; NUNCA
se filtra `err.message` crudo ni stack traces en la respuesta. El detalle del error
vive solo en los logs del servidor.

### 0.4 12-factor (ADR_001)
Configuración por `.env` (nunca hardcodeada), secretos fuera del código y del
repositorio, infraestructura declarada en `docker-compose.yml`. Criterio de
portabilidad: migrar a un VPS DEBE reducirse a `repo + .env + docker compose up`.

### 0.5 Aislamiento multiproyecto (ADR_002)
A este proyecto le pertenecen SOLO los puertos **5001** (app) y **5435** (BD).
Los puertos 5005/5433 (Protección Infantil) y 5010/5434 (SICOV) son INTOCABLES:
prohibido usarlos, liberarlos o detener procesos/contenedores ajenos. Nunca tocar
infraestructura (contenedores, volúmenes, archivos) de otros productos del monorepo.
Antes de trabajo pesado (inferencia, cargas grandes): avisar a Jelkin y esperar OK;
un solo modelo grande a la vez en la MacStudio. Ver `AGENTS.md`.

### 0.6 IA local por defecto
La inferencia usa Ollama local vía `OLLAMA_BASEURL` como proveedor por defecto.
Proveedores externos (APIs de terceros) son opcionales, se configuran por `.env`/
módulo de Configuración y nunca son requisito para que el sistema funcione.

### 0.7 Configurabilidad y precedencia (ADR_004)
Todo parámetro operativo del sistema (modelos de IA, URLs de servicios, tamaños de
fragmento, solape, top-k, umbrales, pesos de fusión, rutas de corpus) DEBE ser
configurable. La **precedencia es única y no negociable**:

1. **Configuración en BD/UI** (`AiModel`, `ModuleSetting`, módulo de Configuración) — manda.
2. **Variable de entorno** (`.env`) — solo si no hay valor en (1).
3. **Default documentado en el código** — solo si no hay (1) ni (2), y siempre explícito.

**PROHIBIDO** el valor que solo pueda cambiarse editando código. Si un parámetro
requiere recompilar o tocar un archivo `.ts` para ajustarse, es un defecto, no una
decisión de diseño.

Corolario operativo: escribir la configuración no basta — hay que **leerla**. Una
pantalla de configuración cuyo valor el backend ignora es una violación de este
principio, no una funcionalidad pendiente. Esta regla aplica también a las
herramientas de apoyo (bancos de evaluación, scripts de análisis), no solo a la
aplicación.

### 0.8 Agentes: persona + corpus + modelo compartido (ADR_003)
Un "agente" de esta plataforma se compone de **persona** (rol e instrucciones),
**corpus filtrado** (el subconjunto documental que puede consultar) y un **modelo
compartido** de inferencia. NUNCA se entrenan ni afinan modelos propios: la
especialización se logra por contexto y filtrado del corpus, no por pesos.
Consecuencia: un agente nuevo no implica un modelo nuevo; implica configuración
(§0.7) y curaduría documental.

---

## 1. PRINCIPIOS GENERALES

### 1.1 Verdad sobre el estado del código
Antes de implementar cualquier cambio, el agente DEBE:
1. Ejecutar `git pull` para sincronizar con `origin/main`.
2. Leer el contenido real de los archivos afectados. No confiar en resúmenes de tareas previas ni en memoria de contexto.
3. Ejecutar `npm run lint` y `npm run test` para conocer el estado actual antes de modificar.
4. Documentar en el commit qué se verificó.

### 1.2 Scope de módulos
| Módulo | Estado | Política |
|--------|--------|----------|
| Base Oficial (`/documents`, `/api/documents`) | Activo | Evolucionar con chunks RAG |
| Licitaciones (`/licitaciones`, `/api/licitaciones`) | Activo | CRUD completo + scraping futuro |
| Investigación (`/research`, `/api/research`) | Activo | Análisis con IA local/remota |
| Proyectos (`/projects`, `/api/projects`) | Activo | Gestión de proyectos locales |
| Configuración (`/configuracion`, `/api/config`) | Activo | Modelos IA, APIs, audit logs |
| **Financials** | **FUERA DE SCOPE** | **NO crear tablas, rutas, páginas ni componentes. Ignorar completamente.** Retirado del código el 2026-07-22 (aprobación del CEO, I-003): se eliminó `src/app/financials/page.tsx`, único vestigio que quedaba. El esquema nunca tuvo entidades financieras. |

### 1.3 Decisiones arquitectónicas inmutables
- **API Layer:** Únicamente Next.js App Router API Routes (`src/app/api/**/route.ts`). No se autoriza PostgREST, tRPC, GraphQL ni server actions para lógica de negocio.
- **Base de datos:** PostgreSQL con Prisma ORM. No usar raw SQL salvo para migraciones manuales o funciones `Unsupported("vector")`.
- **Autenticación:** JWT manual con `jose` + `bcryptjs`. No instalar NextAuth.js ni Auth.js sin aprobación explícita del tech lead.
- **Colas:** `pg-boss` para procesamiento asíncrono (documentos, embeddings). No usar Bull, Bee Queue ni RabbitMQ.
- **Testing:** Vitest. Entorno por defecto `node` (las rutas API y `src/lib` son código de servidor; bajo jsdom el `TextEncoder` de otro realm rompe el `instanceof` de `jose`). Los tests de componentes React usan `@testing-library/react` declarando `// @vitest-environment jsdom` en su cabecera. No Jest.
- **Estilo:** ESLint con `eslint-config-next`. No Prettier configurado; respetar el estilo existente.

---

## 2. CALIDAD DE CÓDIGO

### 2.1 TypeScript — Reglas no negociables
El `tsconfig.json` tiene `"strict": true`. Esto significa:

| Prohibido | Obligatorio | Ejemplo |
|-----------|-------------|---------|
| `any` como tipo de anotación | `unknown` + type guard | `catch (err: unknown)` |
| `as any` para silenciar errores | `as const` o narrowing correcto | `value as string` solo tras verificación |
| `// @ts-ignore` | `// @ts-expect-error` con justificación | comentar por qué se espera el error |
| Variables `let` no reasignadas | `const` siempre que sea posible | `const where: Prisma.LicitacionWhereInput = {}` |

**Patrón estándar para errores** (el detalle va al log, NUNCA al cliente — §0.3):
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  console.error("[Módulo] Error en operación:", message);
  return NextResponse.json(
    { error: "Descripción legible para el usuario" }, // sin err.message crudo
    { status: 500 }
  );
}
```

### 2.2 Tipado de Prisma — Filtros dinámicos
Los filtros de `where` en rutas API deben tiparse con los tipos de Prisma, no con `any`:

```typescript
// ✅ Correcto
import { Prisma } from "@prisma/client";

const where: Prisma.LicitacionWhereInput = {};
if (estado) where.estado = { key: estado };

// ❌ Incorrecto
const where: any = {}; // NUNCA
```

### 2.3 Convenciones de nombres
| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos de rutas API | `route.ts` | `src/app/api/documents/route.ts` |
| Archivos de página | `page.tsx` | `src/app/licitaciones/page.tsx` |
| Componentes | PascalCase | `LicitacionesTab.tsx` |
| Hooks personalizados | `use` + PascalCase | `useAuth.ts` |
| Utilidades | camelCase | `documentProcessor.ts` |
| Constantes globales | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |
| Modelos Prisma | PascalCase singular | `DocumentoOficial`, `Licitacion` |
| Tablas en BD | lowercase/snake_case | `documento_oficial`, `licitaciones` |

### 2.4 Manejo de errores en APIs
Toda ruta API debe retornar:
- `400` — Input inválido o falta campo requerido
- `401` — No autenticado (`verifyAuth` falló)
- `403` — Autenticado pero sin permisos (reservado para futuro RBAC)
- `404` — Recurso no encontrado
- `413` — Payload too large (archivos)
- `429` — Rate limit (reservado)
- `500` — Error interno del servidor
- `502` — Error de upstream (llamada a modelo IA falló)
- `503` — Servicio no disponible (sin modelo IA activo)

Nunca retornar stack traces ni `err.message` crudo al cliente (§0.3). Solo en logs
del servidor.

### 2.5 Logs y auditoría
- Usar `console.error` para errores, `console.warn` para advertencias, `console.log` solo para trazas de desarrollo.
- Toda operación de mutación (POST, PATCH, DELETE) en APIs críticas debe registrar `auditLog`.
- Formato de log: `[Módulo] Acción: resultado — detalle` (ej: `[Documentos] Upload: encolado — id=abc123`).

### 2.6 Límites de tamaño y validación
| Recurso | Límite | Dónde validar |
|---------|--------|---------------|
| Archivos PDF | 10 MB | `src/app/api/documents/route.ts` |
| Tipos de archivo | `application/pdf` únicamente | Misma ruta |
| Nombre de archivo | Sanitizar con `replace(/[^a-zA-Z0-9.-]/g, "_")` | Misma ruta |
| Query de búsqueda | máx 500 chars | APIs de búsqueda |
| Prompt a IA | máx 16000 chars | `src/app/api/research/analyze/route.ts` |

---

## 3. ARQUITECTURA Y PERSISTENCIA

### 3.1 Patrón Singleton para recursos costosos
PrismaClient y pg-boss deben inicializarse como singletons:

```typescript
// src/lib/prisma.ts — ESTANDAR DEL PROYECTO
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```typescript
// src/lib/queue.ts — Patrón para pg-boss
let bossPromise: Promise<PgBoss> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const { PgBoss } = await import("pg-boss");
      const instance = new PgBoss({ connectionString: process.env.DATABASE_URL });
      await instance.start();
      return instance;
    })();
  }
  return bossPromise;
}
```

### 3.2 Estructura de rutas API
```
src/app/api/
├── auth/login/route.ts          # POST (público)
├── auth/logout/route.ts         # POST (requiere auth)
├── documents/route.ts           # GET, POST, PATCH
├── documents/[id]/route.ts      # GET, DELETE
├── documents/search/route.ts    # GET
├── licitaciones/route.ts        # GET, POST
├── licitaciones/[id]/route.ts   # GET, PATCH, DELETE
├── licitaciones/entidades/route.ts   # GET
├── licitaciones/estados/route.ts     # GET
├── projects/route.ts            # GET, POST
├── research/analyze/route.ts    # POST
├── config/apis/route.ts         # GET, POST
├── config/apis/[id]/...         # PATCH, DELETE, test, toggle
├── config/models/...            # CRUD + discover + test
├── config/audit/route.ts        # GET (paginado)
└── config/module-settings/route.ts   # GET, POST/PUT
```

**Reglas:**
- Cada endpoint HTTP tiene su propio `route.ts`. No agrupar métodos en archivos separados.
- Los parámetros de ruta usan la convención de Next.js: `[id]`, `[id]/test`.
- Las queries de búsqueda se leen con `new URL(req.url).searchParams`.

### 3.3 Paginación estándar
Toda lista que pueda crecer indefinidamente DEBE implementar paginación:

```typescript
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const page = Math.max(1, Number(searchParams.get("page") || "1"));
const pageSize = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
);
const skip = (page - 1) * pageSize;

const [items, total] = await Promise.all([
  prisma.modelo.findMany({ where, orderBy, skip, take: pageSize }),
  prisma.modelo.count({ where }),
]);

return NextResponse.json({
  items,
  pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});
```

Rutas que aún no tienen paginación y deben agregarla:
- `GET /api/documents`
- `GET /api/licitaciones`
- `GET /api/config/audit` (ya tiene, usar como referencia)

### 3.4 Procesamiento asíncrono con pg-boss

> **FE DE ERRATAS (2026-07-22, D-015).** Hasta la versión 2.0.0 esta sección
> describía chunking y embeddings como parte del flujo **existente**. Era falso:
> la verificación del hallazgo **H-05** (spec 001, T018) demostró que no hay una
> sola línea de chunking ni de embeddings en `src/lib/` ni en `scripts/worker.mjs`,
> y que `DocumentoChunk` está migrada pero **vacía**. El texto se corrige a
> continuación separando lo que existe de lo que es diseño previsto.

**Flujo REAL hoy** (patrón canónico vigente):
1. API recibe PDF → extrae texto → guarda en BD con status `queued` → encola job
   `process-document`.
2. Worker (`scripts/worker.mjs`) consume la cola.
3. Worker analiza el documento: si hay modelo IA activo llama al modelo para
   extraer metadatos; si no, aplica extracción por reglas (`analyzeDocument`).
4. Estados posibles: `queued` → `processing` → `completed` | `needs_review` | `error`.

**DISEÑO PREVISTO, aún NO implementado** (spec 003 `pipeline-rag`):
- Troceado del texto en fragmentos y generación de embeddings.
- Poblado de `DocumentoChunk` y búsqueda semántica con pgvector.

Mientras la spec 003 no cierre, ninguna afirmación sobre RAG en este proyecto debe
darse por cierta. Al cerrarla, esta sección se actualiza describiendo el pipeline
real y se registra la enmienda en §10.

No bloquear la respuesta HTTP con operaciones de IA o embeddings.

### 3.5 Base de datos — Convenciones Prisma
- Usar `@map("snake_case")` para nombres de tabla cuando difieran del modelo.
- Usar `@default(cuid())` para IDs de entidades de negocio.
- Usar `@default(autoincrement())` solo para catálogos pequeños (`Estado`, `Entidad`).
- Agregar `@@index` en toda foreign key y campo de búsqueda frecuente.
- El campo `embedding` en `DocumentoChunk` usa `Unsupported("vector(768)")`. No tocar sin migración.

---

## 4. TESTING

### 4.1 Estrategia de testing
| Nivel | Herramienta | Ubicación | Cobertura objetivo |
|-------|-------------|-----------|-------------------|
| Unitario (utils) | Vitest | `src/lib/*.test.ts` | 80% de funciones puras |
| Integración (API) | Vitest + `Request` nativo | `src/app/api/**/route.test.ts` | Todos los endpoints CRUD |
| Componentes | Vitest + jsdom + Testing Library | `src/components/**/*.test.tsx` | Componentes críticos de formulario |

### 4.2 Test de API — Patrón estándar
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";

describe("POST /api/resource", () => {
  beforeAll(async () => { /* seed */ });
  afterAll(async () => { /* cleanup + prisma.$disconnect() */ });

  it("debe retornar 401 sin autenticación", async () => {
    const req = new Request("http://localhost/api/resource", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});
```

### 4.3 Cobertura mínima
- **Meta inmediata:** >20 tests, cubriendo auth, documents, licitaciones.
- **Meta Sprint 4:** >60% cobertura total.
- Todo nuevo endpoint CRUD debe incluir su archivo `.test.ts` antes de mergear.

### 4.4 Tests que deben existir (checklist)
- [x] `src/app/api/auth/login/route.test.ts` — Login con credenciales
- [ ] `src/app/api/documents/route.test.ts` — Upload PDF, GET lista, PATCH
- [ ] `src/app/api/licitaciones/route.test.ts` — CRUD completo
- [ ] `src/app/api/projects/route.test.ts` — CRUD
- [ ] `src/lib/documentProcessor.test.ts` — `extractPdfText`, parsers
- [ ] `src/lib/audit.test.ts` — `auditLog` crea registro
- [ ] `src/lib/modelClients.test.ts` — ya existe, mantener

---

## 5. SEGURIDAD

### 5.1 Autenticación actual
- JWT en cookie `token` (httpOnly en producción, desarrollo según `NODE_ENV`).
- `verifyAuth()` en `src/lib/auth.ts` es la única fuente de veridad.
- Rutas públicas: `POST /api/auth/login`. Todo lo demás requiere sesión.

### 5.2 Validación de inputs
**Meta:** Migrar a Zod. Hasta entonces, validación manual explícita:
- Verificar presencia de campos requeridos antes de tocar Prisma.
- Parsear números con `parseInt` y verificar `!isNaN`.
- Parsear fechas con `new Date()` y verificar `!isNaN(d.getTime())`.
- Sanitizar strings antes de usar en `contains` o `equals`.

### 5.3 Subida de archivos
- Rechazar si `!file.type.includes("pdf")`.
- Rechazar si `file.size > 10 * 1024 * 1024`.
- Guardar con nombre generado (`${Date.now()}_${sanitized}`), nunca con el nombre original directo.
- No exponer rutas absolutas del filesystem al cliente.

### 5.4 Rate limiting (futuro)
Implementar `@upstash/ratelimit` o rate limit en memoria para:
- `POST /api/auth/login` — máx 5 intentos / minuto / IP
- `POST /api/research/analyze` — máx 20 requests / minuto / usuario
- `POST /api/documents` — máx 10 uploads / hora / usuario

---

## 6. COMPONENTES Y UI

### 6.1 Estructura de componentes
```
src/components/
├── modules/               # Tabs de dashboard
│   ├── BaseTab.tsx
│   ├── LicitacionesTab.tsx
│   ├── InvestigacionTab.tsx
│   ├── ProyectosTab.tsx
│   └── ConfiguracionTab.tsx
├── licitaciones/          # Componentes específicos del módulo
│   ├── LicitacionCard.tsx
│   ├── LicitacionForm.tsx
│   └── LicitacionModal.tsx
├── configuracion/
│   └── ParametrizacionTab.tsx
├── ProjectForm.tsx
├── RootLayoutContent.tsx
```

### 6.2 Reglas de React
- No usar `Math.random()` en render. Usar `useId()` o `crypto.randomUUID()` en event handlers.
- No usar `setState` sincrónico dentro de `useEffect`. Usar `useMemo` o inicializar el estado directamente.
- Hooks personalizados deben empezar con `use`.
- Componentes server-side (páginas en `app/`) pueden hacer `fetch` a APIs locales; componentes cliente (`"use client"`) usan `useEffect` para data fetching.

### 6.3 Estilos
- Tailwind CSS 3.4 es la única fuente de estilos. No agregar CSS modules ni styled-components sin justificación.
- Colores y tema manejados por `ThemeContext.tsx`.
- Responsive por defecto; todo layout debe funcionar en `md` (768px) y superior.

---

## 7. PROCESO DE DESARROLLO

### 7.1 Antes de escribir código
1. `git pull origin main --no-rebase --no-edit`
2. `npm run lint` — conocer estado base
3. `npm run test` — conocer estado base
4. Leer los archivos que se van a modificar
5. Verificar que el cambio no afecte el módulo Financials

### 7.2 Durante el desarrollo
1. Un cambio lógico = un commit.
2. Mensaje de commit en español, imperativo: `"Agrega paginación a GET /api/licitaciones"`.
3. No dejar `console.log` de debug; usar `console.error` o `console.warn` si es informativo permanente.
4. No introducir nuevos `any`. Si es inevitable, agregar `// TODO(any): justificar por qué`.

### 7.3 Antes de commit
1. `npm run lint` — 0 errores
2. `npm run test` — todos pasan
3. `npm run build` — compila exitosamente
4. Verificar que no se crearon archivos en `src/app/financials/`

### 7.4 Post-merge
Después de mergear a `main`, el agente debe:
1. Ejecutar `npx prisma migrate deploy` si hay nuevas migraciones.
2. Ejecutar `npm run build` para verificar build de producción.
3. Reiniciar worker si afecta colas: `pm2 restart worker` (o `npm run worker` en dev).

---

## 8. MÉTRICAS Y DEUDA TÉCNICA

### 8.1 Estado base (2026-07-11)
| Métrica | Valor actual | Objetivo |
|---------|-------------|----------|
| Errores ESLint | 90 errores + 22 warnings (112 total) | 0 |
| Uso de `any` | presente en `documentProcessor.ts`, `route.ts` | 0 |
| Tests que pasan | 2 (login falla si no hay DB, modelClients pasa) | >20 |
| Cobertura | ~5% | >60% |
| `require()` en ESM | 1 (`pdf2json` en `documentProcessor.ts`) | 0 |
| Código muerto | Sí (componentes licitaciones sin usar; `sanitizeJsonText` no usada) | 0 |

### 8.2 Checklist de saneamiento (extraído de PLAN-DEUDA-TECNICA-001.md)
- [ ] Eliminar todos los `any` en `src/`
- [ ] Corregir `prefer-const` y variables no usadas
- [ ] Tipar filtros `where` con tipos de Prisma
- [ ] Agregar paginación a `GET /api/documents` y `GET /api/licitaciones`
- [ ] Implementar Zod para validación de inputs
- [ ] Aumentar tests a >20 archivos
- [ ] Eliminar código muerto (`LicitacionCard`, `LicitacionForm`, `LicitacionModal` si no se usan)
- [ ] Documentar API con OpenAPI (opcional post-Sprint 4)

---

## 9. GLOSARIO

| Término | Significado en este proyecto |
|---------|------------------------------|
| **Base Oficial** | Módulo de gestión documental de normativa (constitución, leyes, decretos, resoluciones) |
| **RAG** | Retrieval-Augmented Generation: búsqueda semántica en chunks de documentos + generación con IA |
| **Chunk** | Fragmento de texto de un documento, con embedding vectorial para búsqueda |
| **Worker** | Proceso Node.js independiente (`scripts/worker.mjs`) que consume jobs de `pg-boss` |
| **Audit Log** | Registro inmutable de acciones sobre entidades, con trazabilidad de usuario y modelo IA |
| **Embedding** | Vector numérico (768 dims) que representa semánticamente un texto |
| **Cuid()** | Identificador único generado por Prisma; usado para IDs de entidades de negocio |

---

## 10. HISTORIAL DE CAMBIOS

**Gobernanza de enmiendas:** toda enmienda a esta constitución requiere aprobación
de ZEUS y Jelkin, bump de versión semántico (MAJOR: redefinición/eliminación de
principios; MINOR: principios o secciones nuevas; PATCH: aclaraciones) y registro
en esta tabla. El cumplimiento se revisa en cada spec (`Constitution Check` del plan).

| Versión | Fecha | Autor | Cambio |
|---------|-------|-------|--------|
| 1.0.0 | 2026-07-11 | Speckit | Creación inicial tras inspección de código real del proyecto |
| 2.0.0 | 2026-07-22 | ODIN (aprob. pendiente ZEUS/Jelkin) | Principios rectores de gobernanza IDC (§0); contrato de errores sin `err.message` al cliente (§2.1, §2.4); gobernanza de enmiendas |
| 2.1.0 | 2026-07-22 | ODIN (decisiones D-019…D-023 de ZEUS) | Fe de erratas §3.4 (RAG es diseño previsto, no código); §0.7 configurabilidad y precedencia (ADR_004); §0.8 agentes persona+corpus+modelo compartido (ADR_003); retiro de Financials registrado en §1.2 |

---

> **Nota final:** Este documento es la constitución del proyecto. Cualquier agente que trabaje en 001-2026-INNOVADATACO debe leerlo, entenderlo y adherirse a sus principios. Si una tarea contradice este documento, se debe consultar antes de proceder.