# PLAN DE TAREAS SEGUIDAS — 002
## Proyecto 001-2026-INNOVADATACO

| Campo | Detalle |
|-------|---------|
| **ID Plan** | TS-002 |
| **Fecha** | 2026-07-09 |
| **Tareas** | 1. SQLite → PostgreSQL, 2. Auth mínima single-user, 3. Encriptar apiKey en AiModel |
| **Estimación total** | 3 días (1 desarrollador) |
| **Orden** | Tarea 3 → Tarea 2 → Tarea 1 |

---

## Metodología

Cada tarea tiene:
- **Objetivo claro**: qué se entrega
- **Archivos a modificar/crear**: referencias exactas
- **Criterios de aceptación**: cómo saber que está listo
- **Dependencias**: qué debe hacerse antes

**Orden de implementación:**
1. **Tarea 3 (Encriptar apiKey)** — independiente de la DB, bajo riesgo, alta prioridad de seguridad.
2. **Tarea 2 (Auth single-user)** — usa la estructura actual, no requiere cambio de DB.
3. **Tarea 1 (SQLite → PostgreSQL)** — cambio más disruptivo, mejor al final cuando todo lo demás está estable.

---

## TAREA 1 — Migrar SQLite → PostgreSQL

**Objetivo:** Cambiar el backend de persistencia de SQLite a PostgreSQL sin pérdida de datos.

### 1.1 Cambiar datasource en Prisma

| Acción | Archivo |
|--------|---------|
| Cambiar provider | `prisma/schema.prisma` |
| Ajustar .env | `.env`, `.env.example` |

```prisma
// prisma/schema.prisma — ANTES
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// DESPUÉS
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```bash
# .env — ANTES
DATABASE_URL=file:./base-oficial.sqlite

# DESPUÉS
DATABASE_URL="postgresql://user:pass@localhost:5432/innovadataco?schema=public"
```

### 1.2 Regenerar migraciones

SQLite y PostgreSQL no comparten dialecto de migraciones. Se debe:

```bash
# 1. Eliminar migraciones viejas
rm -rf prisma/migrations/

# 2. Crear migración inicial contra PostgreSQL
npx prisma migrate dev --name init_postgres
```

**Riesgo:** SQLite es permisivo con NULLs vs strings vacíos. Si hay datos existentes, validar que no haya `"` donde Prisma espera `NULL` en Postgres.

### 1.3 Dockerizar PostgreSQL (opcional pero recomendado)

Crear `docker-compose.yml` en raíz:

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: innova
      POSTGRES_PASSWORD: innova
      POSTGRES_DB: innovadataco
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  volumes:
    pgdata:
```

### 1.4 Verificación

```bash
npx prisma db pull      # Verificar conexión
npx prisma migrate dev  # Migraciones aplicadas
npm run build           # Compila sin errores
npm run dev             # App arranca y lee/escribe en PostgreSQL
```

**Checklist:**
- [ ] `provider = "postgresql"` en `schema.prisma`
- [ ] `DATABASE_URL` apunta a PostgreSQL
- [ ] Migraciones regeneradas y aplicadas
- [ ] `npm run build` compila exitosamente
- [ ] Al menos un registro de prueba se crea y lee correctamente

---

## TAREA 2 — Implementar auth mínima single-user con password

**Objetivo:** Proteger rutas API y páginas con autenticación básica usando el modelo `User` ya existente.

### 2.1 Instalar dependencias

```bash
npm install bcryptjs jose
npm install -D @types/bcryptjs
```

**Por qué `jose` y no `jsonwebtoken`:** Next.js 16 usa Edge Runtime en middleware/API routes. `jsonwebtoken` no es compatible con Edge. `jose` es el estándar.

### 2.2 Crear seed de usuario único

Crear `scripts/seedUser.mjs`:

```javascript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Usuario ya existe. Saltando seed.");
    return;
  }

  const hashed = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      username: "admin",
      password: hashed,
      role: "admin",
    },
  });
  console.log("Usuario admin creado.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 2.3 Crear helper de encriptación/desencriptación

Crear `src/lib/crypto.ts` (reutilizado también en Tarea 3):

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALG = "aes-256-gcm";
const KEY = scryptSync(process.env.ENCRYPTION_KEY || "fallback-key-min-32-chars!!", "salt", 32);

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALG, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, "base64");
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encryptedText = data.subarray(32);
  const decipher = createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString("utf8");
}
```

### 2.4 Crear ruta de login

Crear `src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret-min-32-characters-long!!");

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

  const token = await new SignJWT({ sub: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", token, { httpOnly: true, secure: true, sameSite: "strict", maxAge: 604800 });
  return res;
}
```

### 2.5 Crear helper de verificación de sesión

Crear `src/lib/auth.ts`:

```typescript
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "secret-min-32-characters-long!!");

