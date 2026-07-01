package com.example.sportsperformance.logic

import com.example.sportsperformance.data.local.entities.PeriodizationConfig
import com.example.sportsperformance.data.local.entities.TrainingLibrary
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult

/**
 * Motor de Treino Técnico - Sports Performance.
 * Implementa a lógica de decisão baseada no perfil do atleta e fase de periodização.
 */
class TrainingEngine {

    fun suggestTraining(
        diagnostic: DiagnosticEngine.Diagnostic,
        availableTrainings: List<TrainingLibrary>,
        periodization: PeriodizationConfig?,
        result: HciEventResult,
        language: AppLanguage
    ): TrainingLibrary {
        val priorityParam = diagnostic.parameter1
        val athleteLevel = result.overallLevel
        val phase = periodization?.phaseName ?: "PREPARAÇÃO GERAL"
        
        // Busca na biblioteca por um treino que combine o parâmetro de maior prioridade
        val bestMatch = availableTrainings.firstOrNull { it.parameter == priorityParam }

        return bestMatch ?: buildDynamicTraining(priorityParam, athleteLevel, phase, language)
    }

    private fun buildDynamicTraining(
        parameter: String,
        level: String,
        phase: String,
        language: AppLanguage
    ): TrainingLibrary {
        val isPt = language == AppLanguage.PT
        
        return TrainingLibrary(
            trainingId = "DYN_${parameter}_${System.currentTimeMillis()}",
            parameter = parameter,
            name = if (isPt) "Bloco Técnico: $parameter" else "Technical Block: $parameter",
            objective = if (isPt) "Estabilizar $parameter na fase $phase" else "Stabilize $parameter in $phase phase",
            description = if (isPt) {
                "Treino personalizado para nível $level. Foco em execução consciente para consolidar o parâmetro $parameter."
            } else {
                "Custom training for $level level. Focus on conscious execution to consolidate $parameter."
            },
            defaultTime = 60,
            defaultShots = 50,
            category = "TECHNICAL"
        )
    }
}
