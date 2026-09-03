# SPEC-412 · El poblador que marca lo que siembra — cierra I-271, I-292 y el hueco de siembra de A-75

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Dev 02 (`idc-80`) · **Origen**: [BRIEF A-76](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-A-76-SIEMBRA-DE-DATOS.md) del CEO (`idc-59`), 03-09-2026 · radicado 15:47.

**Impacto en arquitectura:** ninguno en `src/`. No hay migración, no hay endpoint nuevo, no cambia el schema. Todo el cambio vive en `scripts/demo/**` y en una bandera nueva de `scripts/limpieza/reset-piloto.ts`. La tabla `demo_marcado` ya existe desde SPEC-160 (migración `20260810080000_demo_marcado`) y este trabajo la usa por primera vez desde el poblador que realmente se corre.

---

## Para qué

Medido contra producción el 03-09-2026: **9.000 de 9.066 reportes son sembrados, 51 de 56 colegios son sembrados, y `demo_marcado` tiene CERO filas**. El sistema no tiene forma de saber qué es humo.

La causa es una sola. La familia `scripts/demo/` (v1…v4) — que es la que de verdad se corrió contra producción, se reconoce por `ClasificacionIA.modeloUsado` = `demo-seed-345/369/382` — **no marca nada**: se apoya en ids deterministas con prefijo (`demo-`, `demo2-`, `demo3-`, `demo4-`) para poder borrar después. Es decir, **metió la etiqueta de demo dentro de la llave primaria**.

Eso rompe el contrato del identificador y deja módulos fuera de prueba:

| Ficha | Síntoma | Dónde se ve |
|---|---|---|
| **I-292** | 254 de 256 casos del comité no abren: «ID inválido» | [`solicitudes/[id]/route.ts:38`](../../src/app/api/colegio/comite/solicitudes/[id]/route.ts) valida con `cuidIdSchema` = `z.string().cuid()` (regex `^c[^\s-]{8,}$`). El id que sembró v3 es `demo3-sol-demo-al-r-00127-E` — tiene guiones y no empieza por `c`. **El sistema rechaza bien; el dato está mal.** |
| **I-271** | El Inicio del administrador cuenta alertas de prueba como carga real | [`inicio-admin.ts:186`](../../src/lib/dal/services/inicio-admin.ts) ya sabe descontar `DemoMarcado`… pero la tabla está vacía, así que descuenta cero. |
| **A-75** | Módulos nuevos sin nada que recorrer | La siembra nunca creció con el producto. |

La tabla correcta existía y estaba vacía; cuando el mecanismo correcto está disponible pero muerto, se inventa uno peor.

> **La regla que ordena todo:** el marcador va en `demo_marcado`. **Nunca en la llave primaria, nunca en el nombre.**

---

## Qué trae

### 1) `scripts/demo/_marcado.ts` — el mecanismo, por fin usado

Librería de marcado por lotes, compartida y sin versión:

- `marcar(client, entidad, ids, opts)` — `createMany` con `skipDuplicates` en lotes de 1.000 sobre `demo_marcado`. El `@@unique([entidad, entidadId])` del modelo hace el resto: re-marcar es gratis e idempotente.
- `contarPorEntidad(client)` / `idsMarcados(client, entidad)` — lectura para reportes y borrado.
- `ENTIDADES_ORDEN_BORRADO` — el orden FK-safe, hojas primero, declarado en un solo lugar.

Por qué una librería nueva y no `scripts/demo-prod/lib/marcar.ts`: ese `marcarDemo` hace **un `upsert` por fila**. Para 9.000 reportes son 9.000 viajes a la base. Aquí se marca por lotes. El de `demo-prod` queda intacto — no tiene llamadores fuera de su carpeta.

### 2) `scripts/demo/poblar-demo-v5.ts` — el poblador corregido

Sucesor de la cadena v1→v4. Tres diferencias que son toda la spec:

1. **Las llaves primarias son `cuid()` de verdad** — las genera Prisma, no el script. Se usan `createManyAndReturn({ select: { id: true, … } })` (Prisma 5.22, PostgreSQL) para recuperar los ids que la base acaba de asignar y poder marcarlos y colgarles los hijos. **No hay ni un `id:` literal en todo el poblador**, y un test-candado lo prueba leyendo el archivo.
2. **Toda entidad sembrada queda en `demo_marcado`**, en la misma transacción que la creó. Sin excepciones: si se creó, se marcó.
3. **La idempotencia ya no la da el id determinista, la da la corrida.** Si `demo_marcado` ya tiene filas de la corrida `v5`, el poblador aborta y dice qué correr para limpiar. `--force` no existe: borrar es un acto separado y explícito.

