# SPEC-932 · Gestión de identificadores: UN componente para los 4 sujetos del colegio

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-932-identificadores-patron-unico` desde `origin/main` (e483cfab). Pedido de Jelkin.
**FORMA:** Gestión `f700b2c2` → `FORMA-SPEC931-GESTION-IDENTIFICADORES-POR-ROL-2026-11-19.md` §1, §2, §5, §6.
La entrada «Estudiantes» del menú y el hub/listado (§3/§4) son SPEC-931 (Dev 1): no se tocan acá.

## Cambio

- **Componente único** `src/components/modules/colegio/identificadores/IdentificadoresParaAlertas.tsx` (canon =
  Profesor): «Identificadores para alertas» + línea explicativa (§1) + «Nuevo identificador»; tabla
  Valor·Tipo·Plataforma·Estado·Acciones; modal Valor+Plataforma; Editar + Activar/Desactivar; Tipo inferido por el
  backend. Lo propio de cada sujeto va en un ADAPTADOR (`api`: endpoints + body). «Relación» = extensión opt-in del
  estudiante. Variante `anidado` para el acudiente (bajo su sub-tarjeta).
- **Comité MIGRA entero**: form inline + `<ul>` «Vigilados» → componente (gana Plataforma + Editar). Conserva ruta,
  título y el éxito «Identificador agregado. Desde ahora la cuenta se vigila.».
- **Estudiante gana Editar** (PATCH `/api/colegio/identificadores/[id]`, ya existía) y conserva «Relación».
- **Profesor y acudiente**: misma conducta, ahora por el componente (el candado SPEC-874 de plataformas sigue verde).

- **Cabecera de `/dashboard/colegio/alertas`** (sumado por el CEO): decía «estudiante, profesor o acudiente» y
  omitía al integrante del comité, que SÍ alerta desde SPEC-380 → «estudiante, profesor, acudiente o integrante del
  comité». Texto final lo certifica Diseño.

## Backend

- `PATCH /api/colegio/comite/integrantes/[id]/identificadores/[identificadorId]` acepta `{ estado }` (como antes)
  **o** `{ valor, plataformaId? }` (edición). Pertenencia: `colegioId` de la sesión **y** `integranteId` de la ruta
  (`repo.actualizar` filtra por los dos). Plataforma validada (404), duplicado → 409, tipo re-inferido. Audit
  `COLEGIO_IDENTIFICADOR_EDITADO` (valor del enum existente; sin migración).
- `POST` del comité: valida `plataformaId` (antes un id inexistente reventaba la FK como 500).

## Desvíos / hallazgos (no los pidió la FORMA)

- **Warn-override (SPEC-320) que se celebraba como guardado:** los endpoints de profesor/estudiante/acudiente
  responden **200 con `aviso`** (sin guardar) cuando el valor ya es de otra persona del colegio. Las 3 pantallas
  viejas trataban `res.ok` como éxito → mostraban «Identificador agregado» **sin haber guardado**. El componente
  muestra el aviso (ámbar) y «Guardar de todos modos» (reenvía con `confirmarCompartido`).
- **«Ninguna / General» al editar ahora LIMPIA la plataforma** (envía `plataformaId: null`); antes la edición la
  omitía y no se podía quitar. En el alta se omite (los esquemas de alta no aceptan `null`).
- Al guardar, los padres recargan SOLO los identificadores (sin skeleton) para no desmontar el componente y perder
  su mensaje de éxito.
- Fuera de alcance (igual que antes): los listados devuelven solo ACTIVOS, así que un identificador desactivado
  desaparece de la tabla (el botón «Activar» del canon no se ve en la práctica). No se cambió.

## Copy (I-429)

El motor compara solo el VALOR: la línea dice «estos valores», nunca «esta cuenta en esta plataforma». La plataforma
es etiqueta organizativa.

## Candados

- `src/app/dashboard/colegio/identificadores-patron-unico.candado.test.ts`: (1) cada una de las 4 raíces alcanza
  el componente por SU árbol de render (BFS de imports locales que sigue `export … from`; cada raíz excluye a las
  otras — el estudiante no lo hereda vía `SeccionAcudientes`); (2) mutación POR RAÍZ (sin su import → no lo
  alcanza); (3) el modal «Editar identificador» vive en UN solo archivo; (4) control positivo del walker con barrel.
- `IdentificadoresParaAlertas.test.tsx`: tabla canon, Relación opt-in, Editar, warn-override, Desactivar, copy I-429.
- `IdentificadoresIntegranteClient.test.tsx`: el comité muestra Plataforma + Editar; PATCH `{valor, plataformaId}`.
- `…/[identificadorId]/route.test.ts` (integración): edición, plataforma 404, duplicado 409, pertenencia por
  integrante y por colegio (404, no edita), estado sigue, body vacío/mixto 400.

## Certificación

Diseño certifica el render. Deploy en lote (lo corre el CEO).