export async function verifyAuth() {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return payload as { sub: string; username: string; role: string };
  } catch {
    return null;
  }
}
```

### 2.6 Proteger rutas API críticas

Modificar rutas para validar `verifyAuth()` al inicio de cada handler mutador:

| Ruta | Métodos a proteger |
|------|-------------------|
| `src/app/api/config/models/route.ts` | POST |
| `src/app/api/config/models/[id]/route.ts` | PUT, DELETE |
| `src/app/api/config/apis/route.ts` | POST |
| `src/app/api/documents/route.ts` | POST, PATCH |
| `src/app/api/licitaciones/route.ts` | POST |
| `src/app/api/research/analyze/route.ts` | POST |

Patrón a insertar:

```typescript
import { verifyAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await verifyAuth();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  // ... resto del handler
}
```

### 2.7 Actualizar .env

Añadir a `.env` y `.env.example`:

```bash
JWT_SECRET=tu-clave-secreta-de-al-menos-32-caracteres
```

### 2.8 Verificación

```bash
# 1. Seed
node scripts/seedUser.mjs

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. Probar acceso protegido sin token → 401
curl http://localhost:3000/api/config/models

# 4. Probar con cookie → 200
curl http://localhost:3000/api/config/models --cookie "token=..."
```

**Checklist:**
- [ ] `bcryptjs` y `jose` instalados
- [ ] Script `seedUser.mjs` crea usuario único
- [ ] Login emite JWT en cookie `httpOnly`
- [ ] `verifyAuth()` valida JWT correctamente
- [ ] Rutas críticas retornan 401 sin sesión
- [ ] Rutas críticas funcionan con sesión válida

---

## TAREA 3 — Encriptar apiKey en AiModel

**Objetivo:** Almacenar `apiKey` encriptada en la base de datos y nunca exponerla al frontend.

### 3.1 Reutilizar helper de crypto

Usar `src/lib/crypto.ts` creado en Tarea 2 (funciones `encrypt` y `decrypt`).

### 3.2 Modificar rutas de modelos para encriptar/mascar

**Archivo: `src/app/api/config/models/route.ts`**

POST: encriptar `apiKey` antes de guardar:

```typescript
import { encrypt } from "@/lib/crypto";

// En el create:
apiKey: apiKey ? encrypt(apiKey) : null,
```

GET: excluir `apiKey` del response:

```typescript
const models = await prisma.aiModel.findMany({
  orderBy: { createdAt: "desc" },
  select: {
    id: true, name: true, provider: true, scope: true,
    baseUrl: true, modelPath: true, active: true,
    config: true, createdAt: true, updatedAt: true,
    // apiKey INTENCIONALMENTE EXCLUIDO
  },
});
```

**Archivo: `src/app/api/config/models/[id]/route.ts`**

PUT: si se envía `apiKey`, encriptarla; si no, mantener la existente:

```typescript
apiKey: body.apiKey !== undefined
  ? (body.apiKey ? encrypt(body.apiKey) : null)
  : existing.apiKey,
```

GET individual (si existe): también excluir `apiKey`.

### 3.3 Desencriptar al usar el modelo

**Archivo: `src/lib/modelClients.ts`**

En `openaiCall`, desencriptar `apiKey` antes de usarla:

```typescript
import { decrypt } from "./crypto";

