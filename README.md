# productos

Repositorio oficial de la Fabrica de Software de InnovaDataCO.

## Proposito

Aqui vive el codigo fuente, la arquitectura y la documentacion tecnica de los productos desarrollados por InnovaDataCO.

## Estructura

```
productos/
├── README.md
├── AGENTS.md
├── fabrica-de-software/
│   ├── producto-001/
│   ├── producto-002/
│   └── librerias-comunes/
└── documentacion-tecnica/
```

## Reglas de gobierno

1. Todo codigo pasa por PR y revision.
2. Sin ACTA-VALIDACION no hay merge.
3. No subir secrets, API keys ni datos sensibles.
4. Documentar cambios de arquitectura.

<!-- SPEC-300 test acid SC-001: PR README-only para verificar que pi-gate y bi-gate aparecen como checks y reportan verde trivial en un PR que no toca paths de ningún producto. Post-verify, línea removible. -->
