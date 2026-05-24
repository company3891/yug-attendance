// PM2 設定: YUG Attendance dev サーバーを常駐化
// 使い方:
//   pm2 start ecosystem.config.cjs       起動
//   pm2 reload yug-dev                   再起動 (ホットリロード)
//   pm2 logs yug-dev                     ログ追跡
//   pm2 stop yug-dev                     停止
//   pm2 save                             現在の設定を永続保存（Windows起動時の自動復旧用）

module.exports = {
  apps: [
    {
      name: 'yug-dev',
      cwd: 'C:/Users/yusug/Dropbox (個人用) (1)/02 株式会社YUG/yug-attendance',
      // npm.cmd は Windows batch のため PM2 と相性が悪い。
      // Next.js の CLI を node から直接起動する。
      script: 'node_modules/next/dist/bin/next',
      args: 'dev --port 3000',
      interpreter: 'node',
      // 終了時の自動再起動条件
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // 環境変数（.env.local も Next.js が自動読み込みするので追加指定は不要）
      env: {
        NODE_ENV: 'development',
      },
      // ログ出力先（既定: ~/.pm2/logs/）
      out_file: 'C:/Users/yusug/Dropbox (個人用) (1)/02 株式会社YUG/yug-attendance/.pm2-out.log',
      error_file: 'C:/Users/yusug/Dropbox (個人用) (1)/02 株式会社YUG/yug-attendance/.pm2-err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
