module.exports = {
    apps: [
        {
            name: "dev-server",
            script: "npm",
            args: "run dev",
            cwd: __dirname,
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            env: {
                NODE_ENV: "development",
            },
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            combine_logs: true,
            error_file: "./logs/dev-server-error.log",
            out_file: "./logs/dev-server-out.log",
        },
        {
            name: "worker",
            script: "npx",
            args: "tsx scripts/worker.mjs",
            cwd: __dirname,
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            env: {
                NODE_ENV: "development",
            },
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            combine_logs: true,
            error_file: "./logs/worker-error.log",
            out_file: "./logs/worker-out.log",
        },
    ],
};