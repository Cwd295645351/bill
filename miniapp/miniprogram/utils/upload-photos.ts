import { uploadTransactionImage } from '../apis/index'

export interface PendingPhoto {
  path: string
  serverId?: string
}

/**
 * 按顺序上传本地照片，期间用 loading 提示进度。
 * 失败时回写已成功的 serverId，便于重试只补传失败的。
 * @returns 全部成功时的 id 列表；失败返回 null
 */
export async function uploadPendingPhotos(
  billId: string,
  photos: PendingPhoto[],
  onPartialIds?: (ids: Array<string | undefined>) => void
): Promise<string[] | null> {
  const list = Array.isArray(photos) ? photos : []
  if (!list.length) return []

  const serverIds: Array<string | undefined> = list.map((p) => p.serverId || undefined)
  const needUpload = list.filter((_, i) => !serverIds[i]).length
  let uploaded = 0

  for (let i = 0; i < list.length; i++) {
    if (serverIds[i]) continue
    uploaded += 1
    wx.showLoading({
      title: needUpload > 1 ? `上传中 ${uploaded}/${needUpload}` : '上传中',
      mask: true
    })
    const up = await uploadTransactionImage(billId, list[i].path)
    if (up.retCode !== 0 || !(up.data && up.data.id)) {
      if (onPartialIds) onPartialIds(serverIds)
      wx.hideLoading()
      return null
    }
    serverIds[i] = up.data.id
  }

  if (onPartialIds) onPartialIds(serverIds)
  return serverIds as string[]
}

/** 保存记账时的 loading，结束后务必 hide */
export function showSaveLoading(title = '保存中') {
  wx.showLoading({ title, mask: true })
}

export function hideSaveLoading() {
  wx.hideLoading()
}
