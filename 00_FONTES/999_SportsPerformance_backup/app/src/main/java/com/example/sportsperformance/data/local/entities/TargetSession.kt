package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "target_session")
data class TargetSession(
    @PrimaryKey val sessionId: String,
    val athlete: String,
    val event: String,
    val session: String,
    val targetType: String,
    val totalShots: Int,
    val zoneLabels: List<String>,
    val zoneCounts: List<Int>,
    val recommendedTraining: String,
    val submittedAt: Long
) {
    val totalRegistered: Int get() = zoneCounts.sum()
}
