# Quickstart: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Prerequisites**: Docker, Node.js >=22, PostgreSQL corriendo (`docker compose up -d db`), migraciones aplicadas y seed ejecutado. **Importante**: hacer un dump de respaldo de la BD antes de ejecutar migraciones/seed.

---

## 1. Backup de la base de datos

```bash
pg_dump -h localhost -p 5433 -U proteccion -d proteccion_infantil > /tmp/backup-pre-073.dump
```

**Esperado**: archivo de backup creado sin errores.

---

## 2. Aplicar migración aditiva

```bash
npx prisma migrate deploy
```

**Esperado**: la migración `add_departamento` se aplica sin pérdida de datos.

---

## 3. Ejecutar seed

```bash
npx prisma db seed
```

**Esperado**: Colombia, 33 departamentos y las ciudades principales se crean/actualizan. No se duplican registros.

---

## 4. Verificar datos en la BD

Conectarse a la BD (por ejemplo, con `psql` o `npx prisma studio`) y ejecutar:

```sql
SELECT COUNT(*) FROM departamentos WHERE "paisId" = (SELECT id FROM paises WHERE codigo = 'CO');
-- Esperado: 33

SELECT COUNT(*) FROM ciudades WHERE "paisId" = (SELECT id FROM paises WHERE codigo = 'CO') AND "departamentoId" IS NOT NULL;
-- Esperado: >= 10 (las ciudades existentes vinculadas)

SELECT c.nombre, d.nombre AS departamento
FROM ciudades c
JOIN departamentos d ON c."departamentoId" = d.id
WHERE c.nombre IN ('Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales', 'Cúcuta', 'Ibagué');
-- Esperado: cada ciudad con su departamento correcto
```

---

## 5. Verificar endpoints sin cambios

```bash
# Lista de países
curl http://localhost:5005/api/paises

# Ciudades de Colombia
curl "http://localhost:5005/api/ciudades?paisId=<id-colombia>"
```

**Esperado**: mismos contratos y datos que antes, incluyendo opción "Otra ciudad o municipio" al final.

---

## 6. Verificar flujo de reporte sin cambios

1. Abrir `http://localhost:5005/reportar`.
2. Seleccionar Colombia → Bogotá (o cualquier ciudad) y completar el reporte.
3. **Esperado**: el reporte se guarda con `pais`, `ciudad`, `paisId`, `ciudadId` como siempre; no se requiere departamento.

---

## 7. Ejecutar tests y build

```bash
npm run test
npm run build
```

**Meta**: 600+ tests verdes, build sin errores.

---

## 8. (Opcional) Rollback si algo falla

Si se detecta regresión, restaurar desde el backup:

```bash
psql -h localhost -p 5433 -U proteccion -d proteccion_infantil < /tmp/backup-pre-073.dump
```

**Nota**: nunca usar `prisma migrate reset` en este proyecto.
