# SPECKIT CONSTITUTION — 002-2026-PROTECCION-INFANTIL

> **Versión:** 1.1.0  
> **Fecha:** 2026-07-11  
> **Stack:** Next.js 16.2.10 + React 19.2.4 + Prisma 5.22.0 + PostgreSQL 16+ + TypeScript 5.x  
> **Runtime:** Node.js >=22  
> **Módulos planificados:** Reportes, Consulta Pública, Clasificación IA, Disputas, Configuración  
> **Arquitectura API:** Next.js App Router API Routes (no PostgREST, no tRPC, no GraphQL)

---

## 1. PRINCIPIOS DEL PRODUCTO

### 1.1 Propósito y alcance
Esta plataforma tiene como finalidad la **prevención de riesgos contra menores de edad** mediante la recolección comunitaria de reportes sobre números telefónicos, nicks de usuario y perfiles en redes sociales, videojuegos y aplicaciones de mensajería.

**Límite fundamental:** La plataforma **NO es un sustituto de la denuncia formal ante autoridades**. Toda interfaz de reporte debe contener, de forma visible e ineludible, referencia a los canales oficiales:
- Línea 141 del ICBF
- CAI Virtual de la Policía Nacional
- Te Protejo (Ministerio de TIC / Fiscalía)

### 1.2 Solo texto — prohibición absoluta de multimedia
Queda **estrictamente prohibido** subir, almacenar, procesar o transmitir fotografías, videos, audio o cualquier otro formato multimedia. No existen excepciones. Los reportes se componen exclusivamente de:
- Texto descriptivo de la conducta observada
- Identificador reportado (número telefónico, nick, nombre de usuario)
- Metadatos contextuales (ciudad, país, fecha, plataforma)

### 1.3 Presunción de inocencia en el lenguaje
Las consultas públicas nunca afirman culpabilidad ni emiten juicios de valor sobre personas. El lenguaje permitido es descriptivo y estadístico:

| Prohibido | Obligatorio |
|-----------|-------------|
| "Número peligroso" | "N reportes registrados" |
| "Abusador confirmado" | "Distribución por ciudad/país/fecha" |
| "Evitar contacto" (como veredicto) | "Reportado en X plataformas entre fecha A y fecha B" |
| Etiquetas de riesgo | Gráficas de frecuencia temporal y geográfica |

### 1.4 Umbral de publicación parametrizable
El umbral configurable de reportes rige la aparición de un identificador en el **LISTADO del dashboard público**. La **CONSULTA DIRECTA** de un identificador muestra siempre los reportes aprobados que existan, con una señal descriptiva de actividad (baja/alta) según el volumen. El umbral y el ratio de autenticados se conservan como medida anti-abuso configurable por **ADMIN**.

### 1.5 Clasificación de conductas, no scoring de personas
La inteligencia artificial clasifica **las conductas descritas en el texto del reporte**, nunca genera un "score de peligrosidad" sobre individuos.

Categorías de conducta (ejemplos):
- Contacto insistente o acoso repetido
- Solicitud de material íntimo o sexual
- Ofrecimiento de regalos, dinero o beneficios
- Suplantación de identidad (fingir ser menor, familiar, figura de autoridad)
- Solicitud de encuentro físico
- Compartimiento de contenido sexual

**Procesamiento de IA:** Los textos sensibles se procesan exclusivamente mediante LLM local (Ollama). Los textos de reporte **nunca salen del servidor** hacia APIs de terceros.

### 1.6 Mecanismo de disputa (Ley 1581 de 2012)
El titular de un número telefónico o cuenta reportada tiene derecho a solicitar revisión de su inclusión en la base de datos, en cumplimiento de la Ley 1581 de Protección de Datos Personales de Colombia.

El flujo de disputa incluye:
1. Formulario de solicitud con verificación de titularidad
2. Revisión manual por un administrador del colegio o de la plataforma
3. Resolución documentada: mantener, anonimizar o eliminar el registro
4. Notificación al solicitante con fundamento de la decisión

---

## 2. PRINCIPIOS TÉCNICOS

