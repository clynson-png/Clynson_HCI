package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "training_plan_prescription")
data class TrainingPlanPrescription(
    @PrimaryKey
    val cellKey: String,
    val day: Int,
    val block: String,
    val code: String,
    val trainingId: String,
    val trainingTitle: String,
    val prescribedByRole: String,
    val updatedAt: Long
)
