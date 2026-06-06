import { describe, it, expect } from 'vitest'
import {
  compareFaceDescriptors,
  parseStoredDescriptors,
  descriptorToArray,
  FACE_MATCH_THRESHOLD,
} from './faceAuth'

/** テスト用の128次元ゼロベクトル生成 */
function zeroVec(dim = 128): number[] {
  return new Array<number>(dim).fill(0)
}

/** テスト用の単位ベクトル（index=0 のみ 1） */
function unitVec(dim = 128): number[] {
  const v = new Array<number>(dim).fill(0)
  v[0] = 1
  return v
}

describe('compareFaceDescriptors', () => {
  it('同じベクトルは distance=0 でマッチする', () => {
    const v = new Float32Array(zeroVec())
    const result = compareFaceDescriptors(v, [zeroVec()])
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(0, 5)
  })

  it('distance が閾値以下ならマッチする', () => {
    const zero = new Float32Array(zeroVec())
    // distance が 0 → 閾値 0.6 以下なのでマッチ
    const result = compareFaceDescriptors(zero, [zeroVec()], 0.6)
    expect(result).not.toBeNull()
  })

  it('distance が閾値を超えたら null を返す', () => {
    // ユークリッド距離 = sqrt(sum((v1[i]-v2[i])^2))
    // zeroVec と unitVec の距離 = sqrt(1) = 1.0 > 0.6
    const zero = new Float32Array(zeroVec())
    const result = compareFaceDescriptors(zero, [unitVec()], 0.6)
    expect(result).toBeNull()
  })

  it('複数の登録ベクトルのうち一番近いものを使う', () => {
    const target = new Float32Array(zeroVec())
    const closeVec = zeroVec()
    closeVec[0] = 0.1  // distance ≈ 0.1
    const farVec = unitVec()   // distance = 1.0

    const result = compareFaceDescriptors(target, [farVec, closeVec], 0.6)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(0.1, 4)
  })

  it('登録ベクトルが空配列なら null を返す', () => {
    const v = new Float32Array(zeroVec())
    const result = compareFaceDescriptors(v, [])
    expect(result).toBeNull()
  })

  it('カスタム閾値 0.4 → distance=0.45 でマッチしない', () => {
    const v1 = new Float32Array(zeroVec())
    const v2 = zeroVec()
    v2[0] = 0.45  // distance ≈ 0.45
    const result = compareFaceDescriptors(v1, [v2], 0.4)
    expect(result).toBeNull()
  })

  it('デフォルト閾値は FACE_MATCH_THRESHOLD と一致する', () => {
    // distance=0 < FACE_MATCH_THRESHOLD なのでマッチする
    const v = new Float32Array(zeroVec())
    const result = compareFaceDescriptors(v, [zeroVec()])
    expect(result).not.toBeNull()
    expect(FACE_MATCH_THRESHOLD).toBe(0.6)
  })
})

describe('parseStoredDescriptors', () => {
  it('正常なネスト配列を返す', () => {
    const input = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    expect(parseStoredDescriptors(input)).toEqual(input)
  })

  it('null → 空配列', () => {
    expect(parseStoredDescriptors(null)).toEqual([])
  })

  it('undefined → 空配列', () => {
    expect(parseStoredDescriptors(undefined)).toEqual([])
  })

  it('配列でない値 → 空配列', () => {
    expect(parseStoredDescriptors('string')).toEqual([])
    expect(parseStoredDescriptors(42)).toEqual([])
    expect(parseStoredDescriptors({})).toEqual([])
  })

  it('非数値が含まれる内側配列はフィルタリングされる', () => {
    const input = [[1, 2, 3], ['a', 'b', 'c'], [4, 5, 6]]
    const result = parseStoredDescriptors(input)
    expect(result).toEqual([[1, 2, 3], [4, 5, 6]])
  })
})

describe('descriptorToArray', () => {
  it('Float32Array → number[] に変換する', () => {
    const f = new Float32Array([0.1, 0.2, 0.3])
    const result = descriptorToArray(f)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
    expect(result[0]).toBeCloseTo(0.1, 4)
  })

  it('128次元のベクトルを変換できる', () => {
    const f = new Float32Array(128).fill(0.5)
    const result = descriptorToArray(f)
    expect(result).toHaveLength(128)
    expect(result.every((v) => Math.abs(v - 0.5) < 0.001)).toBe(true)
  })
})