### 2.1 Stack heredado del proyecto 001 (probado en producción)
| Capa | Tecnología | Política |
|------|-----------|----------|
| Framework | Next.js App Router | API Routes exclusivos; no PostgREST, no GraphQL, no tRPC |
| ORM | Prisma 5.22.0 | PostgreSQL obligatorio; raw SQL solo en migraciones manuales |
| Autenticación | JWT manual (`jose` + `bcryptjs`) | Cookie `httpOnly`; sin NextAuth.js/Auth.js |
| Colas asíncronas | `pg-boss` | Procesamiento de clasificación IA; no Bull ni RabbitMQ |
| IA local | Ollama | Modelos locales únicamente; textos sensibles no salen del servidor |
| Testing | Vitest + jsdom + `@testing-library/react` | No Jest |
| Estilo | ESLint con `eslint-config-next` | Sin Prettier configurado |

### 2.2 Roles de usuario
| Rol | Alcance | Permisos |
|-----|---------|----------|
| **ADMIN** | Plataforma completa | Superadmin: gestiona colegios, parámetros globales, modelos IA, audit logs |
| **SCHOOL_ADMIN** | Su colegio únicamente | Crea perfiles de estudiantes con permisos granulares; administra reportes de su institución |
| **PARENT** | Su cuenta y sus consultas | Crea reportes, consulta números/nicks, solicita disputas |
| **Anónimo** | Sin cuenta | Puede crear reportes y consultar números/nicks sin autenticación |

### 2.3 Arquitectura multi-tenant
Cada colegio es un **tenant aislado**:
- Los perfiles, reportes y validaciones de un colegio no son visibles para otros colegios
- El modelo de datos incluye `tenantId` en todas las entidades de negocio
- La consulta pública (anónima) agrega datos de todos los tenants sin identificar la fuente

### 2.4 Modelo SaaS
El diseño de datos debe contemplar desde el inicio:
- Planes de suscripción (aunque el pago se implemente en fase posterior)
- Límites de reportes por colegio/periodo
- Feature flags por plan
- Tablas base: `Plan`, `Subscription`, `Tenant` (colegio), `BillingCycle` (vacías inicialmente)

---

## 3. CALIDAD DE CÓDIGO

### 3.1 TypeScript — Reglas no negociables
El `tsconfig.json` tiene `"strict": true`. Esto significa:

| Prohibido | Obligatorio | Ejemplo |
|-----------|-------------|---------|
| `any` como tipo de anotación | `unknown` + type guard | `catch (err: unknown)` |
| `as any` para silenciar errores | `as const` o narrowing correcto | `value as string` solo tras verificación |
| `// @ts-ignore` | `// @ts-expect-error` con justificación | comentar por qué se espera el error |
| Variables `let` no reasignadas | `const` siempre que sea posible | `const where: Prisma.ReporteWhereInput = {}` |

**Patrón estándar para errores:**
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  console.error("[Módulo] Error en operación:", message);
  return NextResponse.json(
    { error: "Descripción legible para el usuario", details: message },
    { status: 500 }
  );
}
```

### 3.2 Tipado de Prisma — Filtros dinámicos
Los filtros de `where` en rutas API deben tiparse con los tipos de Prisma, no con `any`:

```typescript
// ✅ Correcto
import { Prisma } from "@prisma/client";

const where: Prisma.ReporteWhereInput = {};
if (plataforma) where.plataforma = { key: plataforma };

