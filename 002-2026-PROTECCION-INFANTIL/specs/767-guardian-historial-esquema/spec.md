# SPEC-767 · Guardián de HISTORIAL ≠ ESQUEMA

**Status**: DESARROLLO

**Origen:** forense del drift de `Plan` (SPEC-766): prod tenía `creadoEn` (huérfano de init) + `precio NOT NULL` que el esquema no declara, y `createdAt` llegó **fuera del historial de migraciones**. La causa raíz no es una columna: es que **el historial de migraciones y el esquema declarado divergieron** y **ningún guardián lo veía**. **Carril:** Dev 1 (guardián) · Datos (dueño del clasificador y de 766). **Radicado:** ACCIÓN del CEO. **Base:** `main`; depende de **#760** (clasificador) y **#766** (born-green).

## Lo medido

- `migrate diff --from-schema-datamodel --to-migrations` (contra shadow limpio) mide si **el historial CONSTRUYE el esquema declarado**. Verificado: sale el punto ciego SISTEMÁTICO de Prisma (145 `SET DATA TYPE TIMESTAMPTZ`, 8 `CREATE` de índice crudo) + el drift REAL (bloque `Plan`).
- El clasificador de Datos (`src/lib/monitoreo/drift-clasificador.ts`, #760) ya distingue benigno vs drift **por CLÁUSULA** (`esAlterColumnaBenigno` parte el `ALTER TABLE` y exige que TODAS las cláusulas sean benignas). Verificado: el bloque `Plan` cae en `drift` **aunque** trae una cláusula benigna (`updatedAt SET DEFAULT CURRENT_TIMESTAMP`) mezclada con `ADD COLUMN creadoEn` + `precio SET NOT NULL` — el filtro por cláusula no lo tapa.

## El arreglo

- **Guardián** (`scripts/verify-historial-esquema.ts`): corre `migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --shadow-database-url $SHADOW --script`, parte con `partirStatements` y clasifica con `clasificarDrift` (**la FUENTE ÚNICA de Datos, importada — cero copia**). Si `drift` no está vacío → sale ≠0 con las sentencias ofensoras.
- **Dirección importa** (refinamiento verificado): `--from-schema-datamodel --to-migrations` (migraciones = target) para que los puntos ciegos salgan como `SET DATA TYPE TIMESTAMPTZ` y `CREATE` de índice crudo — que el clasificador SÍ matchea. La dirección inversa los emite como `SET TIMESTAMP(3)`/`DROP INDEX`, que el clasificador (dependiente de dirección) NO matchea → falso drift entero.
- **Baseline de los 8 renombres de índice:** el clasificador ya los pasa como benignos (`rename-indice`, genérico). Se documentan acá con razón (skew de nombre Prisma↔migración, mismas columnas) para que consten; no se «arreglan» (un guardián que grita cosméticos se apaga).

## Requisitos funcionales (FR)

- **FR-1:** el guardián falla (exit ≠0) si el historial de migraciones no construye el esquema declarado, EXCLUYENDO las clases de punto ciego de Prisma vía el clasificador compartido de #760. Reusa `clasificarDrift`/`partirStatements`; **no** reimplementa el criterio.
- **FR-2:** usa la dirección `--from-schema-datamodel --to-migrations` (verificada) contra un shadow limpio.
- **FR-3 (control positivo):** agregar un campo al esquema SIN migración que lo cree → el guardián lo detecta como drift (columna faltante); quitar/plantar una migración que no reconcilie → detectado.
- **FR-4:** nace ROJO hoy (drift de `Plan`); VERDE cuando entre #766. Gate DURO solo tras confirmar born-green post-766.

## Criterios de éxito (SC)

- **SC-1:** un historial que no construye el esquema declarado → CI roja (una vez que sea gate duro).
- **SC-2:** cero falsos positivos por el punto ciego de Prisma (timestamptz, defaults benignos, índices crudos, extensiones, renombres, tablas de arnés) — todos vía el clasificador compartido.
- **SC-3:** el guardián no duplica el criterio de Datos: importa `drift-clasificador.ts`. Si falta una clase, se amplía AHÍ (vía CEO), no en una copia.

## Escenarios de aceptación (control positivo)

- **A-1:** con el drift de `Plan` presente (pre-766) → `drift` = [bloque Plan] → exit ≠0.
- **A-2 (post-766):** sin el drift de `Plan` → `drift` = [] → exit 0 (born-green).
- **A-3 (mutación):** agregar `campoFantasma String` a un modelo sin migración → `drift` contiene su `ADD COLUMN` → exit ≠0.

## Impacto en arquitectura

**Impacto en arquitectura:** un tercer guardián de drift, DISTINTO de los otros dos y complementario — ninguno ve lo del otro (por eso el drift de `Plan` vivió meses invisible): **#760** compara *esquema vs BD viva de prod* (drift de DATO); **I-420** (`no-drift-destructivo-migracion.ts`) escanea *archivos de migración* por patrones destructivos (estático); **767** compara *migraciones vs esquema declarado* (drift de HISTORIAL, dinámico via shadow). Sin esquema de datos nuevo, sin ruta, sin cambio de producto: es un script de CI + su cableado. Reusa la FUENTE ÚNICA de clasificación de #760 (una fuente, tres consumidores: su CLI, su probe, este guardián).

## Fuera

- El arreglo del drift de `Plan` (**SPEC-766**, Datos). · El cierre del carril off-migración por rol de BD sin DDL (**SPEC-769**, Datos+CEO). · El clasificador en sí (fuente de #760 — si falta una clase se amplía ahí, no acá). · No se «arreglan» los 8 renombres de índice (cosméticos, baseline documentado).
