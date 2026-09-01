# Quickstart · Validación de SPEC-341

Guía runnable para validar la funcionalidad end-to-end en local. No sustituye
al plan de pruebas de Calidad; sirve para que Desarrollo verifique que la
implementación cumple lo que dice el spec antes de reportar CUMPLE.

## Prerequisitos

- Postgres 16 corriendo, Ollama local levantado (modelo del
  parámetro `padre.analisis.modelo`, por defecto `qwen2.5:14b`).
- `.env` y `.env.test` configurados.
- Seed corrido:
  ```bash
  pnpm run seed
  ```
- Migración aplicada:
  ```bash
  npx prisma migrate dev
  ```

## Recorrido manual (dev server + worker)

1. **Levantar server + worker en dos terminales**:
   ```bash
   pnpm dev
   ```
   ```bash
   node --env-file=.env scripts/worker-analisis-expediente.mjs
   ```

2. **Sembrar un padre con un expediente y 2 hechos** (usar el poblador de
   SPEC-345 con `--motivo`):
   ```bash
   node --env-file=.env --import tsx scripts/demo/poblar-demo.ts \
     --motivo="poblar para validar SPEC-341 en local" --confirm
   ```

3. **Login como padre demo** en el navegador y abrir el detalle de UN
   expediente que tenga hechos:
   - PRIMERA VEZ → aparece el banner `ExpedienteGenerando` con posición 1
     y estimado ~90 s.
   - La capa 1 sigue visible marcada "En vivo".
   - Refresca cada 15 s automáticamente.

4. **Esperar publicación** (o mirar `logger` del worker). Al terminar:
   - El banner desaparece.
   - Aparece la sección **"Análisis detallado"** con sello
     *"Análisis al corte del … · incluye 2 hechos"* + etiqueta "análisis asistido".
   - Sección **"Qué puedes hacer ahora"** con los pasos de la guía publicada
     de la categoría dominante.

5. **Reabrir el expediente** (sin cambios):
   - Aparece INMEDIATAMENTE el mismo texto (hash coincide → no encola).
   - Botón "Actualizar análisis" deshabilitado con `Podrás actualizar en …`.

6. **Agregar 1 evento** al expediente (por el botón del padre) y volver:
   - Sección muestra el análisis viejo + banda amarilla:
     *"Hay 1 hecho nuevo desde este análisis"*.
   - En background, el sistema encoló un job nuevo (hash cambió).
   - Al pasar ~90 s, el análisis se refresca solo.

7. **Pulsar "Actualizar análisis"** con hash sin cambiar y cool-down cumplido:
   - Toast: *"Tu análisis ya está al día"*.
   - Cool-down se reinicia.

8. **Probar cola llena** (opcional):
   - Bajar `padre.analisis.tope_fila` a 1 en la BD.
   - Abrir dos expedientes distintos casi simultáneamente.
   - El segundo debe ver el aviso *"La cola está llena — vuelve a intentar…"*.

## Test unitarios/integración clave

```bash
# Contract del hash
pnpm test src/lib/expediente/analisis/hash-cadena.test.ts

# Orquestador con ambos alcances (SC-002 y SC-006)
pnpm test src/lib/expediente/analisis/armar-payload.test.ts

# Anti-frases-pre-horneadas (FR-014)
pnpm test src/lib/expediente/analisis/validar-salida.test.ts

# Endpoint GET/POST (FR-018/019/020)
pnpm test src/app/api/padre/expedientes/**/analisis/route.test.ts
```

## Verificaciones que deben pasar antes de CUMPLE

- [ ] `pnpm run tokens:check` — piso de la línea 1083 sin regresión.
- [ ] `pnpm run arch:check` — sin drift en `02-roles-capacidades.md` (la
  nueva ruta `analisis` debe aparecer en la matriz para todos los roles).
- [ ] `pnpm run locks:check` — el nuevo lock `123456799` está en la tabla.
- [ ] `pnpm run lint` — cero errores en el diff.
- [ ] `pnpm test` — verde en toda la suite tocada.

## Datos que NO deben aparecer en el payload al modelo (SC-002)

Con `alcance=COLEGIO_BLINDADO`:
- CERO ocurrencias del `valor` de cualquier `IdentificadorEstudiante/Profesor/Acudiente`.
- CERO texto de reporte (ni cifrado ni descifrado).
- CERO nombre/apellidos/documento de cualquier persona.

Verificable con un test que arma el payload sobre un expediente demo y
`grep`-ea los valores exactos: `expect(payload.stringify()).not.toContain(nick)`.