// ❌ Incorrecto
const where: any = {}; // NUNCA
```

### 3.3 Convenciones de nombres
| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos de rutas API | `route.ts` | `src/app/api/reportes/route.ts` |
| Archivos de página | `page.tsx` | `src/app/consulta/page.tsx` |
| Componentes | PascalCase | `ReporteForm.tsx` |
| Hooks personalizados | `use` + PascalCase | `useAuth.ts` |
| Utilidades | camelCase | `reporteValidator.ts` |
| Constantes globales | SCREAMING_SNAKE_CASE | `MAX_REPORTES_PAGINA` |
| Modelos Prisma | PascalCase singular | `Reporte`, `Colegio`, `Disputa` |
| Tablas en BD | lowercase/snake_case | `reportes`, `colegios`, `disputas` |

### 3.4 Manejo de errores en APIs
Toda ruta API debe retornar:
- `400` — Input inválido o falta campo requerido
- `401` — No autenticado (`verifyAuth` falló)
- `403` — Autenticado pero sin permisos (rol insuficiente)
- `404` — Recurso no encontrado
- `409` — Conflicto (disputa ya existe para este reporte)
- `413` — Payload too large
- `429` — Rate limit
- `500` — Error interno del servidor
- `502` — Error de upstream (llamada a modelo IA falló)
- `503` — Servicio no disponible (sin modelo IA activo)

Nunca retornar stack traces al cliente. Solo en logs del servidor.

### 3.5 Logs y auditoría
- Usar `console.error` para errores, `console.warn` para advertencias, `console.log` solo para trazas de desarrollo.
- Toda operación de mutación (POST, PATCH, DELETE) en APIs críticas debe registrar `auditLog`.
- Formato de log: `[Módulo] Acción: resultado — detalle` (ej: `[Reportes] Creación: exitosa — id=abc123, tenant=xyz789`).

### 3.6 Límites de tamaño y validación
| Recurso | Límite | Dónde validar |
|---------|--------|---------------|
| Texto del reporte | máx 2000 caracteres | `src/app/api/reportes/route.ts` |
| Número telefónico | Validar formato E.164 | Misma ruta |
| Nick / nombre de usuario | máx 100 chars, sanitizar | Misma ruta |
| Consulta pública | máx 50 chars (número/nick) | `src/app/api/consulta/route.ts` |
| Prompt a IA (clasificación) | máx 4000 chars | Worker de pg-boss |

---

## 4. ARQUITECTURA Y PERSISTENCIA

### 4.1 Patrón Singleton para recursos costosos
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

### 4.2 Estructura de rutas API (preliminar)
```
src/app/api/
├── auth/login/route.ts              # POST (público)
├── auth/logout/route.ts             # POST (requiere auth)
├── auth/register/route.ts           # POST (SCHOOL_ADMIN crea PARENT)
├── reportes/route.ts                # GET, POST (anónimo permitido para POST)
├── reportes/[id]/route.ts           # GET (admin), PATCH (admin)
├── consulta/route.ts                # GET (público: busca número/nick)
├── disputas/route.ts                # POST (público: solicitar revisión)
├── disputas/[id]/route.ts           # GET, PATCH (ADMIN / SCHOOL_ADMIN)
├── clasificacion/trabajo/route.ts   # POST (worker interno, no expuesto)
├── config/parametros/route.ts       # GET, PATCH (ADMIN: umbral, etc.)
├── config/audit/route.ts            # GET (ADMIN, paginado)
└── config/models/route.ts           # GET, POST, PATCH, DELETE (ADMIN: modelos Ollama)
```

**Reglas:**
- Cada endpoint HTTP tiene su propio `route.ts`. No agrupar métodos en archivos separados.
- Los parámetros de ruta usan la convención de Next.js: `[id]`.
- Las queries de búsqueda se leen con `new URL(req.url).searchParams`.

### 4.3 Paginación estándar
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

### 4.4 Procesamiento asíncrono con pg-boss
El flujo de clasificación de reportes es el patrón canónico:
1. API recibe reporte → guarda en BD con status `queued` → encola job `clasificar-reporte`.
2. Worker (`scripts/worker.mjs`) consume la cola.
3. Worker envía texto al LLM local (Ollama) para clasificación de conducta.
4. Actualiza el reporte con la categoría detectada y confianza.
5. Estados posibles: `queued` → `processing` → `classified` | `needs_review` | `error`.

No bloquear la respuesta HTTP con operaciones de IA.

### 4.5 Base de datos — Convenciones Prisma
- Usar `@map("snake_case")` para nombres de tabla cuando difieran del modelo.
- Usar `@default(cuid())` para IDs de entidades de negocio.
- Usar `@default(autoincrement())` solo para catálogos pequeños (`CategoriaConducta`, `EstadoDisputa`).
- Agregar `@@index` en toda foreign key y campo de búsqueda frecuente.
- El campo `tenantId` debe existir en todas las entidades de negocio excepto catálogos globales.

---

## 5. TESTING

### 5.1 Estrategia de testing
| Nivel | Herramienta | Ubicación | Cobertura objetivo |
|-------|-------------|-----------|-------------------|
| Unitario (utils) | Vitest | `src/lib/*.test.ts` | 80% de funciones puras |
| Integración (API) | Vitest + `Request` nativo | `src/app/api/**/route.test.ts` | Todos los endpoints CRUD |
| Componentes | Vitest + jsdom + Testing Library | `src/components/**/*.test.tsx` | Componentes críticos de formulario |

### 5.2 Test de API — Patrón estándar
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";

describe("POST /api/reportes", () => {
  beforeAll(async () => { /* seed: crear tenant, categorías */ });
  afterAll(async () => { /* cleanup + prisma.$disconnect() */ });

  it("debe permitir reporte anónimo sin autenticación", async () => {
    const req = new Request("http://localhost/api/reportes", {
      method: "POST",
      body: JSON.stringify({ telefono: "+573001234567", texto: "Contacto insistente", plataforma: "WhatsApp" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});
```

