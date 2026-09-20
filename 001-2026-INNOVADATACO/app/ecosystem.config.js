module.exports = {
  apps: [
    {
      name: "idc-admin",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "development",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      combine_logs: true,
      error_file: "./logs/idc-admin-error.log",
      out_file: "./logs/idc-admin-out.log",
    },
  ],
};
