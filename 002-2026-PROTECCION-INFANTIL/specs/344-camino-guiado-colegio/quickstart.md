# Quickstart: Camino guiado del colegio (SPEC-344)

Guía de validación de punta a punta. Prerrequisitos: `.env` local
configurado, BD Docker arriba (`docker compose up -d db`), `npm install`
hecho.

## 1. Setup de datos

```bash
npm run db:migrate    # aplica la migración aditiva de SPEC-344
npm run db:seed       # asegura los eventos+plantillas+cursos_por_defecto sembrados
```

Esperado: sin errores; los eventos `colegio.registro_enlace`,
`colegio.registro_enlace.cuenta_existente`,
`colegio.registro_enlace.nit_ya_registrado`, `colegio.bienvenida_rector`
existen y tienen regla activa.

## 2. Gate de calidad

```bash
npx tsc --noEmit && npm run lint && npm run test:unit && npm run test && npm run build && npm run arch:check
```

Esperado: todo verde. Incluye:
- Tests unit del camino colegio (`estado-colegio.test.ts`,
  `pasos-colegio.test.ts`, `sesion-estado-emitter.test.ts` extendido).
- Test-candado plantilla profesores (FR-026-bis, R11, R12).
- Test-candado plantilla alumnos (FR-026-ter, cierra I-245).
- Suite del padre (`estado.test.ts`, `middleware.test.ts`,
  `camino-padre.spec.ts`) pasa VERDE SIN MODIFICAR (SC-008).
- `arch:check` VERDE (regenerar `docs/architecture/03-navegacion.md`,
  `02-roles-capacidades.md`, `04-modelo.md` en el mismo PR).

## 3. Recorrido real en navegador (Dev PI-2 + CEO post-deploy)

Levantar:
```bash
./scripts/dev-restart.sh
```

**A · Registro por enlace (US1)**
1. `http://localhost:5005/registro-colegio` con correo+NIT nuevos → 202 →
   ver pantalla de aviso con correo escrito.
2. En el buzón (local: `/tmp/emails-*` o pantalla de dev) llega el enlace.
3. Abrir enlace → elegir contraseña → aterriza en `/camino/colegio/rector`.
4. Correo de bienvenida llega al buzón.
5. Repetir con NIT ya usado → ver la MISMA pantalla + otro correo
   `nit_ya_registrado` en el buzón del colegio dueño (anti-enum matiz CEO).

**B · Camino guiado (US2-7)**
1. Paso 1 (`rector`): llenar 5 campos + aceptar convenio → sella cookie →
   pasa a Paso 2. Verificar: intentar `/dashboard/colegio` en URL manual →
   rebota al Paso 2.
2. Paso 2 (`plan`): activar freemium → sella cookie → pasa a Paso 3.
   Verificar: `docker exec 002-2026-proteccion-infantil-db-1 psql -U
   proteccion -d proteccion_infantil -c "SELECT \"finServicio\" FROM
   \"Colegio\" WHERE ..."` es hoy+30 días (puente D2, R6).
3. Paso 3 (`profesores`): agregar 1 profesor individual → sella cookie.
   Luego descargar plantilla Excel → subirla llenada (fila ejemplo) →
   validar (1 fila lista) → confirmar → pasa a Paso 4.
4. Paso 4 (`cursos`): al abrir, aparecen 11 cursos activos SIN digitar
   nada (D5). Editar una materia sin profesor → error 400 "Toda materia
   debe llevar un profesor" (D3). Asignar profesor → 201.
5. Paso 5 (`estudiantes`): agregar 1 estudiante con 1 acudiente
   (documento opcional) → sella cookie → pasa a `/camino/colegio/listo`.
6. Ver el dashboard del colegio abrir al primer intento, sin recargar.

**C · Nada del padre se rompe (US8)**
1. Padre PARENT nuevo en `/registro` → camino de 4 pasos → funciona idéntico.
2. Otros roles (OPERADOR, COMITE_VALIDACION, ADMIN, COMITE_CONVIVENCIA):
   navegan sin ver el guardián del camino.

## 4. Verificación de arquitectura

```bash
npm run arch:check
```

Esperado: VERDE tras regenerar los tres artefactos citados.

## 5. Suites obligatorias antes de mergear

- `npx tsc --noEmit`: 0 errores.
- `npm run lint`: 0 errores.
- `npm run test:unit`: verde con tests unit del camino colegio + candados
  I-245.
- `npm run test` (integración): verde con:
  - `estado-colegio.test.ts`
  - `auth/registro-colegio/{solicitar,completar}/route.test.ts`
  - `colegio/suscripcion/activar-freemium/route.test.ts`
  - `colegio/suscripcion/solicitar-plan/route.test.ts` (extensión con
    `finServicio`)
  - `colegio/carga-profesores/{plantilla,validar,confirmar}/route.test.ts`
  - `colegio/cursos/[id]/materias/route.test.ts` (D3 + PATCH)
  - `colegio/carga/plantilla/route.test.ts` (candado I-245 en alumnos)
- `npm run build`: compila.
- `npm run test:e2e`: `camino-colegio.spec.ts` verde a 390 px.

## 6. Post-deploy (lo ejecuta el CEO)

- `npm run db:seed` en prod para asegurar los nuevos eventos+plantillas
  sembrados.
- Verificar en Grafana / logs: el primer registro por enlace de colegio
  emite el evento correcto.
- Revisar 1 colegio "viejo" con `representanteLegalIdentificacion =
  'PENDIENTE'` (si existe): al primer login del rector recorrerá el
  camino en el Paso 1 (retroactivo, sin acción manual).
