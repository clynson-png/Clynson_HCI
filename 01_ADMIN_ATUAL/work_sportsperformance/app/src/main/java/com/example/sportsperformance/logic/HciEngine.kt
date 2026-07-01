package com.example.sportsperformance.logic

import com.example.sportsperformance.data.model.ShotSeries
import com.example.sportsperformance.data.model.HciEventResult
import kotlin.math.*

/**
 * Motor central de cálculo HCI.
 * Tradução fiel da lógica Power Query (03_TB_HCI.txt)
 */
class HciEngine {

    /**
     * Contexto histórico necessário para alguns cálculos (Equivalente às medianas da TB_HCI)
     */
    data class HistoricalContext(
        val medCompeticoes: Double? = null,
        val medSimulados: Double? = null,
        val medTreinos: Double? = null,
        val pressureLoadReferencia: Double? = null,
        val medTiroSimTreino: Double? = null
    )

    fun processEvent(series: List<ShotSeries>, context: HistoricalContext = HistoricalContext()): HciEventResult {
        // 1. Trava de Validade (HCI_EVENT_ROW_VALID)
        val sortedSeries = series.sortedBy { it.hciSerieOrder }
        val validSeries = mutableListOf<ShotSeries>()
        for (s in sortedSeries) {
            validSeries.add(s)
            if (s.statusEvento.uppercase() == "FINAL") break
        }

        val allShots = validSeries.flatMap { it.tiros }
        val seriesTotals = validSeries.map { it.totalSerie }
        val prova = series.firstOrNull()?.prova ?: "PISTOL"
        val isRifle = prova.uppercase().contains("RIFLE") || prova.uppercase().contains("CARABINA")

        // 2. Sequências (TARGETS)
        val seq910 = calculateSequences(allShots) { it >= 9.0 }
        val seq10 = calculateSequences(allShots) { it >= 10.0 }

        val processRatio = (seq910.maxLen.toDouble() * min(seq910.count, 2)) / 60.0
        val processScore = limit010(processRatio * 10.0)
        val deepeningScore = limit010((seq10.maxLen.toDouble() / 7.0) * 10.0)

        val amplitude = if (seriesTotals.isNotEmpty()) seriesTotals.max() - seriesTotals.min() else 0.0
        val consistencyScore = limit010(10.0 - (amplitude * 0.7))

        // 3. Rhythm Engine
        val rhythmData = calculateRhythmMetrics(allShots)
        val rhythmScore = calculateRhythmScoreBase10(rhythmData.stdAjustado)

        // 4. Outcome Score (HCI_OUTCOME_HCI_SCORE)
        val currentTotal = seriesTotals.sum()
        val outcomeReference = if (isRifle) 632.0 else 578.0
        // No HCI real, o Outcome pode ser baseado no total do evento atual ou na mediana.
        // Se medCompeticoes não existir, usa o total do evento atual normalizado para 60 tiros.
        val outcomeScore = context.medCompeticoes?.let {
            limit010(((it / outcomeReference) * 10.0 - 9.0) * 10.0)
        } ?: limit010(((currentTotal / outcomeReference) * 10.0 - 9.0) * 10.0)

        // 5. Structure Scores
        val totalEvento = seriesTotals.sum()
        val transferScore = context.medSimulados?.let {
            if (it > 0) limit010((totalEvento / it) * 10.0) else null
        } ?: 0.0

        // Resilience (Simplificado: recovery after drop)
        val resilienceScore = calculateResilience(seriesTotals)

        // Pressure Score
        val pressureLoadEvento = calculatePressureLoad(rhythmData)
        val pressureScore = context.pressureLoadReferencia?.let { ref ->
            val diff = pressureLoadEvento - ref
            if (diff <= 0) limit010(7.0 + abs(diff) * 3.0)
            else limit010(7.0 - diff * 3.0)
        } ?: 7.0

        // Emotional Score (Baseado em penalidades de sequências negativas)
        val emotionalScore = calculateEmotionalScore(allShots, context.medTiroSimTreino, isRifle)

        // Physical Score
        val physicalCount = calculatePhysicalDegradation(allShots)
        val physicalScore = limit010(10.0 - physicalCount)

        // 6. Rhythm Path (P1, P2, P3)
        val path = validSeries.flatMap { s ->
            listOf(
                s.tiros.subList(0, 3).median(),
                s.tiros.subList(3, 7).median(),
                s.tiros.subList(7, 10).median()
            )
        }

        // 7. Prediction BI (Olympic Benchmarking)
        val predictionRank = when {
            isRifle -> when {
                totalEvento >= 631.0 -> "FINALISTA OLÍMPICO (TOP 8)"
                totalEvento >= 628.0 -> "ELITE MUNDIAL (TOP 20)"
                totalEvento >= 620.0 -> "ALTO RENDIMENTO"
                else -> "EM DESENVOLVIMENTO"
            }
            else -> when {
                totalEvento >= 582.0 -> "FINALISTA OLÍMPICO (TOP 8)"
                totalEvento >= 578.0 -> "ELITE MUNDIAL (TOP 20)"
                totalEvento >= 570.0 -> "ALTO RENDIMENTO"
                else -> "EM DESENVOLVIMENTO"
            }
        }

        // 8. Weighted Overall Calculation (MPValue Organization)
        // Pesos baseados na arquitetura 11_TB_HCI_OUTPUT_DECISION_ENGINE_INTEGRATED.txt
        val overallScore = round(
            (outcomeScore * 0.40 + 
             processScore * 0.10 + 
             rhythmScore * 0.10 + 
             deepeningScore * 0.05 + 
             consistencyScore * 0.10 + 
             transferScore * 0.05 + 
             resilienceScore * 0.05 + 
             pressureScore * 0.05 + 
             physicalScore * 0.05 + 
             (emotionalScore / 10.0) * 0.05) * 100
        ) / 100.0

        val level = if (overallScore >= 8.5) "ELITE"
                    else if (overallScore >= 7.0) "HIGH PERFORMANCE"
                    else if (overallScore >= 5.0) "COMPETITIVE"
                    else "DEVELOPMENT"

        return HciEventResult(
            athleteName = series.firstOrNull()?.atleta ?: "Desconhecido",
            eventId = series.firstOrNull()?.evento ?: "N/A",
            prova = prova,
            totalEvento = totalEvento,
            outcomeScore = outcomeScore,
            processScore = processScore,
            rhythmScore = rhythmScore,
            deepeningScore = deepeningScore,
            consistencyScore = consistencyScore,
            transferScore = transferScore,
            resilienceScore = resilienceScore,
            pressureScore = pressureScore,
            emotionalScore = emotionalScore,
            physicalScore = physicalScore,
            stdAjustadoRhythm = rhythmData.stdAjustado,
            dropCount = rhythmData.dropCount,
            overallScore = overallScore,
            overallLevel = level,
            hciSR1Total = seriesTotals.getOrNull(0) ?: 0.0,
            hciSR2Total = seriesTotals.getOrNull(1) ?: 0.0,
            hciSR3Total = seriesTotals.getOrNull(2) ?: 0.0,
            hciSR4Total = seriesTotals.getOrNull(3) ?: 0.0,
            hciSR5Total = seriesTotals.getOrNull(4) ?: 0.0,
            hciSR6Total = seriesTotals.getOrNull(5) ?: 0.0,
            rhythmPath = path,
            olympicRank = predictionRank,
            rawSeries = validSeries
        )
    }

