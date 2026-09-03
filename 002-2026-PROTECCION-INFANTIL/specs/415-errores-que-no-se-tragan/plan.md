# Plan · SPEC-415 — Los errores que se tragaban a alguien

## De dónde sale

Barrido pedido por el CEO tras cerrar I-294 en SPEC-414. Se corrió sobre `src/`
(excluyendo `*.test.*`) buscando cuatro formas de tragar un error:

| Patrón | Bruto | Veredicto |
|---|---|---|
| `catch {}` (con o sin comentario) | 41 | 34 reales — 2 son de `test-setup.ts` y uno (`ComiteBandeja:141`) ya está arreglado desde SPEC-381 |
| `.catch(() => {})` | 4 | los 4 reales (catálogos → selector vacío) |
| `.catch(() => null \| undefined \| [])` | 93 | casi todos correctos: parseo de body/respuesta. Solo 1 real (`comite/integrantes:50`) |
| `Promise.allSettled` | 2 | uno es el de SPEC-414; el otro (`ConfigPanel:158`) está bien |

**El filtro que se aplicó** (criterio del CEO): se arregla lo que hace que una
persona tome una decisión equivocada. No se arregla lo que solo se ve feo.

## Por qué el candado ignora comentarios

Los archivos arreglados ahora **citan** el defecto para que se entienda por qué
estaban mal. Un candado que busque la frase en todo el archivo se dispararía con
la explicación. Ya pasó en SPEC-414 con `"DemoMarcado"`; acá se resolvió igual:
`leerCodigo()` quita comentarios antes de comparar.

## Por qué el candado NO es global

Un ratchet que prohibiera `catch {}` en todo `src/` pondría en rojo los grupos C
y D, que el CEO decidió aplazar. Adelantarse a esa decisión desde un test es
tomarla por él. El candado cubre exactamente los ocho sitios de este PR.

## Orden de trabajo

1. Grupo B (5 archivos, una línea cada uno).
2. Grupo A: integrantes del comité → informes del caso → badge.
3. Candado estático + test de comportamiento del badge.
4. **Contraprueba**: reintroducir un `catch {}` mudo y ver el candado morder.
