# Contracts — 089-presentacion-usuario

## GET /api/consulta?identificador=...

**Sin reportes aprobados**: `{ identificador, tieneReportes: false, mensaje }` (incluye el caso "solo spam/otro").

**Con reportes (anónimo)**:

```jsonc
{
  "identificador": "+57300…",
  "tieneReportes": true,
  "visibleEnDashboard": false,          // solo gobierna el LISTADO del dashboard
  "actividad": "baja",                  // "baja" | "alta" (visibility.actividad_alta_min)
  "totalReportes": 2,                   // = reportesAutenticados + reportesAnonimos
  "reportesAutenticados": 1,
  "reportesAnonimos": 1,
  "plataformas": [{ "id": "…", "nombre": "WhatsApp", "clave": "whatsapp", "total": 2, "otraPlataforma": null }],
  "resumenPlataformas": "2 reportes en WhatsApp",
  "categorias": [{ "categoria": "EXTORSION", "total": 1 }],   // multi, por gravedad, sin SPAM/OTRO
  "ubicaciones": [{ "pais": "Colombia", "total": 2 }],        // anónimo: rollup país
  "autenticado": false
}
```

**Adicional autenticado**: `primerReporte`, `ultimoReporte`, `timeline: [{mes,total}]`, `resumen`, y `ubicaciones: [{pais, departamento, ciudad, total, lat, lng}]`.

**Eliminado**: `nivelRiesgo`, `score` (nunca más en la superficie pública).

## GET /api/estadisticas-publicas

- Conteos (`totales.reportes`, `porPlataforma`, `porPais`, `porCiudad`, `porCategoria`) usan el predicado único.
- Eliminado: `porNivelRiesgo`.

## GET /api/reportes/seguimiento/[numero]

- `estadoVisual`: solo "En proceso" | "Procesado".
- `clasificacion.categoriasSecundarias: string[]` (nuevo en la respuesta).
- `actividad: "alta" | "baja" | null` (reemplaza a `ranking.score` + `ranking.nivelRiesgo`, eliminados).
- `ranking`: solo conteos (`totalReportes`, `reportesAutenticados`, `reportesAnonimos`).