async function openaiCall(model: AiModelInput, prompt: string): Promise<ModelResult> {
  const apiKey = model.apiKey ? decrypt(model.apiKey) : (process.env.OPENAI_APIKEY || "");
  // ... usar apiKey en header Authorization
}
```

### 3.4 Actualizar .env

Añadir a `.env` y `.env.example`:

```bash
ENCRYPTION_KEY=tu-clave-de-encriptacion-de-32-caracteres!!
```

**Requisito:** exactamente 32 caracteres (256 bits) o usar `scryptSync` para derivar la clave.

### 3.5 Verificación

```bash
# 1. Crear modelo con apiKey
curl -X POST http://localhost:3000/api/config/models \
  -H "Content-Type: application/json" \
  -d '{"name":"GPT-4","provider":"openai","modelPath":"gpt-4","apiKey":"sk-real-key-123"}'

# 2. Listar modelos — apiKey NO debe aparecer
curl http://localhost:3000/api/config/models | grep -i "sk-real" && echo "FAIL" || echo "OK"

# 3. Verificar en DB que está encriptada
psql -d innovadataco -c "SELECT apiKey FROM \"AiModel\";" | grep -i "sk-real" && echo "FAIL" || echo "OK"

# 4. Llamada a modelo debe funcionar (desencripta internamente)
curl -X POST http://localhost:3000/api/config/models/test ...
```

**Checklist:**
- [ ] `apiKey` se encripta antes de `prisma.create`
- [ ] `apiKey` se encripta antes de `prisma.update`
- [ ] `GET /api/config/models` nunca devuelve `apiKey` real
- [ ] `modelClients.ts` desencripta antes de llamar a OpenAI
- [ ] La apiKey en DB no es legible en texto plano
- [ ] Llamadas a modelos funcionan correctamente

---

## Dependencias entre Tareas

```
Tarea 3 (Encriptar apiKey) ─────────────────►
   │ No depende de nadie
   │
   └──► Tarea 2 (Auth single-user) ─────────►
          │ Depende de: helper crypto (reutilizado)
          │
          └──► Tarea 1 (SQLite → PostgreSQL) ──►
                 │ Depende de: nada técnico, pero mejor al final
                 │ para no mezclar cambios de DB con lógica de negocio
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Perder datos en migración SQLite→Postgres | Media | Alto | Backup de `.sqlite` antes de migrar; exportar/importar con script |
| `jose` incompatible con algún runtime | Baja | Medio | Probar `npm run build` inmediatamente después de instalar |
| `apiKey` encriptada pero código antiguo la lee como plain | Alta | Alto | Buscar TODOs donde se lea `model.apiKey` directamente |
| `ENCRYPTION_KEY` no configurada en prod | Baja | Alto | Validar en startup que `ENCRYPTION_KEY` tiene ≥32 chars |
| Usuario admin queda con password débil | Baja | Medio | Forzar cambio de password en primer login (fase 2) |

---

## Métricas de Éxito

| Métrica | Antes | Objetivo | Cómo medir |
|---------|-------|----------|------------|
| DB provider | sqlite | postgresql | `prisma/schema.prisma` |
| Auth en APIs | ninguna | JWT + cookie httpOnly | `curl` sin cookie → 401 |
| apiKey en DB | texto plano | AES-256-GCM | Query directa a DB, legible? No |
| apiKey expuesta al frontend | sí | no | `grep` en response de GET /models |
| Dependencias nuevas | — | `bcryptjs`, `jose` | `package.json` |

---

## Notas para el Equipo

1. **No mezclar tareas**: terminar checklist de cada tarea antes de pasar a la siguiente.
2. **Commit por tarea**: un commit claro por cada tarea (ej: `feat: encriptar apiKey en AiModel`).
3. **Revisión obligatoria**: la Tarea 2 (auth) y Tarea 3 (crypto) requieren peer review antes de merge.
4. **Testing manual**: después de Tarea 3, verificar que los modelos OpenAI siguen funcionando.
5. **Backup DB**: antes de Tarea 1, copiar `base-oficial.sqlite` como respaldo.