### 5.3 Cobertura mínima
- **Meta inmediata:** >15 tests, cubriendo auth, reportes anónimos, consulta pública.
- **Meta Sprint 3:** >50% cobertura total.
- Todo nuevo endpoint CRUD debe incluir su archivo `.test.ts` antes de mergear.

---

## 6. SEGURIDAD

### 6.1 Autenticación
- JWT en cookie `token` (httpOnly en producción, desarrollo según `NODE_ENV`).
- `verifyAuth()` en `src/lib/auth.ts` es la única fuente de verdad.
- Rutas públicas: `POST /api/auth/login`, `POST /api/reportes` (anónimo), `GET /api/consulta`. Todo lo demás requiere sesión.

### 6.2 Validación de inputs
**Meta:** Migrar a Zod. Hasta entonces, validación manual explícita:
- Verificar presencia de campos requeridos antes de tocar Prisma.
- Parsear números con `parseInt` y verificar `!isNaN`.
- Sanitizar strings antes de usar en `contains` o `equals`.
- Validar formato E.164 para números telefónicos.
- Rechazar cualquier input que contenga URLs de imágenes, base64 de archivos o referencias a multimedia.

### 6.3 Protección de datos sensibles
- Los textos de reporte se almacenan encriptados en reposo (campo cifrado con AES-256-GCM).
- La clave de encriptación vive en variable de entorno, nunca en código.
- Los logs de auditoría nunca incluyen el texto completo del reporte, solo metadatos (id, timestamp, categoría).
- Las disputas exitosas resultan en eliminación o anonimización del registro; no se conserva texto identificable.

### 6.4 Rate limiting (futuro)
Implementar `@upstash/ratelimit` o rate limit en memoria para:
- `POST /api/reportes` — máx 5 reportes / hora / IP (anónimo)
- `POST /api/auth/login` — máx 5 intentos / minuto / IP
- `GET /api/consulta` — máx 30 consultas / minuto / IP
- `POST /api/disputas` — máx 3 solicitudes / día / número

---

## 7. COMPONENTES Y UI

### 7.1 Estructura de componentes (preliminar)
```
src/components/
├── modules/               # Tabs de dashboard
│   ├── BaseTab.tsx
│   ├── ReportesTab.tsx
│   ├── ConsultaTab.tsx
│   ├── DisputasTab.tsx
│   └── ConfiguracionTab.tsx
├── reportes/              # Componentes específicos del módulo
│   ├── ReporteForm.tsx
│   ├── ReporteAnonimoForm.tsx
│   └── ReporteList.tsx
├── consulta/
│   ├── ConsultaForm.tsx
│   └── ConsultaResultado.tsx
├── disputas/
│   └── DisputaForm.tsx
├── RootLayoutContent.tsx
```

