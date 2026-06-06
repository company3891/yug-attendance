import { describe, it, expect } from 'vitest'
import { extractLastName, resolveVoiceEnabled, isSpeechSupported } from './speech'

describe('extractLastName', () => {
  it('スペース区切りのフルネームから姓を返す', () => {
    expect(extractLastName('杉本 悠')).toBe('杉本')
  })

  it('全角スペース区切りでも正しく抽出する', () => {
    expect(extractLastName('田中　花子')).toBe('田中')
  })

  it('スペースがない場合は全体を返す', () => {
    expect(extractLastName('杉本')).toBe('杉本')
  })

  it('複数スペースでも先頭要素を返す', () => {
    expect(extractLastName('佐藤  太郎')).toBe('佐藤')
  })
})

describe('resolveVoiceEnabled', () => {
  it('ユーザー設定が true → true', () => {
    expect(resolveVoiceEnabled(true, false)).toBe(true)
  })

  it('ユーザー設定が false → false', () => {
    expect(resolveVoiceEnabled(false, true)).toBe(false)
  })

  it('ユーザー設定が null → 店舗設定を使用', () => {
    expect(resolveVoiceEnabled(null, false)).toBe(false)
    expect(resolveVoiceEnabled(null, true)).toBe(true)
  })

  it('ユーザー設定が undefined → 店舗設定を使用', () => {
    expect(resolveVoiceEnabled(undefined, false)).toBe(false)
    expect(resolveVoiceEnabled(undefined, true)).toBe(true)
  })

  it('ユーザー設定も店舗設定も null/undefined → デフォルト true', () => {
    expect(resolveVoiceEnabled(null, null)).toBe(true)
    expect(resolveVoiceEnabled(undefined, undefined)).toBe(true)
  })

  it('ユーザー設定が null、店舗設定が null → デフォルト true', () => {
    expect(resolveVoiceEnabled(null, undefined)).toBe(true)
  })
})

describe('isSpeechSupported', () => {
  it('Node.js 環境（window なし）では false を返す', () => {
    // vitest は jsdom を使っていない（Node.js 環境）ので false
    expect(isSpeechSupported()).toBe(false)
  })
})
