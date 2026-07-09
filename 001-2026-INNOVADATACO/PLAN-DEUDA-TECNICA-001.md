# PLAN DE RESOLUCIÓN DE DEUDA TÉCNICA
## Proyecto 001-2026-INNOVADATACO

| Campo | Detalle |
|-------|---------|
| **ID Plan** | DT-001 |
| **Fecha** | 2026-07-09 |
| **Basado en** | REVISION-PROYECTO-001-2026.md |
| **Estimación total** | 4 semanas (1 desarrollador full-time) |
| **Sprints** | 4 sprints de 1 semana |

---

## Metodología

Cada sprint tiene:
- **Objetivo claro**: Qué se entrega al final
- **Tareas**: Acciones específicas con archivos afectados
- **Criterios de aceptación**: Cómo saber que está listo
- **Dependencias**: Qué debe hacerse antes

---

## SPRINT 1 — Fundamentos y Calidad de Código
**Semana 1 | Objetivo: Código sin errores de lint y tipado seguro**

### 1.1 Configurar herramientas de calidad (Día 1)

| Tarea | Archivos | Criterio de aceptación |
|-------|----------|----------------------|
| Activar reglas estrictas de TypeScript | `tsconfig.json` | `"strict": true`, `"noImplicitAny": true` |
| Configurar ESLint para bloquear builds | `eslint.config.mjs` | `npm run lint` falla el build si hay errores |
| Agregar hook pre-commit | `package.json` | Husky + lint-staged ejecuta lint antes de cada commit |

**Comandos:**
```bash
npm install -D husky lint-staged
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

### 1.2 Eliminar todos los `any` (Día 2-3)

| Archivo | Líneas | Solución |
|---------|--------|----------|
| `src/app/api/documents/route.ts` | 45, 80, 102, 134, 165 | Tipar errores con `Error`, metadata con `unknown` + type guard |
| `src/app/api/licitaciones/route.ts` | 12, 49, 99 | Tipar errores con `Error`, body con `z.infer<typeof schema>` |
| `src/app/api/licitaciones/[id]/route.ts` | 36, 65, 87, 120 | Mismo patrón |
| `src/app/api/licitaciones/entidades/route.ts` | 12, 42 | Tipar errores |
| `src/app/api/licitaciones/estados/route.ts` | 12, 42 | Tipar errores |
| `src/app/api/config/apis/route.ts` | 10 | Tipar error |
| `src/app/api/config/apis/[id]/test/route.ts` | 34, 103, 117 | Tipar errores y respuestas de fetch |
| `src/app/api/config/apis/[id]/toggle/route.ts` | 16 | Tipar error |
| `src/app/api/config/models/route.ts` | 51 | Tipar error |
| `src/app/api/config/models/[id]/route.ts` | 42, 55 | Tipar error |
| `src/app/api/config/models/discover/route.ts` | 13, 21 | Tipar respuesta Ollama |
| `src/app/api/config/models/test/route.ts` | 28 | Tipar error |
| `src/app/api/research/analyze/route.ts` | 33, 36, 47 | Tipar error y body |
| `src/app/api/documents/search/route.ts` | 13 | Tipar error |
| `src/app/configuracion/page.tsx` | 133 | Tipar error |

**Tipado estándar para errores:**
```typescript
// Antes
} catch (err: any) {
  console.error(err?.message);
}

// Después
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  console.error(message);
}
```

### 1.3 Corregir prefer-const y unused vars (Día 3)

| Archivo | Problema | Solución |
|---------|----------|----------|
| `src/app/api/documents/route.ts:82` | `let aiModelId` → nunca reasignada | Cambiar a `const` |
| `src/app/api/config/apis/[id]/test/route.ts:35` | `let headers` → nunca reasignada | Cambiar a `const` |
| `src/app/api/licitaciones/entidades/route.ts:5` | `req` no usado en GET | Prefijar con underscore `_req` |
| `src/app/api/licitaciones/estados/route.ts:5` | `req` no usado en GET | Prefijar con underscore `_req` |

### 1.4 Corregir violaciones de reglas React (Día 4)

**Archivo: `src/app/configuracion/page.tsx`**

| Problema | Línea | Solución |
|----------|-------|----------|
| `Math.random()` en render | 139 | Usar `useId()` de React o `crypto.randomUUID()` en event handler |
| `setState` sincrónico en `useEffect` | 160 | Usar `useMemo` o inicializar estado directamente |

**Solución para IDs de toast:**
```typescript
// Antes (en render)
const id = Math.random().toString(36).slice(2);

