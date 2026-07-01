package com.example.sportsperformance.logic

import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult

/**
 * Motor de Treino Físico.
 * Implementa a lógica da TB_HCI_TRAINING_ENGINE (13) para prescrição física.
 */
class PhysicalEngine {

    data class PhysicalPackage(
        val name: String,
        val exercises: List<String>,
        val loadPercentage: Double,
        val frequency: String,
        val safetyNote: String
    )

    fun generatePackage(
        result: HciEventResult,
        periodization: PeriodizationConfig?,
        language: AppLanguage
    ): PhysicalPackage {
        // Triggers baseados na arquitetura 13_TB_HCI_TRAINING_ENGINE.txt
        val stdTrigger = result.stdAjustadoRhythm > 0.6
        val physicalTrigger = result.physicalScore < 10.0
        
        val phaseName = periodization?.phaseName?.uppercase() ?: "GENERAL_PREPARATION"
        val isCompetition = phaseName.contains("COMPETITION") || phaseName.contains("COMPETIÇÃO") || phaseName.contains("PRE-COMP")

        val trainingType = when {
            stdTrigger && physicalTrigger -> "MIXED"
            stdTrigger -> "NEUROMUSCULAR"
            physicalTrigger -> "CARDIOPULMONARY"
            else -> "MAINTENANCE"
        }

        val load = if (isCompetition) 0.5 else 0.7
        val frequency = if (isCompetition) {
            if (language == AppLanguage.PT) "2x por semana" else "2x per week"
        } else {
            if (language == AppLanguage.PT) "4x por semana" else "4x per week"
        }

        return when (trainingType) {
            "MIXED" -> PhysicalPackage(
                name = if (language == AppLanguage.PT) "Híbrido: Estabilidade e Resistência" else "Mixed: Stability and Endurance",
                exercises = if (language == AppLanguage.PT) 
                    listOf("Isometria de ombros (30s)", "Core plank", "Caminhada acelerada (20 min)")
                else 
                    listOf("Shoulder isometry (30s)", "Core plank", "Brisk walking (20 min)"),
                loadPercentage = load,
                frequency = frequency,
                safetyNote = if (language == AppLanguage.PT) "Equilibrar volume aeróbico para não prejudicar a isometria." else "Balance aerobic volume to avoid impacting isometry."
            )
            "NEUROMUSCULAR" -> PhysicalPackage(
                name = if (language == AppLanguage.PT) "Foco: Estabilidade Postural" else "Focus: Postural Stability",
                exercises = if (language == AppLanguage.PT) 
                    listOf("Isometria em posição de tiro", "Fortalecimento de manguito", "Estabilidade escapular")
                else 
                    listOf("Shooting position isometry", "Cuff strengthening", "Scapular stability"),
                loadPercentage = load,
                frequency = frequency,
                safetyNote = if (language == AppLanguage.PT) "Foco em qualidade de contração e controle motor." else "Focus on contraction quality and motor control."
            )
            "CARDIOPULMONARY" -> PhysicalPackage(
                name = if (language == AppLanguage.PT) "Foco: Resistência à Fadiga" else "Focus: Fatigue Endurance",
                exercises = if (language == AppLanguage.PT) 
                    listOf("Ciclismo ou natação (30 min)", "Treino intervalado leve", "Exercícios respiratórios")
                else 
                    listOf("Cycling or swimming (30 min)", "Light interval training", "Breathing exercises"),
                loadPercentage = load,
                frequency = frequency,
                safetyNote = if (language == AppLanguage.PT) "Manter batimento em Zona 2 para base aeróbica." else "Maintain heart rate in Zone 2 for aerobic base."
            )
            else -> PhysicalPackage(
                name = if (language == AppLanguage.PT) "Manutenção Geral" else "General Maintenance",
                exercises = if (language == AppLanguage.PT) 
                    listOf("Alongamento global", "Mobilidade de quadril", "Ativação neural leve")
                else 
                    listOf("Global stretching", "Hip mobility", "Light neural activation"),
                loadPercentage = 0.4,
                frequency = "2x",
                safetyNote = if (language == AppLanguage.PT) "Prontidão para o próximo ciclo de treino." else "Readiness for the next training cycle."
            )
        }
    }
}
