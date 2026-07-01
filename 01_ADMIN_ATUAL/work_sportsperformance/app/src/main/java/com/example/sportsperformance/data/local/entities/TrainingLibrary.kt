package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Biblioteca de Treinos (Equivalente ao seu TB_HCI_TRAINING_BI)
 * Esta tabela permite que você administre os textos dos treinos.
 */
@Entity(tableName = "training_library")
data class TrainingLibrary(
    @PrimaryKey
    val trainingId: String,
    val parameter: String, // RHYTHM, PROCESS, EMOTIONAL, PHYSICAL, etc.
    val name: String,
    val objective: String,
    val description: String,
    val defaultTime: Int,
    val defaultShots: Int,
    val category: String, // TECHNICAL, STRATEGIC, PHYSICAL
    val language: String = "pt-BR" // Para suporte multi-idioma futuro
)
