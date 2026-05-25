import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Phase 進行に伴い、テストが付いた純関数を順次追加していく
      // （未テストファイルを include すると閾値が誤判定される）
      include: [
        'lib/workTime.ts',
        'lib/clockRounding.ts',
        'lib/clockLogic.ts',
        'lib/qr/**/*.ts',
        // 'lib/forms/parse.ts',     // テスト追加時に有効化
      ],
      exclude: ['lib/**/*.test.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
