# PLAN-007 · Schema Prisma BI

## Pasos de implementación

### Paso 1 · Instalar Prisma

```bash
cd 005-2026-BI-INTELIGENCIA-NEGOCIO
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider postgresql
```

Esto crea `prisma/schema.prisma` con datasource por defecto.

### Paso 2 · Reemplazar `prisma/schema.prisma`

Contenido completo del schema con los 6 modelos. Ver sección de modelos en `research.md`.

Variables de entorno requeridas en `.env` (desarrollo local):
```
DATABASE_URL="postgresql://bi_admin:<password>@localhost:5433/proteccion_infantil?schema=public"
```

Nota: `.env` ignorado por git (`.gitignore` ya incluye `.env`). En producción se usa `.env.bi.production`.

### Paso 3 · Verificar schema contra PI (candado 15)

```bash
grep -n "@@map" prisma/schema.prisma
# Verificar que ningún nombre de modelo Prisma ≠ nombre tabla en PI
# Los 6 modelos BI (bi_catalogo_*) son tablas NUEVAS · no colisionan con PI
```

### Paso 4 · Crear migración inicial

```bash
npx prisma migrate dev --name "schema_catalogo_bi_inicial" --create-only
```

Editar el SQL generado para agregar manualmente (si no está):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Verificar que el SQL no incluye `DROP` ni `TRUNCATE` (candado D-11 · migraciones aditivas).

### Paso 5 · Aplicar migración

```bash
npx prisma migrate deploy
# En dev local con bi-db-replica healthy
```

### Paso 6 · Crear rol bi_admin en BD

Script SQL (solo se corre una vez por Jelkin o Fábrica en VPS):
```sql
-- NO commitear con passwords reales · placeholder
CREATE USER bi_admin WITH PASSWORD '<password_bi_admin>';
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  bi_catalogo_tabla, bi_catalogo_columna, bi_catalogo_metrica,
  bi_catalogo_ejemplo, bi_consulta_log, bi_cache_semantico
TO bi_admin;
-- bi_admin NO tiene permisos sobre tablas replicadas de PI
```

El password se guarda en `.env.bi.production` como `BI_ADMIN_DATABASE_URL` y en gestor de contraseñas IDC.

### Paso 7 · Actualizar INVENTARIO-DE-SECRETOS.md

Agregar entrada:
```markdown
| bi_admin | bi-db-replica | BI catalog write | .env.bi.production · var BI_ADMIN_DATABASE_URL | 2026-08-28 |
```

### Paso 8 · Actualizar `.env.bi.example`

Agregar línea documentada:
```bash
# bi_admin: escritura en tablas bi_catalogo_* (NO tablas PI)
# BI_ADMIN_DATABASE_URL=postgresql://bi_admin:<password>@bi-db-replica:5432/proteccion_infantil?schema=public
```

### Paso 9 · Generar cliente Prisma

```bash
npx prisma generate
```

### Paso 10 · Verificar tipos TypeScript

```bash
npx tsc --noEmit
```

---

## Árbol de archivos resultante

```
005-2026-BI-INTELIGENCIA-NEGOCIO/
├── prisma/
│   ├── schema.prisma          (NUEVO · 6 modelos BI)
│   └── migrations/
│       └── 20260828XXXXXX_schema_catalogo_bi_inicial/
│           └── migration.sql  (NUEVO · CREATE TABLE + CREATE EXTENSION vector)
├── INVENTARIO-DE-SECRETOS.md  (actualizado · bi_admin)
└── .env.bi.example            (actualizado · BI_ADMIN_DATABASE_URL documentada)
```

---

## Dependencias de orden

- Paso 1 → Paso 2 → Paso 3 → Paso 4 → Paso 5 (secuencial)
- Paso 6 puede hacerlo Jelkin en paralelo con Paso 4
- Paso 7 + Paso 8 después de Paso 6
- Paso 9 + Paso 10 después de Paso 5

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
