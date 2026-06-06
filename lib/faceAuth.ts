/**
 * face-api.js を使った顔認証ユーティリティ。
 *
 * モデルパス: /models/（public/models/ 配下）
 * 使用モデル:
 *   - tiny_face_detector: 軽量・高速な顔検出（リアルタイム向け）
 *   - face_landmark_68_tiny: ランドマーク検出（認識パイプラインに必要）
 *   - face_recognition: 128次元特徴ベクトル生成
 */

import * as faceapi from 'face-api.js'

export const FACE_MATCH_THRESHOLD = 0.6  // face-api.js デフォルト
export const REQUIRED_DESCRIPTORS = 3    // 登録時に撮影する枚数
export const MAX_FAIL_COUNT = 3          // 連続失敗 → QRフォールバック

let modelsLoaded = false

/** モデルを /models/ から読み込む（一度だけ実行） */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return

  const MODEL_URL = '/models'
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

/** モデルが読み込み済みかどうか */
export function areFaceModelsLoaded(): boolean {
  return modelsLoaded
}

/** TinyFaceDetector のオプション（認識用: 精度重視） */
export const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
})

/** TinyFaceDetector のオプション（登録用: 精度最大） */
export const detectorOptionsForRegistration = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.6,
})

/**
 * 画像（HTMLVideoElement / HTMLImageElement / HTMLCanvasElement）から
 * 128次元特徴ベクトルを抽出する。
 *
 * @returns Float32Array(128) または null（顔が検出できなかった場合）
 */
export async function extractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  options?: faceapi.TinyFaceDetectorOptions,
): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(input, options ?? detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptor()

  return detection?.descriptor ?? null
}

/**
 * 登録済み特徴ベクトル群と入力ベクトルを比較し、同一人物か判定する。
 *
 * @param input           認証時に抽出したベクトル
 * @param registeredArrays DBから取得したベクトル群（1〜3枚分）
 * @param threshold       判定閾値（デフォルト: FACE_MATCH_THRESHOLD）
 * @returns マッチした場合は distance（0〜1）、不一致なら null
 */
export function compareFaceDescriptors(
  input: Float32Array,
  registeredArrays: number[][],
  threshold: number = FACE_MATCH_THRESHOLD,
): number | null {
  let minDistance = Infinity

  for (const registered of registeredArrays) {
    const registeredFloat32 = new Float32Array(registered)
    const distance = faceapi.euclideanDistance(input, registeredFloat32)
    if (distance < minDistance) minDistance = distance
  }

  if (minDistance <= threshold) return minDistance
  return null
}

/**
 * DB から取得した face_descriptors（JSON配列）を number[][] に変換する。
 * face_descriptors カラムの構造: [[f1,...f128], [f1,...f128], ...]
 */
export function parseStoredDescriptors(json: unknown): number[][] {
  if (!Array.isArray(json)) return []
  return json.filter(
    (item): item is number[] => Array.isArray(item) && item.every((v) => typeof v === 'number'),
  )
}

/**
 * Float32Array を通常の number[] に変換（DB保存用）
 */
export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor)
}
