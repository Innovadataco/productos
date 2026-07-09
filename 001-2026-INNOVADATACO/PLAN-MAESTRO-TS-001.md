# PLAN MAESTRO — 001-2026-INNOVADATACO
## Auditoría técnica + Plan de ejecución unificado

| Campo | Detalle |
|-------|---------|
| **ID Plan** | TS-004-MASTER |
| **Fecha** | 2026-07-09 |
| **Método** | Auditoría directa del código fuente en `feature/001-scaffolding`, no solo revisión documental |
| **Estimación total** | 4 días (1 desarrollador) |
| **Orden de ejecución** | Tarea 0 → 1 → 2 → 3 → 4 → 5 |

> **Instrucción para el ejecutor (Cline/Kimi):**  Ejecutar en el orden exacto indicado, marcando cada criterio de aceptación antes de avanzar.

---

## Parte A — Inventario completo de Deudas Técnicas

### Críticas (bloquean cualquier despliegue)

| # | Deuda | Evidencia |
|---|-------|-----------|
| DT-1 | Sin autenticación en ninguna ruta API, pese a existir modelo `User` sin usar | No hay `middleware.ts` en todo el repo; cero uso de `bcrypt`/sesión en `src/` |
| DT-2 | Base de datos SQLite — archivo local, sin volumen ni multi-escritor | `prisma/schema.prisma`: `provider = "sqlite"` |
| DT-3 | `apiKey` de `AiModel` almacenada y devuelta en texto plano | `GET /api/config/models` no excluye el campo `apiKey` del `findMany` |
| DT-4 | Sin `docker-compose.yml` — el `Dockerfile` no contempla el servicio de BD | Raíz del repo |

### Altas (afectan calidad/mantenibilidad, no bloquean VPS de inmediato)

| # | Deuda | Evidencia |
|---|-------|-----------|
| DT-5 | Desalineación código vs documentación de producto 
| DT-6 | Cobertura de tests casi nula — 1 solo archivo de test en todo el proyecto | Solo existe `src/lib/modelClients.test.ts`; cero tests para rutas API, `documentProcessor.ts`, componentes |
| DT-7 | Uso extensivo de `any` en TypeScript (54 ocurrencias) | Debilita el chequeo de tipos que Prisma+TS deberían garantizar |
| DT-8 | 30 bloques `try/catch` sin patrón consistente de logging/manejo de errores | Algunos solo hacen `console.error`, otros retornan mensajes crudos del error al cliente (fuga de detalles internos) |

### Medias (limpieza, no urgente)

| # | Deuda | Evidencia |
|---|-------|-----------|
| DT-9 | `next.config.ts` tiene una IP hardcodeada de una máquina específica (`allowedDevOrigins: ['192.168.2.23']`) | Configuración de un entorno de desarrollo particular comprometida al repo compartido |
| DT-10 | `mockCall` en `modelClients.ts` retorna datos hardcodeados sin marca explícita de fallback | Riesgo de que quede como respuesta silenciosa si un modelo real falla |
| DT-11 | `versionUpdate.md` como bitácora manual de un solo cambio | No escala; reemplazar por tags de git / `CHANGELOG.md` |
| DT-12 | `package.json` sin campo `engines` — no fija versión de Node | Riesgo de comportamiento distinto entre Mac Studio, VPS y CI si cambian de versión de Node |

**Nota positiva:** `*.sqlite` está correctamente en `.gitignore` — no hay archivos de base de datos comprometidos al repo.

---

## Parte B — Plan de Ejecución

### TAREA 0 — Helper de criptografía compartido (prerequisito de Tareas 1 y 2)

**Objetivo:** crear `src/lib/crypto.ts` una sola vez, sin fallback inseguro, antes de que otras tareas lo consuman.

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_KEY no configurada o menor a 32 caracteres.");
  }
  return scryptSync(secret, "innovadataco-salt", 32);
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALG, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, "base64");
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encryptedText = data.subarray(32);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString("utf8");
}
```

**Criterios de aceptación:**
- [ ] `src/lib/crypto.ts` existe, sin ningún string hardcodeado como fallback de clave
- [ ] `ENCRYPTION_KEY` agregada a `.env.example` (vacía) y `.env` (valor real ≥32 caracteres)
- [ ] Quitar temporalmente `ENCRYPTION_KEY` del `.env` y confirmar que `npm run build`/`npm run dev` fallan explícitamente, no silenciosamente

---

### TAREA 1 — Cifrar `apiKey` en `AiModel` (resuelve DT-3)

**Archivos:** `src/app/api/config/models/route.ts`, `src/app/api/config/models/[id]/route.ts`, `src/lib/modelClients.ts`

```typescript
import { encrypt } from "@/lib/crypto";
// create/update:
apiKey: apiKey ? encrypt(apiKey) : null,
```
```typescript
// GET — excluir explícitamente
select: {
  id: true, name: true, provider: true, scope: true,
  baseUrl: true, modelPath: true, active: true,
  config: true, createdAt: true, updatedAt: true,
  // apiKey INTENCIONALMENTE EXCLUIDO
}
```
```typescript
// modelClients.ts — openaiCall
import { decrypt } from "./crypto";
const apiKey = model.apiKey ? decrypt(model.apiKey) : (process.env.OPENAI_APIKEY || "");
```

**Criterios de aceptación:**
- [ ] `apiKey` se cifra antes de `prisma.create` y `prisma.update`
- [ ] `GET /api/config/models` nunca devuelve `apiKey` (verificar con `curl | grep`)
- [ ] Consulta directa a la BD confirma que el valor no es texto plano
- [ ] `testModel()` sigue funcionando con una key real (descifra correctamente)

---

### TAREA 2 — Autenticación mínima single-user (resuelve DT-1)

**Archivos a crear:** `scripts/seedUser.mjs`, `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`

```typescript
// src/lib/auth.ts — mismo principio de no-fallback que Tarea 0
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error("JWT_SECRET no configurado o inválido");
const SECRET = new TextEncoder().encode(secret);
```

**Rutas a proteger (métodos mutadores):**

| Ruta | Métodos |
|------|---------|
| `src/app/api/config/models/route.ts` | POST |
| `src/app/api/config/models/[id]/route.ts` | PUT, DELETE |
| `src/app/api/config/apis/route.ts` | POST |
| `src/app/api/documents/route.ts` | POST, PATCH |
| `src/app/api/licitaciones/route.ts` | POST |
| `src/app/api/research/analyze/route.ts` | POST |

**Criterios de aceptación:**
- [ ] `bcryptjs` + `jose` instalados (Edge-compatible, no `jsonwebtoken`)
- [ ] `node scripts/seedUser.mjs` crea único usuario, no duplica si ya existe
- [ ] Login emite JWT en cookie `httpOnly`, `secure`, `sameSite=strict`
- [ ] Rutas mutadoras devuelven `401` sin sesión, `200` con sesión válida
- [ ] `JWT_SECRET` sin configurar hace fallar el arranque, no usa valor por defecto

---

### TAREA 3 — Migrar SQLite → PostgreSQL + `docker-compose.yml` (resuelve DT-2, DT-4)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://innova:innova@db:5432/innovadataco?schema=public
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on: [db]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: innova
      POSTGRES_PASSWORD: innova
      POSTGRES_DB: innovadataco
    volumes:
      - innovadataco_db_data:/var/lib/postgresql/data

volumes:
  innovadataco_db_data:
```

