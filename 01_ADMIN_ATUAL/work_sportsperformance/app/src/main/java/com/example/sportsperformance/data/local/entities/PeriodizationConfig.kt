package com.example.sportsperformance.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Configuração de Periodização definida pelo Admin.
 * Controla os percentuais de carga para os treinamentos.
 */
@Entity(tableName = "periodization_config")
data class PeriodizationConfig(
    @PrimaryKey
    val id: String = "CURRENT_CONFIG",
    val phaseName: String = "PREPARO GERAL",
    val volumePercentage: Double = 1.0, // 0.0 a 1.0 (ex: 0.7 para 70%)
    val intensityPercentage: Double = 1.0,
    val technicalFocus: Double = 0.6, // Peso para técnica
    val physicalFocus: Double = 0.4   // Peso para físico
)
