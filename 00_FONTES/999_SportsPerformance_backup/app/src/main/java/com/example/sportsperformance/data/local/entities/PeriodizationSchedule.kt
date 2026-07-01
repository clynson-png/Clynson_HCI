package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date

@Entity(tableName = "periodization_schedule")
data class PeriodizationSchedule(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val phaseName: String,
    val startDate: Date,
    val endDate: Date,
    val volumePercentage: Double,
    val intensityPercentage: Double
)
