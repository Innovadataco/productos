# SPEC-466 · Plan

## Enfoque
El guard ya era `total > PISO` (falla solo si sube). El conflicto no era el guard sino que cada PR reescribía la constante. Arreglo: (1) documentar el `<=` como contrato + mensaje que prohíbe tocar el PISO al bajar; (2) modo `--tension` que aprieta el piso por barrido, no por PR.

## Candado
Merge git real (estilo 432): dos ramas bajan crudos sin tocar el PISO → limpio; contraprueba con ambas tocando el PISO → choca. Más la conducta del guard (verde ahora; rojo si sube).

## Fuera de alcance
- El job/cron que corre `--tension` periódicamente (infra); acá queda el modo listo para que lo invoque.
