# Quickstart — Spec 090: Rúbrica multi-etiqueta + multi-modelo

## A. Motor en el pipeline real

1. Reportar un texto con conducta clara (p. ej. ofrecimiento de regalos a un menor).
2. En BD: `SELECT modelo, categoria, cumple FROM clasificacion_rubrica_votos v JOIN "ClasificacionIA" c ON c.id = v."clasificacionIAId" WHERE c."reporteId" = '<id>';` → matriz 0/1 por modelo persistida, con `preguntasJson` (preguntas cumplidas).
3. La `ClasificacionIA.categoria` = principal (mayor gravedad entre las que superan el umbral); `confianza` = % de la principal.

## B. Configuración (tab Rúbrica)

1. `/dashboard/admin/ia?tab=rubrica` como ADMIN: selector de categoría → ver/editar/agregar/desactivar preguntas → "Guardar set".
2. Sección Configuración: modelos (coma), umbral de presencia, temperatura, modelo embudo → "Guardar configuración". Próxima clasificación usa los nuevos valores sin redeploy.
3. `ia.rubrica.enabled = false` (Configuración → parámetros) vuelve al motor legacy.

## C. Detalle privado "Mis reportes"

1. Como PARENT, `/dashboard` → "Ver detalle" en un reporte propio: tabla categoría × modelo (✓/—), columna % y tarjeta "Análisis" (plantilla determinista).
2. Con otro PARENT: `GET /api/reportes/mis-reportes/[id]` del primero → 403.

## D. Validación contra el banco (US4)

```bash
npx tsx scripts/eval-rubrica-banco.ts 200   # ~3 h secuencial; escribe scripts/simulacion/resultados-rubrica-090.json
```
Comparar con `metricasJson` de las runs de la 085 (motor anterior, 5 votos del mismo modelo).

## E. Gate

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```