Cobertura (lo que el brief §5 pedía, menos lo que Jelkin excluyó):

| Bloque | Entidades |
|---|---|
| Colegios | `Tenant`, `Colegio`, `OnboardingColegio`, `Suscripcion`, `PreferenciaAlertaColegio` (todas `habilitado=false`), `Usuario` SCHOOL_ADMIN, `Usuario` COMITE_CONVIVENCIA |
| Aula | `Curso`, `Profesor`, `IdentificadorProfesor`, `Estudiante`, `IdentificadorEstudiante`, `AcudienteEstudiante`, `IdentificadorAcudiente` |
| Expediente del padre | `Usuario` PARENT, `ContactoConfianza`, `IdentificadorContacto` |
| Casos | `Reporte`, `ClasificacionIA`, `AlertaColegio`, `TransicionReporte`, **`SolicitudComite`** |
| Comercial | `Plan` (solo los que falten), `Suscripcion` de colegio y de padre, `Pago` |

**No siembra profesionales de la Red de Apoyo.** Orden de Jelkin del 03-09: esperan a que el módulo esté probado. El brief §5 los marcaba como lo más urgente; queda anotado y sin hacer, a propósito.

### 2-bis) La forma de los datos que BI necesita

Kimi verificó que **BI no guarda ningún identificador de PI**, así que las llaves pueden cambiar sin romperle nada. A cambio, la resiembra repone lo que sus tableros ya consumían (CEO, 03-09 16:0x):

| Qué | Cómo |
|---|---|
| Volumen | 50 colegios · 300 profesores · 2.000 alumnos · ~2.800 acudientes · 4.200 reportes |
| Ventana | los **últimos 36 meses** (veredicto del CEO 03-09 16:2x, corrigiendo los 12 iniciales). Tres años **contienen** los doce, así que nada de lo que BI haga con un año se rompe, y habilita la comparación año contra año — que es lo que Jelkin ya había pedido para v4. Se mueve en un solo lugar: `DEMO5.mesesAtras`. |
| Geografía | 20 países · 120 ciudades, resueltas contra el catálogo real. Si una ciudad del catálogo no está en la BD, **se aborta antes de escribir**: ningún reporte puede quedar con `paisId` nulo. |
| Plataformas y categorías | las 10 plataformas del catálogo y **las 14 categorías** de `CategoriaConducta` más SPAM. A los pesos de v2 les faltaba `OTRO`; se agregó, con sus propios relatos. |
| **Reincidencia deliberada** | el 35 % de los reportes con sujeto reusa un sujeto ya reportado, y el 40 % de esos queda encadenado por `reportePrincipalId`. Sin esto los patrones institucionales quedan vacíos. |
| **Asignación desigual** | cada colegio recibe una fracción distinta de alertas asignadas (0,95 · 0,90 · 0,80 · 0,65 · 0,20, cíclica). Es lo que hace que el semáforo de capacidad muestre sus tres estados. |
| **Transiciones escalonadas** | se reusa `cadenaParaEstado` + `fechasEscalonadas` de v3 — esa lógica ya estaba bien y no tenía nada que ver con la falla de los ids. |

### 2-ter) La capa comercial · y una nota que no se puede perder

> **Ningún camino de producción escribe `Pago`. Verificado en fuente: solo fixtures.** El flujo real es la activación manual del admin ([`admin-activacion-manual.service.ts:199`](../../src/lib/pagos/admin-activacion-manual.service.ts)), que escribe `Suscripcion.montoRealPagado` en COP y **no** crea fila de `Pago`.
>
> Se siembra `Pago` **para que BI pueda ejercitar su tablero comercial** (decisión de Jelkin, 03-09), no porque el producto llene esa tabla. Que nadie concluya mañana, mirando estos datos, que el recaudo real sale de ahí.

- **Los planes que ya están configurados se reusan.** Solo se crea el que falte — y ese sí queda marcado, como todo lo demás.
- **Las dos fuentes cuentan la misma historia**: `Suscripcion.montoRealPagado` = suma de los `Pago` en estado `AUTORIZADO` de esa suscripción, en la misma moneda. Los `PENDIENTE_AUTORIZACION` y `RECHAZADO` existen para dar variedad de estado y **no suman**. El poblador lo verifica contra la base al terminar y reporta el cuadre.
- Suscripciones de los **dos** tipos de titular: colegio y padre.

### 3) `scripts/demo/_borrado-marcado.ts` + `borrar-demo-marcado.ts` — borrar solo lo sembrado