// Después (en event handler o con useId)
import { useId } from "react";
const toastIdBase = useId();
const toast = (type: Toast["type"], message: string) => {
  const id = `${toastIdBase}-${Date.now()}`;
  // ...
};
```

### 1.5 Verificación del sprint (Día 5)

```bash
npm run lint        # Debe pasar sin errores
npm run test        # Los 2 tests existentes deben seguir pasando
npm run build       # Debe compilar sin errores
```

**Checklist de cierre Sprint 1:**
- [ ] `npm run lint` pasa con 0 errores
- [ ] No hay ningún `any` en `src/`
- [ ] No hay variables no usadas
- [ ] No hay `prefer-const` warnings
- [ ] `npm run build` compila exitosamente

---

## SPRINT 2 — Seguridad y Validación
**Semana 2 | Objetivo: APIs protegidas y datos validados**

### 2.1 Implementar autenticación con NextAuth.js (Día 1-3)

| Tarea | Archivos nuevos | Archivos a modificar |
|-------|-----------------|---------------------|
| Instalar NextAuth.js v5 | — | `package.json` |
| Configurar provider Credentials | `src/auth.ts` | — |
| Crear middleware de protección | `src/middleware.ts` | — |
| Proteger todas las rutas API | — | Todas las `/api/*` |
| Agregar sesión a contexto | — | `src/context/WorkspaceContext.tsx` |

**Instalación:**
```bash
npm install next-auth@beta
```

**Estructura mínima:**
```typescript
// src/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        // Validar contra tabla User en Prisma
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        // TODO: Agregar bcrypt para comparar passwords
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
```

```typescript
// src/middleware.ts
export { auth as middleware } from "@/auth";
export const config = {
  matcher: ["/api/:path*", "/configuracion", "/licitaciones", "/research"],
};
```

### 2.2 Validar inputs con Zod (Día 3-4)

| Ruta | Schema a crear |
|------|---------------|
| `/api/documents` (POST) | `DocumentUploadSchema` |
| `/api/licitaciones` (POST/PATCH) | `LicitacionSchema` |
| `/api/config/models` (POST/PUT) | `AiModelSchema` |
| `/api/research/analyze` (POST) | `ResearchAnalyzeSchema` |

**Ejemplo:**
```typescript
import { z } from "zod";

const LicitacionSchema = z.object({
  numero: z.string().min(1).max(50),
  titulo: z.string().min(1).max(500),
  descripcion: z.string().max(5000).optional(),
  estadoId: z.coerce.number().int().positive(),
  entidadId: z.coerce.number().int().positive().optional(),
  fechaApertura: z.coerce.date(),
});
```

**Instalación:**
```bash
npm install zod
```

### 2.3 Seguridad en subida de archivos (Día 4)

**Modificar: `src/app/api/documents/route.ts`**

| Validación | Implementación |
|------------|---------------|
| Tipo MIME | `file.type === "application/pdf"` |
| Tamaño máximo | `file.size <= 10 * 1024 * 1024` (10MB) |
| Nombre sanitizado | `file.name.replace(/[^a-zA-Z0-9.-]/g, "_")` |
| Extensión | `.toLowerCase().endsWith(".pdf")` |

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf"];

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json({ error: "Solo se permiten PDFs" }, { status: 400 });
}
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: "Máximo 10MB" }, { status: 413 });
}
```

### 2.4 Verificación del sprint (Día 5)

- [ ] No se puede acceder a `/api/*` sin sesión (retorna 401)
- [ ] Inputs inválidos retornan 400 con mensaje claro
- [ ] Subida de archivos no-PDF es rechazada
- [ ] Archivos >10MB son rechazados
- [ ] Nombres de archivo con `../` son sanitizados

---

## SPRINT 3 — Funcionalidad y Conectividad
**Semana 3 | Objetivo: Eliminar mocks, conectar APIs huérfanas**

### 3.1 Conectar ResearchPage con IA real (Día 1-2)

**Archivos:**
- `src/app/research/page.tsx`
- `src/app/api/research/analyze/route.ts`

**Implementación:**

```typescript
// src/app/api/research/analyze/route.ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { prompt, documentId } = await req.json();
  const activeModel = await prisma.aiModel.findFirst({ where: { active: true } });
  if (!activeModel) return NextResponse.json({ error: "Sin modelo activo" }, { status: 503 });

  const documento = documentId 
    ? await prisma.documentoOficial.findUnique({ where: { id: documentId } })
    : null;

  const fullPrompt = documento 
    ? `Analiza el siguiente documento:\n\n${documento.contenidoTexto?.slice(0, 8000)}\n\nPregunta: ${prompt}`
    : prompt;

  const result = await callModel(activeModel, fullPrompt);
  
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Parsear respuesta JSON o devolver texto libre
  return NextResponse.json({
    summary: result.text,
    model: activeModel.name,
    latencyMs: result.latencyMs,
  });
}
```

### 3.2 Implementar APIs para Proyectos (Día 2-3)

**Nuevas rutas:**
- `src/app/api/proyectos/route.ts` (GET, POST)
- `src/app/api/proyectos/[id]/route.ts` (GET, PATCH, DELETE)
- `src/app/api/financials/route.ts` (GET, POST)

**Schema Prisma a ajustar:**
Verificar que `Proyecto` y `Pm2Financial` estén en el schema o crear migración.

```typescript
// src/app/api/proyectos/route.ts
export async function GET() {
  const proyectos = await prisma.proyecto.findMany({
    include: { financials: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(proyectos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const proyecto = await prisma.proyecto.create({ data: body });
  return NextResponse.json(proyecto, { status: 201 });
}
```

### 3.3 Implementar APIs para Financials (Día 3)

```typescript
// src/app/api/financials/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const proyectoId = searchParams.get("proyectoId");
  const where = proyectoId ? { proyectoId } : {};
  const financials = await prisma.pm2Financial.findMany({ where });
  return NextResponse.json(financials);
}
```

### 3.4 Actualizar ProjectForm (Día 3-4)

**Archivo: `src/components/ProjectForm.tsx`**

Cambiar URLs de Supabase a APIs locales:
```typescript
// Antes
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proyectos`, {...});

// Después
const res = await fetch("/api/proyectos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({...}),
});
```

### 3.5 Implementar búsqueda RAG real (Día 4)

**Archivo: `src/app/api/documents/search/route.ts`**

```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  
  if (!q) return NextResponse.json({ error: "Query requerida" }, { status: 400 });

  // Búsqueda simple por contenido (mejorable con vector search)
  const results = await prisma.documentoOficial.findMany({
    where: {
      OR: [
        { contenidoTexto: { contains: q, mode: "insensitive" } },
        { titulo: { contains: q, mode: "insensitive" } },
        { resumen: { contains: q, mode: "insensitive" } },
      ],
      activo: true,
    },
    take: 20,
    orderBy: { jerarquiaNivel: "asc" },
  });

  return NextResponse.json(results);
}
```

### 3.6 Verificación del sprint (Día 5)

- [ ] ResearchPage conecta con modelo IA activo
- [ ] ProjectForm crea proyectos en BD local
- [ ] Financials muestra datos de BD local
- [ ] Búsqueda de documentos retorna resultados reales
- [ ] No quedan mocks en producción (excepto provider `mock` para testing)

---

## SPRINT 4 — Optimización y Testing
**Semana 4 | Objetivo: Rendimiento, tests y documentación**

### 4.1 Agregar timeouts y retries (Día 1)

**Archivo: `src/lib/modelClients.ts`**

```typescript
async function ollamaCall(model: AiModelInput, prompt: string): Promise<ModelResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...}),
      signal: controller.signal,
    });
    // ...
  } finally {
    clearTimeout(timeout);
  }
}
```

**Archivo: `src/lib/documentProcessor.ts`**

```typescript
// Agregar retry para extracción PDF
export async function extractPdfTextWithRetry(buffer: Buffer, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await extractPdfText(buffer);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

### 4.2 Cambiar `require` a `import` (Día 1)

**Archivo: `src/lib/documentProcessor.ts`**

```typescript
// Antes
const PDFParser = require("pdf2json");

// Después
import PDFParser from "pdf2json";
```

Verificar compatibilidad ejecutando:
```bash
npm run build
```

### 4.3 Implementar paginación (Día 2)

**Archivos a modificar:**
- `src/app/api/documents/route.ts` (GET)
- `src/app/api/licitaciones/route.ts` (GET)
- `src/app/api/config/audit/route.ts` (GET — ya tiene, replicar)

```typescript
// Patrón estándar
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const page = Math.max(1, Number(searchParams.get("page") || "1"));
const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE))));
const skip = (page - 1) * pageSize;

const [items, total] = await Promise.all([
  prisma.documentoOficial.findMany({ where, orderBy, skip, take: pageSize }),
  prisma.documentoOficial.count({ where }),
]);

return NextResponse.json({
  items,
  pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});
```

### 4.4 Aumentar cobertura de tests (Día 2-3)

**Nuevos archivos de test:**

| Archivo | Qué testear |
|---------|-------------|
| `src/lib/documentProcessor.test.ts` | `extractTitulo`, `extractNumero`, `extractFecha`, `analyzeDocument` |
| `src/lib/audit.test.ts` | `auditLog` crea registro correctamente |
| `src/app/api/documents/route.test.ts` | POST con PDF, GET lista, PATCH actualiza |
| `src/app/api/licitaciones/route.test.ts` | CRUD completo |

**Ejemplo:**
```typescript
// src/lib/documentProcessor.test.ts
import { describe, it, expect } from "vitest";
import { extractTitulo, extractNumero, analyzeDocument } from "./documentProcessor";

describe("documentProcessor", () => {
  it("extrae título de resolución", () => {
    const text = "RESOLUCIÓN 12345 DE 2024\nPor medio de la cual...";
    expect(extractTitulo(text)).toContain("RESOLUCIÓN");
  });

  it("extrae número de documento", () => {
    const text = "Número: 12345-2024";
    expect(extractNumero(text)).toBe("12345-2024");
  });
});
```

**Meta de cobertura: >60%**

### 4.5 Agregar rate limiting (Día 3)

```bash
npm install @upstash/ratelimit @upstash/redis
```

O implementar rate limit simple en memoria:
```typescript
// src/lib/rateLimit.ts
const requests = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = requests.get(identifier);
  
  if (!record || now > record.resetTime) {
    requests.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) return false;
  record.count++;
  return true;
}
```

### 4.6 Documentar API con OpenAPI (Día 4)

**Archivo: `openapi.yaml`** en raíz o usar `next-swagger-doc`

```bash
npm install next-swagger-doc swagger-ui-react
```

Crear documentación básica para cada endpoint con:
- Métodos HTTP
- Request/Response schemas
- Códigos de error
- Ejemplos

### 4.7 Limpieza de código muerto (Día 4)

| Elemento | Acción |
|----------|--------|
| `src/components/licitaciones/LicitacionCard.tsx` | Eliminar (no se usa) |
| `src/components/licitaciones/LicitacionForm.tsx` | Eliminar (no se usa) |
| `src/components/licitaciones/LicitacionModal.tsx` | Eliminar (no se usa) |
| `scripts/seedApis.mjs` | Revisar si se necesisa; si no, eliminar |

### 4.8 Verificación final (Día 5)

```bash
npm run lint        # 0 errores
npm run test        # >60% cobertura, todos pasan
npm run build       # Compila exitosamente
npm run start       # Arranca sin errores
```

**Checklist de cierre Sprint 4:**
- [ ] Tiempo de respuesta de APIs < 500ms (con paginación)
- [ ] Timeout de 30s en llamadas LLM
- [ ] Retry en extracción PDF
- [ ] Tests pasan con >60% cobertura
- [ ] Documentación OpenAPI disponible en `/api/docs`
- [ ] Código muerto eliminado
- [ ] Build de producción exitoso

---

## Calendario Resumido

| Semana | Días | Objetivo | Entregable |
|--------|------|----------|------------|
| Sprint 1 | 1-5 | Calidad de código | `npm run lint` pasa, 0 `any` |
| Sprint 2 | 6-10 | Seguridad | Auth + validación + protección |
| Sprint 3 | 11-15 | Funcionalidad | 0 mocks, APIs conectadas |
| Sprint 4 | 16-20 | Optimización | Tests >60%, docs, rate limit |

---

## Dependencias entre Tareas

```
Sprint 1 ──────────────────────────────►
  │ Eliminar any
  │ └──► Sprint 2 (Autenticación puede empezar en paralelo)
  │
Sprint 2 ──────────────────────────────►
  │ Auth implementada
  │ └──► Sprint 3 (Conectar APIs requiere auth)
  │
Sprint 3 ──────────────────────────────►
  │ Funcionalidad real
  │ └──► Sprint 4 (Optimizar funcionalidad real)
  │
Sprint 4 ──────────────────────────────►
     Tests, docs, deploy
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| React 19 inestable | Media | Alto | Considerar downgrade a React 18 si surgen bugs |
| NextAuth.js v5 beta cambia API | Media | Medio | Bloquear versión exacta en `package.json` |
| pdf2json incompatible con ESM | Baja | Medio | Probar build temprano en Sprint 4 |
| Falta de tiempo | Media | Alto | Priorizar P0, posponer P2 si es necesario |

---

## Métricas de Éxito (Post-Plan)

| Métrica | Antes | Objetivo | Cómo medir |
|---------|-------|----------|------------|
| Errores ESLint | 34 | 0 | `npm run lint` |
| Uso de `any` | 28 | 0 | `grep -r ": any" src/` |
| Tests | 2 | >20 | `npm run test -- --coverage` |
| Cobertura | ~5% | >60% | Reporte de Vitest |
| APIs con mock | 2 | 0 | Revisar código |
| APIs documentadas | 0% | 100% | `openapi.yaml` completo |
| Auth | 0% | 100% | Intentar API sin token → 401 |

---

## Notas para el Equipo

1. **No mezclar sprints**: Terminar el checklist de cada sprint antes de pasar al siguiente
2. **Commit diario**: Cada tarea debe tener su propio commit con mensaje claro
3. **Revisión de código**: Peer review obligatorio para Sprint 2 (seguridad) y Sprint 3 (funcionalidad)
4. **Testing manual**: Después de Sprint 3, hacer prueba end-to-end completa de cada módulo
5. **Backup**: Antes de Sprint 1, crear rama `legacy-pre-deuda` como respaldo