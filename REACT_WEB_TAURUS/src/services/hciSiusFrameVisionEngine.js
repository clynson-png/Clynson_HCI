export async function analyzeSiusFrameVision(frame, modality = 'RIFLE') {
  const img = await loadImage(frame.imageUrl)

  const panel = locateSiusPanel(img)
  const scoreCrop = cropFromBox(img, panel.scoreBox)
  const targetCrop = cropFromBox(img, panel.targetBox)

  const direction = detectDirectionFromTarget(targetCrop, modality)

  return {
    timeSeconds: frame.timeSeconds,
    scoreCrop,
    targetCrop,
    direction,
    visionStatus: direction ? 'VISION_DIRECTION_OK' : 'VISION_DIRECTION_FAILED',
  }
}

function locateSiusPanel(img) {
  // Base inicial pelo layout real do vídeo:
  // monitor ocupa parte superior central do frame
  return {
    targetBox: {
      x: img.width * 0.18,
      y: img.height * 0.06,
      w: img.width * 0.42,
      h: img.height * 0.46,
    },
    scoreBox: {
      x: img.width * 0.70,
      y: img.height * 0.10,
      w: img.width * 0.22,
      h: img.height * 0.22,
    },
  }
}

function cropFromBox(img, box) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = box.w
  canvas.height = box.h

  ctx.drawImage(
    img,
    box.x,
    box.y,
    box.w,
    box.h,
    0,
    0,
    box.w,
    box.h
  )

  return canvas.toDataURL('image/png')
}

function detectDirectionFromTarget(targetCrop, modality) {
  // placeholder real: agora retorna null, não CENTER falso
  // próximo passo: OpenCV detectar ponto/seta verde
  return null
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}