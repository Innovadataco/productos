# scripts/README.md · CLI catálogo BI

## Requisitos

- Node.js 22+
- `BI_ADMIN_DATABASE_URL` exportada, o presente en `.env.bi.production` en la raíz del repo
- Cliente Prisma generado (`npx prisma generate`)

## Comandos

### list-tablas · listar tablas activas del catálogo

```bash
node scripts/catalogo-cli.mjs list-tablas
```

### add-tabla · crear o actualizar una tabla del catálogo

```bash
node scripts/catalogo-cli.mjs add-tabla <nombreFuente> --legible "<nombre legible>" \
  [--descripcion "<descripción>"] [--roles ADMIN,SCHOOL_ADMIN]
```

Ejemplo:
```bash
node scripts/catalogo-cli.mjs add-tabla Reporte --legible "Reportes de riesgo" \
  --descripcion "Reportes de conducta PI" --roles ADMIN,SCHOOL_ADMIN
```

### add-ejemplo · añadir ejemplo NL→SQL curado

```bash
node scripts/catalogo-cli.mjs add-ejemplo --pregunta "<pregunta NL>" --sql "<SQL>" \
  [--categoria reportes|motor_ia|comercial|operativo|salud|general]
```

### list-consultas · ver traza de consultas (candado 12)

```bash
node scripts/catalogo-cli.mjs list-consultas [--usuario <usuarioId>] [--dias N]
```

### aprobar-cache · aprobar una consulta y moverla a cache semántico (candado 7)

```bash
node scripts/catalogo-cli.mjs aprobar-cache <consulta_id>
```

### list-metricas · listar métricas de negocio activas

```bash
node scripts/catalogo-cli.mjs list-metricas
```

## Flujo típico (Fábrica BI-2)

1. Ver qué preguntó cada usuario: `list-consultas --dias 3`
2. Identificar una consulta bien resuelta y aprobarla: `aprobar-cache <id>`
3. Añadir un ejemplo nuevo: `add-ejemplo --pregunta "..." --sql "..." --categoria reportes`
4. Añadir/ajustar una tabla del catálogo: `add-tabla <nombre> --legible "..."`

## Seguridad

- El CLI usa el rol `bi_admin` (escritura solo en tablas `bi_catalogo_*`).
- Nunca imprime la URL de conexión ni la password (candado 19).
- Requiere `.env.bi.production` con permisos `600` en el VPS.