- `planDeBorrado(client)` — **reporte previo**: cuántas filas por entidad va a tocar, y el conteo de lo real que NO va a tocar. Es lo que sale por defecto.
- `ejecutarBorrado(client, motivo)` — borra en orden FK-safe, exclusivamente por `demo_marcado.entidadId`, y al final limpia `demo_marcado`. Deja `AuditLog` por el canal `registrarAuditoriaDemo`.
- El CLI es **dry-run por defecto**, exige `--motivo` de 20 caracteres y solo escribe con `--confirm`.
- Se llama `borrar-demo-marcado` y no `borrar-demo-v5` a propósito: borra **todo lo que esté en `demo_marcado`**, venga del v5 o del marcado retroactivo. Esa es la gracia de tener un marcador de verdad — un solo borrador para toda la siembra, en vez de un `borrar-demo-vN` por generación que hay que recordar correr en orden.
- **Si algo NO marcado cuelga de algo marcado, la transacción falla entera y lo dice.** No se borra a ciegas para destrabar: una fila inesperada colgando de un dato sembrado es información.

### 4) `scripts/demo/marcar-retroactivo.ts` — el marcador de lo que ya está sembrado

Recorre tabla por tabla lo que dejaron v1…v4 y escribe la fila que falta en `demo_marcado`. **No borra, no toca llaves, no modifica una sola fila de producto.**

El brief proponía identificar lo sembrado por fecha (posterior al 31-08) y por `modeloUsado LIKE 'demo-seed%'`. Se hace por **prefijo de id**, que es más preciso: el prefijo *es* la prueba de que la fila la sembró un poblador — un `cuid()` real jamás empieza por `demo-`. La fecha es un proxy que arrastraría datos reales creados el mismo día, y `modeloUsado` solo alcanza a `ClasificacionIA`, no a colegios ni alumnos. **`modeloUsado LIKE 'demo-seed%'` se usa como contraste**: el reporte final compara ambos conteos y avisa si no cuadran.

Dry-run por defecto, `--motivo` obligatorio, `--confirm` para escribir.

### 5) `reset-piloto.ts --solo-sembrado`

Hoy `reset-piloto.ts` borra **todos** los colegios y **todos** los padres. La bandera nueva lo desvía al borrado por `demo_marcado`: mismo `--backup` y `--motivo` obligatorios, pero solo cae lo marcado. Sin la bandera, el comportamiento de hoy no cambia ni una línea.

---

## Candados

- **`idSchema` y `cuidIdSchema` no se tocan.** Si el sistema rechaza un dato sembrado, la siembra está mal. Un test-candado corre `cuidIdSchema` contra los ids viejos (`demo3-sol-…`) y los declara inválidos **a propósito** — el día que alguien ablande el validador para "arreglar" el comité, ese test se pone rojo.
- **Cero `id:` literales en el poblador.** El test lee `poblar-demo-v5.ts` y `_poblar-v5-casos.ts` y falla si aparece un `id:` en un payload de creación.
- **Se marca en la misma transacción que se crea.** No hay ventana en la que exista una fila sembrada sin marcar.
- **El borrado NO mira prefijos ni nombres.** Solo `demo_marcado.entidadId`. Un colegio real llamado «Colegio Demo» no corre peligro; un colegio sembrado con nombre inocente sí cae.
- **INTOCABLES heredados de v1** (`cmticor7l000kglr93d1ypox6` de Calidad, `soporte@innovadataco.com`) se verifican **antes de sembrar y antes de borrar**, y el borrado los excluye aunque estuvieran marcados por error.
- **Cero correos, cero pg-boss, cero Ollama.** `PreferenciaAlertaColegio.habilitado = false` para todos, `ClasificacionIA` insertada directa (R16: el jurado de 3 modelos no cabe en 36 GB).
- **Sin fechas futuras.** Se recorta a `ahora`, como ya hacía `fechasEscalonadas` de v3.
- **Este PR no ejecuta ningún borrado en producción.** Entrega la herramienta. El disparo lo hace el CEO cuando Jelkin lo autorice y Kimi libere los 9.000 reportes del ejercicio de BI.

---

## Fuera de alcance

- Migrar en vivo las llaves primarias de los 254 casos del comité y los 9.000 reportes. Hay llaves foráneas colgando; el camino del brief §4 es marcar → borrar → resembrar, y el borrado es de otro turno.
- El interruptor visible de datos de prueba en el Inicio del administrador (brief §3.2) y la separación CARGA/SALUD (§3.1). Son pantalla y consulta, no siembra; van en su propia spec y ahora sí tienen de dónde leer.
- Profesionales de la Red de Apoyo, citas y franjas.
- Un sistema de entornos, usuarios con permisos especiales o banderas por usuario (brief §6). Es un marcador por fila.

