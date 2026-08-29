/** Opciones de grado escolar para los formularios de curso (1 a 11). */
export const GRADO_OPTIONS = [
    { value: "", label: "Selecciona grado (opcional)" },
    ...Array.from({ length: 11 }, (_, i) => {
        const grado = String(i + 1);
        return { value: grado, label: `Grado ${grado}` };
    }),
];
