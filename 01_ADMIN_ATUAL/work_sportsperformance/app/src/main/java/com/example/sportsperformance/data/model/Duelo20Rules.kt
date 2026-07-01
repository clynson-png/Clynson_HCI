package com.example.sportsperformance.data.model

enum class Duelo20Mode {
    DUELO_20_25M,
    DUELO_20_10M
}

object Duelo20Rules {
    const val TOTAL_SHOTS = 20
    const val SERIES_COUNT = 4
    const val SHOTS_PER_SERIES = 5
    const val MAX_SCORE_25M = 200
    const val MAX_SCORE_10M = 240

    fun seriesForShot(shotNumber: Int): String {
        val sr = ((shotNumber - 1) / SHOTS_PER_SERIES) + 1
        return "SR$sr"
    }

    fun shotInSeries(shotNumber: Int): Int {
        return ((shotNumber - 1) % SHOTS_PER_SERIES) + 1
    }

    fun computedScore(
        score: Int?,
        isX: Boolean,
        mode: Duelo20Mode
    ): Int {
        if (score == null) return 0

        return if (isX) {
            when (mode) {
                Duelo20Mode.DUELO_20_25M -> 10
                Duelo20Mode.DUELO_20_10M -> 12
            }
        } else {
            score
        }
    }

    fun maxScore(mode: Duelo20Mode): Int {
        return when (mode) {
            Duelo20Mode.DUELO_20_25M -> MAX_SCORE_25M
            Duelo20Mode.DUELO_20_10M -> MAX_SCORE_10M
        }
    }

    fun emptyShots(): List<Duelo20ShotEntry> {
        return (1..TOTAL_SHOTS).map { shotNumber ->
            Duelo20ShotEntry(
                shotNumber = shotNumber,
                series = seriesForShot(shotNumber),
                shotInSeries = shotInSeries(shotNumber)
            )
        }
    }
}