---

## Verificación

### Gate de código

- `npm run test:unit -- scripts/demo/demo-v5.test.ts` → **36 tests verdes**.
- `src/lib/specs-discipline.test.ts` → 8 verdes.
- `npx tsc --noEmit` y `eslint` limpios en todo lo tocado.

### Contra una base de datos de verdad

**Verde en CI ≠ funciona.** Se corrió el ciclo completo contra una base **propia de desarrollo** (`pi_spec412`, creada y destruida para esto — nunca producción, nunca la base de pruebas compartida), con migraciones y seed reales.

**Siembra** (4,9 s):

| | |
|---|---|
| 50 colegios · 300 profesores · 2.000 alumnos · **2.806 acudientes** | ✅ los volúmenes de BI |
| 4.200 reportes · 4.200 clasificaciones · 3.185 alertas · 9.335 transiciones · **635 solicitudes de comité** | ✅ |
| 60 padres con expediente · 110 suscripciones · 133 pagos (110 AUTORIZADO) · 4 planes creados | ✅ |
| **30.254 filas en `demo_marcado`** | ✅ el marcador, por fin, con contenido |

**Lo que cierra I-292** — el caso del comité **abre**, por el camino real del servicio, no por una consulta inventada:

```
obtenerDetalle(cmtm0yq700…) → ABRE
  solicitud: numero=SOL-E33C6E8C estado=PENDIENTE creadoEn=2025-12-24
  caso: alerta=cmtm0yq6c0… sujeto=ESTUDIANTE
  contraprueba · cuidIdSchema("demo3-sol-demo-al-r-00127-E") → RECHAZA (correcto)
```

- 635 de 635 solicitudes pasan `cuidIdSchema` **y** `idSchema`. Rechazadas: **0**.
- 635 de 635 `numero` con la forma real `SOL-` + 8 hex. Con otra forma: **0**.
- Reportes con id que empieza por `demo`: **0**.
- Filas sembradas sin marcar (reportes, colegios, alertas, pagos, suscripciones): **0**.

**Forma de los datos** — 15 categorías (las 14 de conducta + SPAM) · 20 países · 120 ciudades · 10 plataformas · 13 meses calendario cubiertos *(medido con la ventana de 12 meses; con los 36 vigentes el reparto cubre los tres años, comprobado en el test)* · **0 reportes con `paisId` nulo** · 1.076 identificadores con más de un reporte (reincidencia) · 672 reportes encadenados · asignación de alertas entre **13 % y 100 %** según el colegio (el semáforo tiene sus tres estados) · **0 suscripciones descuadradas** contra sus pagos autorizados.

**Borrado** — con un testigo REAL sin marcar sembrado a propósito, incluido *un colegio llamado «Colegio Demo de Verdad»* para probar que el borrado no se guía por el nombre:

- Reporte previo correcto: las 22 entidades con su conteo, y el aviso de qué NO se toca.
- Borradas las 30.254 filas marcadas + sus 30.254 marcas.
- **Testigos intactos: `Reporte real: 1 → 1`, `Colegio real: 1 → 1`.**

**Marcado retroactivo** — se recreó en pequeño la siembra vieja (ids `demo-t-99`, `demo-c-99`, `demo-r-000NN`, `demo-cl-…`):

- Inventario por prefijo: 12 filas en 4 entidades, con ejemplo de id por entidad.
- Contraste contra `modeloUsado LIKE 'demo-seed%'`: **los dos caminos ven lo mismo (5 y 5)**.
- Marcadas las 12, borradas después por el mismo borrador. Testigos reales intactos otra vez.

**Guardia de idempotencia** — re-correr el poblador sobre una corrida ya sembrada:

```
[poblar-v5] Error: La corrida "spec-412-v5" ya está sembrada. Borrala primero
con scripts/demo/borrar-demo-marcado.ts --motivo="..." --confirm.
No hay --force: borrar es un acto separado y explícito.
```

### Lo que esta spec NO cierra

Lo del brief §7 que ocurre **en producción**: que el Inicio del administrador muestre conteos distintos con el interruptor puesto y quitado, y que el guion de limpieza borre lo sembrado dejando intacto lo real **allá**. Esta spec entrega la herramienta; **este PR no ejecutó ningún borrado en producción**. El disparo lo hace el CEO cuando Jelkin lo autorice.
