package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "training_plan_config")
data class TrainingPlanConfig(
    @PrimaryKey
    val id: String = "CURRENT_PLAN",
    val athlete: String,
    val event: String,
    val session: String,
    val goal: Int,
    val atPercent: Int,
    val ptPercent: Int,
    val pPercent: Int,
    val qPercent: Int,
    val wPercent: Int
)
