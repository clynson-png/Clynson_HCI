package com.example.sportsperformance.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.Date

/**
 * Representa uma linha da sua tabela INPUT.
 * Cada linha é uma série de 10 tiros.
 */
@Entity(tableName = "shot_series")
data class ShotSeries(
    @PrimaryKey
    val chaveSerie: String,
    val dataColeta: Date,
    val prova: String,      // PISTOL, RIFLE
    val atleta: String,
    val evento: String,     // Ex: EV5
    val sessao: String,     // TREINO, SIMULADO, COMPETIÇÃO
    val idBloco: String,
    val statusEvento: String, // PARCIAL, FINAL
    val serie: String,      // SR1, SR2...
    val tiros: List<Double>, // T1 até T10
    
    // Controle de Motor (HCI V18)
    val hciSerieOrder: Int,
    val hciEventRowValid: Boolean = true
) {
    // Cálculo automático do TOTAL_SERIE
    val totalSerie: Double get() = tiros.sum()
    
    // CHAVE_BLOCO_INTERNA (Sua regra de arquitetura)
    val chaveBlocoInterna: String 
        get() = "${atleta}_${prova}_${evento}_${sessao}_$idBloco"

    companion object {
        fun createChave(atleta: String, prova: String, evento: String, sessao: String, idBloco: String, serie: String): String {
            return "${atleta}_${prova}_${evento}_${sessao}_${idBloco}_${serie}"
        }
    }
}