```bash
# backup antes de migrar
cp base-oficial.sqlite base-oficial.sqlite.backup
rm -rf prisma/migrations/
npx prisma migrate dev --name init_postgres
npm run build
```

**Criterios de aceptación:**
- [ ] Backup del `.sqlite` guardado fuera del repo
- [ ] `provider = "postgresql"` en `schema.prisma`
- [ ] `docker-compose.yml` levanta `app` + `db` con volumen persistente
- [ ] Migraciones regeneradas y aplicadas sin error
- [ ] `docker compose restart db` no borra datos
- [ ] `npm run build` y `npm run dev` funcionan contra Postgres

---

### TAREA 4 — Higiene de código (resuelve DT-6, DT-7, DT-8, DT-9, DT-12)

**Objetivo:** cierre de deudas de calidad que no bloquean el VPS pero degradan mantenibilidad.

**Subtareas:**
- [ ] Agregar `"engines": { "node": ">=22" }` en `package.json` (fija versión, evita DT-12)
- [ ] Quitar la IP hardcodeada de `next.config.ts` o moverla a variable de entorno (`ALLOWED_DEV_ORIGIN`)
- [ ] Reemplazar los `catch (err: any)` más críticos (rutas API que exponen `err.message` al cliente) por manejo tipado que no filtre detalles internos al frontend
- [ ] Marcar explícitamente `mockCall` con un log de advertencia visible (`console.warn("⚠️ Usando MOCK provider")`) para que nunca pase desapercibido en producción
- [ ] Escribir al menos un test por ruta API crítica (`documents`, `licitaciones`, `config/models`) — prioridad sobre cobertura total

**Criterios de aceptación:**
- [ ] `package.json` tiene `engines` definido
- [ ] `next.config.ts` sin IPs hardcodeadas de máquinas específicas
- [ ] Rutas API no devuelven `err.message` crudo al cliente en respuestas de error
- [ ] `mockCall` emite advertencia visible en logs
- [ ] Cobertura de tests > 0 en las 3 rutas críticas mencionadas

---


## Matriz de Priorización

| Tarea | Impacto | Costo | Bloqueante para VPS | Prioridad |
|-------|---------|-------|---------------------|-----------|
| Tarea 0 (crypto helper) | Alto | Bajo | Sí | P0 |
| Tarea 1 (cifrar apiKey) | Alto | Bajo | Sí | P0 |
| Tarea 2 (auth) | Alto | Medio | Sí | P0 |
| Tarea 3 (Postgres + compose) | Alto | Alto | Sí | P1 |
| Tarea 4 (higiene de código) | Medio | Medio | No | P2 |


**Regla de bloqueo:** ningún despliegue a VPS antes de cerrar Tareas 0-3 (P0/P1). Tareas 4 y 5 pueden avanzar en paralelo sin bloquear el despliegue.

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Perder datos en migración SQLite→Postgres | Media | Alto | Backup físico antes de Tarea 3 |
| Variable de entorno faltante en producción | Media | Alto | `getKey()`/`JWT_SECRET` fallan explícitamente al arrancar |
| Código legado que lee `apiKey` sin descifrar | Alta | Alto | Buscar todo uso de `model.apiKey` fuera de `modelClients.ts` antes de cerrar Tarea 1 |
| `err.message` crudo expuesto al cliente | Alta (ya ocurre) | Medio | Cubierto en Tarea 4 |
| Cero cobertura de tests deja regresiones invisibles | Alta | Medio | Cubierto en Tarea 4 |

---

## Instrucción final para el ejecutor (Cline/Kimi)

Ejecutar en orden exacto: **Tarea 0 → 1 → 2 → 3 → 4 → 5**. No avanzar sin marcar todos los criterios de aceptación de la tarea anterior. La Tarea 5 requiere confirmación humana explícita antes de tocar código — no ejecutar sin esa decisión.
