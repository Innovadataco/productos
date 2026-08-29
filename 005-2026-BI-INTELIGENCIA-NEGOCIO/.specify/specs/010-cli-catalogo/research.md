# RESEARCH-010 · CLI catálogo BI

## Decisión · ESM Node.js vs TypeScript compilado

**Alternativas:**

| Opción | Pro | Contra |
|---|---|---|
| `catalogo-cli.mjs` ESM puro (Node.js) | Sin compilación · ejecutable directo · `node scripts/catalogo-cli.mjs` | Sin tipos TypeScript en el CLI |
| `scripts/catalogo-cli.ts` compilado con tsc | Tipos TS | Paso de compilación adicional · Fábrica necesita `npx tsx` |
| `scripts/catalogo-cli.ts` con `tsx` directo | Tipos TS · sin compilación extra | `tsx` debe estar instalado como devDependency |

**Decisión adoptada:** `catalogo-cli.mjs` ESM puro. Razón: el CLI es usado por Fábrica directamente (no es código de producción de la app), no necesita tipos estrictos, y un archivo `.mjs` es más simple de distribuir y ejecutar. Los tests unitarios del CLI SÍ son TypeScript (`.test.ts`) para aprovechar el tipo de retorno de Prisma.

---

## Lectura de BI_ADMIN_DATABASE_URL

El CLI requiere `bi_admin` (escritura) para `add-tabla`, `add-ejemplo`, `aprobar-cache`. En local dev, la variable puede estar en `.env.bi.production` (no en `.env` — ese archivo usa bi_reader para las tablas replicadas PI).

Orden de búsqueda:
1. `process.env.BI_ADMIN_DATABASE_URL` (variable de entorno exportada)
2. `.env.bi.production` en la raíz del repo (si existe · parseo manual simple)
3. Error claro si ninguna fuente la provee

**Seguridad (candado 19):** el CLI NUNCA imprime el valor de DATABASE_URL ni la password. Solo usa la URL internamente en PrismaClient.

---

## Comandos y candados aplicables

| Comando | Candado | Nota |
|---|---|---|
| `aprobar-cache` | Candado 7 · cache semántico de veredictos humanos | Mueve consulta validada a `bi_cache_semantico` |
| `list-consultas` | Candado 12 · traza completa por consulta | Acceso al log de todas las consultas NL→SQL |
| `add-tabla`, `add-ejemplo` | Candado 8 · catálogo como dato | Gestión del catálogo sin tocar código |

---

## Parser de flags sin dependencias externas

Para evitar añadir `commander` o `yargs` (que implican deps npm adicionales), el CLI usa un parser mínimo:

```javascript
function getFlag(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}
```

Limitación conocida: no soporta `--flag=value` (solo `--flag value`). Aceptable para uso interno por Fábrica.

---

## Tests unitarios · mock de Prisma

Los tests usan `vi.mock("@prisma/client")` de Vitest. El mock devuelve datos fijos sin conectar a BD real. Esto permite correr los tests en CI (GitHub Actions) sin necesidad de una BD PostgreSQL.

El smoke test manual (`T-10`) sí requiere BD real con seed aplicado (SPEC-008 CUMPLE).

---

## `scripts/README.md` — índice de comandos

```markdown
# scripts/README.md · CLI catálogo BI

## Requisitos

- Node.js 22+
- `BI_ADMIN_DATABASE_URL` exportada o en `.env.bi.production`

## Comandos

### list-tablas
node scripts/catalogo-cli.mjs list-tablas

### add-tabla
node scripts/catalogo-cli.mjs add-tabla <nombreFuente> --legible "<nombre legible>" \
  [--descripcion "<descripción>"] [--roles ADMIN,SCHOOL_ADMIN]

### add-ejemplo
node scripts/catalogo-cli.mjs add-ejemplo --pregunta "<pregunta NL>" --sql "<SQL>" \
  [--categoria reportes|motor_ia|comercial|operativo|salud|general]

### list-consultas
node scripts/catalogo-cli.mjs list-consultas [--usuario <usuarioId>] [--dias <N>]

### aprobar-cache
node scripts/catalogo-cli.mjs aprobar-cache <consulta_id>

### list-metricas
node scripts/catalogo-cli.mjs list-metricas
```

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
