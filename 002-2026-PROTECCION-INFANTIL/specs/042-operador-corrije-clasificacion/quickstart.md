# Quickstart — Spec 042: Operador corrige la clasificación

## 1. Pre-requisitos

- Tener un usuario con rol `OPERADOR` activo y con cupo disponible.
- Tener un reporte en estado `REVISION_MANUAL` o `CLASIFICADO` asignado a ese operador.
- El asignador automático (`lib/operadores/asignador.ts`) asigna reportes `REVISION_MANUAL` a operadores activos; alternativamente, un admin puede reasignar manualmente vía `/api/admin/reportes-revision/${id}/reasignar`.

## 2. Iniciar sesión como operador

1. Ir a `/login`.
2. Iniciar sesión con el email y contraseña del operador.
3. El sistema redirige a `/dashboard/admin` (bandeja del operador).

## 3. Verificar bandeja del operador

1. En `/dashboard/admin`, la tabla debe mostrar solo los reportes asignados al operador (`operadorId = user.id`).
2. Buscar el reporte objetivo por número `RPT-XXXX` o identificador/nick.
3. Hacer clic en "Ver detalle".

## 4. Corregir la clasificación

1. En el detalle, sección "Clasificación IA", debe aparecer:
   - Categoría actual sugerida por la IA.
   - Select "Seleccionar categoría".
   - Campo de texto "Motivo de la corrección (opcional)".
   - Botón "Corregir clasificación".
2. Seleccionar una categoría diferente.
3. Opcionalmente ingresar motivo.
4. Hacer clic en "Corregir clasificación".
5. Esperar mensaje "Clasificación corregida correctamente.".

## 5. Verificar resultado

### 5.1 Estado del reporte

```bash
curl -s http://localhost:5005/api/admin/reportes-revision/<id> \
  -H "Cookie: token=<token-operador>" | jq '.reporte.estado'
```

Expected: `"CORREGIDO"`.

### 5.2 Corrección registrada

```bash
curl -s http://localhost:5005/api/admin/reportes-revision/<id> \
  -H "Cookie: token=<token-operador>" | jq '.reporte.clasificacion.correccion'
```

Expected: objeto con `categoriaOriginal`, `categoriaCorregida`, `motivo`, `creadoEn`.

### 5.3 Transición con responsable OPERADOR

```bash
curl -s http://localhost:5005/api/admin/reportes/<id>/transiciones \
  -H "Cookie: token=<token-operador>" | jq '.transiciones[] | select(.estadoNuevo == "CORREGIDO")'
```

Expected: transición con `responsableTipo = "OPERADOR"`, `responsableId` igual al ID del operador, `estadoNuevo = "CORREGIDO"`.

### 5.4 Dataset de entrenamiento

```sql
SELECT "clasificacionCorrecta", "fuente", "textoAnonimizado"
FROM "DatasetEntrenamiento"
WHERE "fuente" = 'correccion_admin'
ORDER BY "creadoEn" DESC
LIMIT 1;
```

Expected: `clasificacionCorrecta` igual a la categoría corregida; `fuente = 'correccion_admin'`.

## 6. Casos de prueba adicionales

| Caso | Pasos | Resultado esperado |
|------|-------|--------------------|
| Operador no asignado | Iniciar con otro operador e intentar corregir | 403 "No tienes permiso para gestionar este caso" |
| Corrección duplicada | Intentar corregir un reporte ya corregido | 409 "Este reporte ya fue confirmado o corregido" |
| Reporte dado de baja | Intentar corregir un reporte eliminado | 409 (según endpoint actual) o 403 |
| Categoría inválida | Enviar categoría fuera del enum | 400 "Datos inválidos" |

## 7. Tests automáticos

```bash
npx jest src/app/api/admin/correcciones --runInBand
```

Expected: todos los tests existentes más los nuevos de flujo pasan.

## 8. Build y deploy

```bash
npx tsc --noEmit
npm run lint
npm run test
rm -rf .next
npm run build
./scripts/dev-restart.sh
```

Expected: build OK, healthcheck OK, un solo worker.

---

## Checklist

- [ ] Operador puede iniciar sesión y ver su bandeja.
- [ ] Operador puede abrir un reporte asignado corregible.
- [ ] Operador puede seleccionar nueva categoría y corregir.
- [ ] Reporte queda en estado `CORREGIDO`.
- [ ] Se crea `CorreccionAdmin` con categorías correctas.
- [ ] Se registra `TransicionReporte` con `responsableTipo = OPERADOR`.
- [ ] Se crea `DatasetEntrenamiento` con la categoría corregida.
- [ ] Tests pasan.
- [ ] Build y deploy limpios.
