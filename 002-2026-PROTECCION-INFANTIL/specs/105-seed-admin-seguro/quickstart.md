# Quickstart — SPEC-105: validación del seed seguro del admin

## Prerrequisitos

- BD dev levantada (`docker-compose up -d db`), migraciones aplicadas.
- `SEED_ADMIN_PASSWORD` definida SOLO para las pruebas 1 y 2 (valor de prueba cualquiera,
  nunca uno real).

## 1. Siembra inicial crea el admin con flag de cambio

```bash
SEED_ADMIN_PASSWORD='<valor-de-prueba-seguro>' npx prisma db seed
# Esperado: admin creado. En BD: rol ADMIN, estado activo, debeCambiarPassword=true.
```

## 2. El seed NUNCA pisa una credencial rotada

```bash
# Cambiar la contraseña del admin a mano (psql o por la UI con otro admin)
SEED_ADMIN_PASSWORD='<valor-de-prueba-seguro>' npx prisma db seed
SEED_ADMIN_PASSWORD='<otro-valor-distinto>' npx prisma db seed
# Esperado en ambas: log "existente, sin cambios"; el hash rotado se conserva intacto.
```

## 3. Sin la variable, el seed omite el admin y no falla

```bash
# En una base limpia (o con el admin borrado):
env -u SEED_ADMIN_PASSWORD npx prisma db seed
# Esperado: log "[SEED] Admin omitido: SEED_ADMIN_PASSWORD no definida o débil";
# el resto del seed completa exit 0; no hay admin en BD.
```

## 4. Contraseña débil

```bash
SEED_ADMIN_PASSWORD='corta' npx prisma db seed
# Esperado: misma omisión que en (3), sin crear admin.
```

## 5. Repo sin literales

```bash
npx tsx scripts/barrido-credenciales.ts
# Esperado: 0 hallazgos "real" en seed.ts; reporte solo con ubicación/tipo (sin valores).
```

## 6. Guarda de regresión

```bash
npm run test -- prisma
# Esperado: el test anti-literal pasa con el seed corregido.
# (Para verlo fallar: reintroducir a mano un literal en seed.ts → el test se pone rojo.)
```

## 7. Procedimiento CEO

Ver el documento de rotación (FR-007) en `docs/`: fijar `SEED_ADMIN_PASSWORD` en el entorno
del VPS antes de cualquier seed futuro y rotación de la credencial viva (la ejecuta el CEO).