### 7.2 Reglas de React
- No usar `Math.random()` en render. Usar `useId()` o `crypto.randomUUID()` en event handlers.
- No usar `setState` sincrónico dentro de `useEffect`. Usar `useMemo` o inicializar el estado directamente.
- Hooks personalizados deben empezar con `use`.
- Componentes server-side (páginas en `app/`) pueden hacer `fetch` a APIs locales; componentes cliente (`"use client"`) usan `useEffect` para data fetching.

### 7.3 Estilos
- Tailwind CSS 3.4 es la única fuente de estilos. No agregar CSS modules ni styled-components sin justificación.
- Colores y tema manejados por `ThemeContext.tsx`.
- Responsive por defecto; todo layout debe funcionar en `md` (768px) y superior.
- Las pantallas de reporte deben mostrar los canales oficiales de denuncia de forma prominente y no descartable.

---

## 8. PROCESO DE DESARROLLO

### 8.1 Antes de escribir código
1. `git pull origin main --no-rebase --no-edit`
2. `npm run lint` — conocer estado base
3. `npm run test` — conocer estado base
4. Leer los archivos que se van a modificar
5. Verificar que el cambio no contradice los principios del producto (especialmente 1.2 y 1.3)

### 8.2 Durante el desarrollo
1. Un cambio lógico = un commit.
2. Mensaje de commit en español, imperativo: `"Agrega endpoint POST /api/reportes"`.
3. No dejar `console.log` de debug; usar `console.error` o `console.warn` si es informativo permanente.
4. No introducir nuevos `any`. Si es inevitable, agregar `// TODO(any): justificar por qué`.

### 8.3 Antes de commit
1. `npm run lint` — 0 errores
2. `npm run test` — todos pasan
3. `npm run build` — compila exitosamente
4. Verificar que no se introdujeron campos de multimedia ni capacidades de carga de archivos

### 8.4 Post-merge
Después de mergear a `main`, el agente debe:
1. Ejecutar `npx prisma migrate deploy` si hay nuevas migraciones.
2. Ejecutar `npm run build` para verificar build de producción.
3. Reiniciar worker si afecta colas: `pm2 restart worker` (o `npm run worker` en dev).

---

## 9. GLOSARIO

| Término | Significado en este proyecto |
|---------|------------------------------|
| **Reporte** | Registro de un usuario (anónimo o autenticado) sobre un número/nick y la conducta observada |
| **Consulta pública** | Búsqueda de un número/nick sin autenticación; retorna estadísticas agregadas si supera el umbral |
| **Clasificación IA** | Proceso automático que categoriza la conducta descrita en un reporte usando LLM local |
| **Umbral** | Número mínimo de reportes independientes para que un identificador aparezca en consultas públicas |
| **Disputa** | Solicitud formal de un titular para revisar la inclusión de su número/nick en la base de datos |
| **Tenant** | Colegio aislado multi-tenant; cada institución es un tenant con datos independientes |
| **Worker** | Proceso Node.js independiente (`scripts/worker.mjs`) que consume jobs de `pg-boss` |
| **Audit Log** | Registro inmutable de acciones sobre entidades, con trazabilidad de usuario |
| **Categoría de conducta** | Clasificación asignada por IA al texto del reporte (ej: contacto insistente, solicitud de material) |

---

## 10. HISTORIAL DE CAMBIOS

| Versión | Fecha | Autor | Cambio |
|---------|-------|-------|--------|
| 1.0.0 | 2026-07-11 | Speckit | Creación inicial con principios del producto y técnicos heredados del proyecto 001 |
| 1.1.0 | 2026-07-24 | ZEUS (addendum spec 089) | §1.4: el umbral rige el LISTADO del dashboard; la consulta directa siempre muestra los reportes aprobados + señal descriptiva de actividad |

---

> **Nota final:** Este documento es la constitución del proyecto 002-2026-PROTECCION-INFANTIL. Cualquier agente que trabaje en este proyecto debe leerlo, entenderlo y adherirse a sus principios. Los principios del producto (sección 1) tienen prioridad absoluta sobre consideraciones técnicas de conveniencia. Si una tarea contradice este documento, se debe consultar antes de proceder.