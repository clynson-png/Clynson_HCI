import { detectSiusShotCandidates } from './hciSiusShotDetectionEngine'

export async function ingestSiusVideo(file) {
  if (!file) {
    throw new Error('No video selected')
  }

  const videoUrl = URL.createObjectURL(file)

  const metadata = await loadVideoMetadata(videoUrl, file)
  const frames = await extractVideoFrames(videoUrl, metadata.durationSeconds)
  const shotCandidates = detectSiusShotCandidates(frames)

  console.log('shotCandidates', shotCandidates)
  console.log('shotCandidateCount', shotCandidates.length)

  return {
    ...metadata,
    frames,
    frameCount: frames.length,
    shotCandidates,
    shotCandidateCount: shotCandidates.length,
    status: 'SHOT_CANDIDATES_READY',
  }
}

function loadVideoMetadata(videoUrl, file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')

    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      resolve({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        durationSeconds: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        previewUrl: videoUrl,
      })
    }

    video.src = videoUrl
  })
}

async function extractVideoFrames(videoUrl, durationSeconds) {
  const captureTimes = buildCaptureTimes(durationSeconds)

  console.log('captureTimes', captureTimes)

  const frames = []

  for (const time of captureTimes) {
    const frame = await captureFrameAt(videoUrl, time)

    frames.push({
      timeSeconds: time,
      imageUrl: frame,
      status: 'FRAME_CAPTURED',
    })
  }

  return frames
}

function buildCaptureTimes(durationSeconds) {
  console.log('DYNAMIC buildCaptureTimes duration:', durationSeconds)

  const times = []
  const intervalSeconds = 3

  for (let time = 1; time < durationSeconds; time += intervalSeconds) {
    times.push(Math.round(time))
  }

  console.log('DYNAMIC times count:', times.length)
  console.log('DYNAMIC times:', times)

  return times
}

function captureFrameAt(videoUrl, timeSeconds) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(timeSeconds, video.duration)
    }

    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }

    video.src = videoUrl
  })
}