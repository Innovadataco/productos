import nextConfig from "eslint-config-next";

const config = [
    ...nextConfig,
    {
        name: "proteccion-infantil/ignores",
        ignores: ["design/**"],
    },
    {
        name: "proteccion-infantil/rules",
        rules: {
            // Esta regla es experimental y demasiado estricta para efectos de carga de datos comunes.
            "react-hooks/set-state-in-effect": "off",
        },
    },
];

export default config;
