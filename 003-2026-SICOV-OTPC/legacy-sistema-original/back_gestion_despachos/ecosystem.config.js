module.exports = {
  apps: [
    {
      name: 'back_gestion_despachos',
      script: 'build/server.js', // o build/server.js
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
