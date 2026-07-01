package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "qualified_lead")
data class QualifiedLead(
    @PrimaryKey val leadId: String,
    val athleteName: String,
    val athleteEmail: String,
    val source: String,
    val createdAt: Long,
    val updatedAt: Long
)
