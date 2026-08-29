# Quickstart: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

## Verificación local (después de implementar)

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Aplicar migración:
   ```bash
   npx prisma migrate dev --name add_timestamptz_bogota
   ```

3. Verificar schema:
   ```bash
   npx prisma validate
   ```

4. Correr tests de fechas:
   ```bash
   TZ=UTC npm run test -- src/lib/colegio/fechas-humano.test.ts
   ```
   Deben pasar incluyendo los casos de 23:59 y 00:01 Bogotá.

5. Grep de cumplimiento:
   ```bash
   # Frontend debe incluir timeZone America/Bogota
   grep -R "toLocaleString\|toLocaleDateString\|toLocaleTimeString\|Intl.DateTimeFormat" src/ | grep -v "timeZone"
   # Debe estar vacío o solo contener casos justificados.
   ```

## Verificación en producción / VPS

1. TZ de cada contenedor:
   ```bash
   ssh pi-vps "docker exec pi-app printenv TZ"
   ssh pi-vps "docker exec pi-worker printenv TZ"
   ssh pi-vps "docker exec pi-monitor printenv TZ"
   ssh pi-vps "docker exec pi-simulador-abuso printenv TZ"
   ```
   Resultado esperado: `America/Bogota` en los cuatro.

2. Hora del sistema dentro de los contenedores:
   ```bash
   ssh pi-vps "docker exec pi-app date"
   ssh pi-vps "docker exec pi-worker date"
   ssh pi-vps "docker exec pi-monitor date"
   ssh pi-vps "docker exec pi-simulador-abuso date"
   ```
   Debe mostrar hora de Bogotá (UTC-5).

3. Postgres sigue en UTC:
   ```bash
   ssh pi-vps "docker exec pi-db psql -U proteccion -d proteccion_infantil -c 'SHOW TIME ZONE;'"
   ```
   Resultado esperado: `Etc/UTC`.

4. Test manual de medianoche:
   - Crear un reporte (o seed de prueba) con `fechaIncidente` a las 23:59 Bogotá.
   - Verificar en UI/admin que `fechaLargaES` imprime el día correcto (no el siguiente).
   - Repetir con 00:01 Bogotá.

5. Test de timezone del navegador:
   - Abrir DevTools → Sensors → Location → timezone `Pacific/Auckland`.
   - Refrescar PI.
   - Las fechas mostradas deben seguir siendo hora de Bogotá.

## Rollback

- Revertir el commit de esta SPEC.
- No reversionar la migración en producción a menos que ZEUS lo autorice; la migración a `Timestamptz(6)` es aditiva y no pierde datos.