    private fun calculateSequences(shots: List<Double>, predicate: (Double) -> Boolean): SequenceResult {
        var maxLen = 0
        var count = 0
        var current = 0
        for (s in shots) {
            if (predicate(s)) {
                current++
                if (current > maxLen) maxLen = current
            } else {
                if (current >= 3) count++
                current = 0
            }
        }
        if (current >= 3) count++
        return SequenceResult(count, maxLen)
    }

    private fun calculateRhythmMetrics(shots: List<Double>): RhythmResult {
        if (shots.isEmpty()) return RhythmResult(0.0, 0, 0.0)
        val baseline = shots.median()
        val std = calculatePopStd(shots)
        val drops = shots.filter { it < baseline - 1.5 }
        return RhythmResult(std, drops.size, if (drops.isNotEmpty()) baseline - drops.min() else 0.0)
    }

    private fun calculateRhythmScoreBase10(std: Double): Double {
        return limit010(10.0 - (std * 2.5))
    }

    private fun calculateResilience(seriesTotals: List<Double>): Double {
        if (seriesTotals.size < 2) return 7.0
        var improvements = 0
        for (i in 1 until seriesTotals.size) {
            if (seriesTotals[i] > seriesTotals[i-1]) improvements++
        }
        return limit010(5.0 + improvements * 1.0)
    }

    private fun calculatePressureLoad(rhythm: RhythmResult): Double {
        return rhythm.stdAjustado + (rhythm.dropCount * 0.1)
    }

    private fun calculateEmotionalScore(shots: List<Double>, medTiro: Double?, isRifle: Boolean): Double {
        val base = medTiro ?: (if (isRifle) 10.0 else 9.0)
        var penalidadeTotal = 0.0
        var currentGroup = mutableListOf<String>()
        
        for (shot in shots) {
            val classe = when {
                isRifle -> if (shot >= base) "LIMPO" else if (shot >= base - 0.2) "ALERTA" else "ERRO"
                else -> if (shot >= base) "LIMPO" else if (shot >= base - 1.0) "ALERTA" else "ERRO"
            }
            
            if (classe == "LIMPO") {
                if (currentGroup.isNotEmpty()) {
                    penalidadeTotal += calculateGroupPenalty(currentGroup)
                    currentGroup = mutableListOf()
                }
            } else {
                currentGroup.add(classe)
            }
        }
        if (currentGroup.isNotEmpty()) penalidadeTotal += calculateGroupPenalty(currentGroup)
        
        return max(3.0, limit010(10.0 - penalidadeTotal))
    }

    private fun calculateGroupPenalty(group: List<String>): Double {
        val size = group.size
        val hasError = group.contains("ERRO")
        return when {
            size >= 3 -> if (hasError) 2.0 else 1.2
            size == 2 -> if (hasError) 1.0 else 0.6
            else -> if (hasError) 0.5 else 0.2
        }
    }

    private fun calculatePhysicalDegradation(shots: List<Double>): Int {
        if (shots.size < 40) return 0
        val firstHalf = shots.take(shots.size / 2).median()
        val secondHalf = shots.drop(shots.size / 2).median()
        return if (secondHalf < firstHalf - 0.2) 2 else 0
    }

    private fun calculatePopStd(data: List<Double>): Double {
        if (data.isEmpty()) return 0.0
        val baseline = data.median()
        return sqrt(data.sumOf { (it - baseline).pow(2) } / data.size)
    }

    private fun limit010(v: Double): Double = max(0.0, min(10.0, v))

    private fun List<Double>.median(): Double {
        if (isEmpty()) return 0.0
        val sorted = sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 0) {
            (sorted[middle - 1] + sorted[middle]) / 2.0
        } else {
            sorted[middle]
        }
    }

    data class SequenceResult(val count: Int, val maxLen: Int)
    data class RhythmResult(val stdAjustado: Double, val dropCount: Int, val maxDrop: Double)
}
