package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "athlete_submission")
data class AthleteSubmission(
    @PrimaryKey val submissionId: String,
    val athlete: String,
    val event: String,
    val session: String,
    val prova: String,
    val serie: String,
    val shots: List<Double>,
    val source: String,
    val notes: String,
    val status: String,
    val submittedAt: Long,
    val reviewedAt: Long? = null,
    val reviewerRole: String? = null
) {
    val total: Double get() = shots.sum()
}
