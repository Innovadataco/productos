# Quickstart — Centro de Control de Consumo de Tokens

```bash
cd 000-2026-MODELOS
bin/modelos            # → abre http://127.0.0.1:8899 en el navegador
```

## Lectura del panel en 30 segundos
1. **Píldora de estado** (arriba a la derecha): NOMINAL / N AVISOS / N CRÍTICAS.
2. **KPI row**: tokens del rango, % caché (alto = barato), sesiones activas, peso comparativo.
3. **Alertas y qué hacer**: cada alerta trae la acción — ejecútala tú (el panel nunca actúa).
4. **Tabla**: el medidor de contexto por sesión es el aviso temprano —
   `· <50%` → bien · `⚠ ≥50%` → atento · `▲ ≥75%` → `/compact` · `⛔ ≥90%` → cierra y abre nueva.
5. **Comparador**: marca 2-3 sesiones en la columna CMP para enfrentarlas.

## Reglas de oro del consumo (las que el panel vigila)
- Una sesión por lote de trabajo — nunca una sesión eterna.
- `/compact` al pasar de ~150k de contexto.
- El contexto vive en los archivos del repo (Regla 4), cerrar un chat no pierde nada.

## Pruebas
```bash
python3 -m unittest discover -s tests   # 14 pruebas, sin red, sin datos reales
```
