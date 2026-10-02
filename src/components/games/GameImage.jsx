import { useEffect, useState } from 'react'
import { loadGameImage } from '../../services/gameService'
import { API_BASE_URL } from '../../config/api'

function isExternalImage(src) {
  if (!/^https?:\/\//i.test(src || '')) return false
  try {
    return new URL(src).origin !== new URL(API_BASE_URL).origin
  } catch {
    return true
  }
}

export function GameImage({ src, alt, className, fallback = null, ...props }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const isExternal = isExternalImage(src)

  useEffect(() => {
    if (!src || isExternal) return undefined

    let cancelled = false
    let objectUrl
    loadGameImage(src)
      .then(image => {
        objectUrl = URL.createObjectURL(image)
        if (cancelled) URL.revokeObjectURL(objectUrl)
        else setBlobUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, isExternal])

  if (failed) return fallback
  const imageSource = isExternal ? src : blobUrl
  if (!imageSource) return fallback

  return <img className={className} src={imageSource} alt={alt} loading="lazy" {...props} />
}
