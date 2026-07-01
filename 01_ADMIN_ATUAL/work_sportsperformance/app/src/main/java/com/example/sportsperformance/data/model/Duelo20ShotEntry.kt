package com.example.sportsperformance.data.model

data class Duelo20ShotEntry(
    val shotNumber: Int,
    val series: String,
    val shotInSeries: Int,
    val score: Int? = null,
    val isX: Boolean = false,
    val direction: String? = null,
    val shotTimeMs: Long? = null,
    val splitTimeMs: Long? = null,
    val heartRateBpm: Int? = null
) {
    val zoneCode: String?
        get() = if (score != null && direction != null) {
            if (isX) "X${direction}" else "${score}${direction}"
        } else {
            null
        }
}