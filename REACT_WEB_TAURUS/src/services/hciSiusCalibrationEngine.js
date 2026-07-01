export async function calibrateSiusFrame(frame) {
  const img = await loadImage(frame.imageUrl)

  const boxes = getInitialSiusBoxes(img)

  return {
    timeSeconds: frame.timeSeconds,
    screenCrop: cropFromBox(img, boxes.screenBox),
    scoreCrop: cropFromBox(img, boxes.scoreBox),
    shotListCrop: cropFromBox(img, boxes.shotListBox),
    targetCrop: cropFromBox(img, boxes.targetBox),
    boxes,
  }
}

export async function calibrateSiusFrames(frames) {
  const sampleFrames = frames.filter((_, index) => index % 5 === 0)

  const calibrated = []

  for (const frame of sampleFrames) {
    calibrated.push(await calibrateSiusFrame(frame))
  }

  return calibrated
}

function getInitialSiusBoxes(img) {
  return {
    screenBox: {
      x: img.width * 0.08,
      y: img.height * 0.02,
      w: img.width * 0.84,
      h: img.height * 0.55,
    },

    targetBox: {
      x: img.width * 0.17,
      y: img.height * 0.06,
      w: img.width * 0.43,
      h: img.height * 0.42,
    },

    shotListBox: {
      x: img.width * 0.60,
      y: img.height * 0.05,
      w: img.width * 0.19,
      h: img.height * 0.43,
    },

    scoreBox: {
      x: img.width * 0.78,
      y: img.height * 0.30,
      w: img.width * 0.14,
      h: img.height * 0.16,
    },
  }
}

function cropFromBox(img, box) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = Math.round(box.w)
  canvas.height = Math.round(box.h)

  ctx.drawImage(
    img,
    box.x,
    box.y,
    box.w,
    box.h,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return canvas.toDataURL('image/png')
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}