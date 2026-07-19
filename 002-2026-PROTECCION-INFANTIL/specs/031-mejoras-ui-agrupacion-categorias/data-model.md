# Modelo de datos — Spec 031

## Decisión: parámetro de sistema en lugar de tabla nueva

La definición de los 5 grupos de categorías se almacena en el modelo existente `ParametroSistema` bajo la clave `ui.grupos_categoria`. Esto evita una migración de schema, aprovecha el CRUD de parámetros ya disponible en `/dashboard/admin/configuracion` y permite editar nombre, orden y categorías asignadas sin nuevos endpoints.

## Parámetro

| Clave | Tipo | Categoría | Público | Descripción |
|-------|------|-----------|---------|-------------|
| `ui.grupos_categoria` | `JSON` | `SYSTEM` | `true` | Mapeo de las 12 categorías internas de `CategoriaConducta` en 5 grupos de presentación para el usuario final. |

## Formato JSON

```json
{
  "grupos": [
    {
      "clave": "contacto_sexual",
      "nombre": "Contacto sexual",
      "orden": 1,
      "categorias": ["SOLICITUD_MATERIAL", "COMPARTIMIENTO_SEXUAL", "SOLICITUD_ENCUENTRO"]
    },
    {
      "clave": "manipulacion_engano",
      "nombre": "Manipulación o engaño",
      "orden": 2,
      "categorias": ["OFRECIMIENTO_REGALOS", "CONTACTO_INSISTENTE", "SUPLANTACION_IDENTIDAD"]
    },
    {
      "clave": "amenazas_extorsion",
      "nombre": "Amenazas o extorsión",
      "orden": 3,
      "categorias": ["EXTORSION", "DIFUSION_NO_CONSENTIDA", "DOXING"]
    },
    {
      "clave": "contenido_falso_ia",
      "nombre": "Contenido falso (IA)",
      "orden": 4,
      "categorias": ["CONTENIDO_GENERADO_IA"]
    },
    {
      "clave": "otro",
      "nombre": "Otro",
      "orden": 5,
      "categorias": ["OTRO"]
    }
  ]
}
```

## Reglas

- `SPAM` no se incluye en ningún grupo; no se muestra al usuario final.
- Cada categoría interna debe pertenecer a exactamente un grupo.
- Si el parámetro no existe, está malformado o contiene un grupo vacío, el helper `src/lib/categoria-grupos.ts` cae a la definición hardcodeada (los 5 grupos de arriba).
- El orden determina el orden de aparición en listas y leyendas de gráficos.

## Helper

`src/lib/categoria-grupos.ts` expone:

- `obtenerGruposCategoria(client?)`: devuelve la definición leída de `ParametroSistema` o el fallback.
- `categoriaAGrupo(categoriaInterna)`: devuelve el grupo de una categoría interna.
- `agruparCategorias(items)`: agrega un array `{ categoria, total }` por grupo.
- `nombreGrupoCategoria(claveGrupo)`: nombre legible de un grupo por su clave.
- `nombreGrupoParaCategoria(categoriaInterna)`: nombre legible del grupo al que pertenece una categoría interna.

## Nota sobre enum interno

No se modifica el enum `CategoriaConducta` ni el pipeline de clasificación. El agrupamiento es solo una capa de presentación.
