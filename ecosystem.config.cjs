// PM2 設定 (WSL2 Ubuntu 用)
module.exports = {
  apps: [
    {
      name: 'yug-dev',
      cwd: '/home/yusugclaude/yug-attendance',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev --port 3000',
      interpreter: 'node',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      env: { NODE_ENV: 'development', TZ: 'Asia/Tokyo' },
      out_file: '/home/yusugclaude/yug-attendance/.pm2-out.log',
      error_file: '/home/yusugclaude/yug-attendance/.pm2-err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
