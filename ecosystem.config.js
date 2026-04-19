module.exports = {
  apps: [
    {
      name: 'warface-bot',
      script: './bot.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_file: './logs/combined.log',
      // Limitar logs
      log_max_files: 5,
      max_log_size: '10M',
      // Reiniciar se ficar sem memória
      max_restarts: 10,
      min_uptime: '10s',
      // Arguments
      args: [],
    },
  ],
};
