export function detectSiusShotCandidates(frames) {
  if (!frames || frames.length === 0) {
    return []
  }

  const candidates = []

  for (let index = 1; index < frames.length; index += 1) {
    const previousFrame = frames[index - 1]
    const currentFrame = frames[index]

    candidates.push({
      candidateId: `SHOT_CANDIDATE_${index}`,
      previousTimeSeconds: previousFrame.timeSeconds,
      timeSeconds: currentFrame.timeSeconds,
      status: 'NEEDS_REVIEW',
      confidence: 'LOW',
      detectionMethod: 'FRAME_INTERVAL_CHANGE',
      note: 'Candidate generated from frame interval. Requires admin visual review.',
      frameImageUrl: currentFrame.imageUrl,
    })
  }

  return candidates
}