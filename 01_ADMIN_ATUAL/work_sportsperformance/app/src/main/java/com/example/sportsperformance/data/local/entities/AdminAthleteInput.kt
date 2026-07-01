package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "admin_athlete_input")
data class AdminAthleteInput(
    @PrimaryKey val contextKey: String, // athlete|event|session
    val athlete: String,
    val event: String,
    val session: String,
    val prova: String,
    val sr1: Double,
    val sr2: Double,
    val sr3: Double,
    val sr4: Double,
    val sr5: Double,
    val sr6: Double,
    val totalEvento: Double,
    val mediaTiro: Double,
    val technicalVolumePct: Int,
    val technicalIntensityPct: Int,
    val technicalDurationMin: Int,
    val technicalShots: Int,
    val technicalSeries: Int,
    val technicalFocus: String,
    val technicalStatus: String,
    val technicalNotes: String,
    val physicalLoadPct: Int,
    val physicalIntensityPct: Int,
    val physicalFrequency: String,
    val physicalBlock: String,
    val physicalModule: String,
    val physicalNotes: String,
    val predictionMqs: Int = 0,
    val predictionTop15: Int = 0,
    val predictionTop8: Int = 0,
    val updatedAt: Long = System.currentTimeMillis()
)
