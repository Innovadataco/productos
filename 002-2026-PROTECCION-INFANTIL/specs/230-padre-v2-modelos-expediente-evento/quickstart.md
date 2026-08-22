# Quickstart: Validación de Modelos Expediente y Evento (002-PI-130)

**Prerequisites**: Docker, Node.js >=22, `.env` con `DATABASE_URL`, contenedor `002-2026-proteccion-infantil-db-1` disponible.

---

## 1. Iniciar PostgreSQL

```bash
docker compose up -d db
docker compose ps
```

**Esperado**: el servicio `db` aparece en estado `healthy`.

---

## 2. Instalar dependencias, generar cliente y migrar

```bash
npm install
npx prisma generate
npx prisma migrate dev --name padre_v2_expediente_evento
```

**Esperado**:
- Migraciones aditivas aplicadas sin `DROP` ni `RENAME`.
- Nuevos enums `EstadoExpediente` y `ScoreGravedad`.
- Valor `CONSOLIDACION_EXPEDIENTE` agregado a `TipoRevisionComite`.
- Modelos `Expediente` y `EventoExpediente` presentes en el cliente Prisma.

---

## 3. Sembrar parámetros `padre.*`

```bash
npx prisma db seed
```

Verificar que existen los 18 parámetros:

```bash
docker compose exec db psql -U proteccion -d proteccion_infantil \
  -c "SELECT clave, valor FROM \"ParametroSistema\" WHERE clave LIKE 'padre.%' ORDER BY clave;"
```

**Esperado**: 18 filas con los valores por defecto listados en el alcance.

---

## 4. Verificar idempotencia del seed

```bash
# Primera corrida
npx prisma db seed

# Simular ajuste manual de un parámetro
docker compose exec db psql -U proteccion -d proteccion_infantil \
  -c "UPDATE \"ParametroSistema\" SET valor='9999' WHERE clave='padre.expediente.rate_limit_eventos_24h';"

# Segunda corrida
npx prisma db seed

# Verificar que no se sobrescribió
docker compose exec db psql -U proteccion -d proteccion_infantil \
  -c "SELECT valor FROM \"ParametroSistema\" WHERE clave='padre.expediente.rate_limit_eventos_24h';"
```

**Esperado**: el valor permanece en `9999` (respetando el anti-I-100).

También se puede ejecutar el test automatizado:

```bash
npm run test -- src/lib/seed-idempotencia.test.ts
```

**Esperado**: todos los tests de idempotencia pasan.

---

## 5. Ejecutar tests del repositorio

```bash
npm run test -- src/lib/dal/repositories/expediente-repository.test.ts
```

**Esperado**: pasan los tests de:
- `crearExpediente`.
- `agregarEvento` con `ordenSecuencial` monotónico dentro de la transacción.
- `listarExpedientesDePadre`.
- `obtenerExpedientePorId`.
- Cumplimiento de la frontera DAL (sin acceso directo a Prisma fuera del repository).

---

## 6. Verificar tipos y build

```bash
npx tsc --noEmit
npm run build
```

**Esperado**: compilación limpia, sin errores de TypeScript.

---

## 7. Notas

- Este alcance **no expone endpoints ni UI**; por eso no hay comandos `curl`.
- Para validaciones manuales adicionales, importar funciones desde `src/lib/dal/repositories/expediente-repository.ts` y no usar `@/lib/prisma` directamente fuera de la capa DAL.
