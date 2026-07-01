package com.example.sportsperformance.logic

import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.HciEventResult
import com.example.sportsperformance.data.model.HciParameter

/**
 * Motor de Diagnóstico Qualitativo.
 * Implementa HCI_KNOWLEDGE_PLAN (09) e TB_HCI_OUTPUT_DECISION_ENGINE (10).
 */
class DiagnosticEngine {

    data class Diagnostic(
        val rank: Int,
        val slot: String, // PRIMARY, SECONDARY, TERCIARY
        val title: String,
        val insight: String,
        val action: String,
        val parameter1: String,
        val parameter2: String,
    )

    fun generateDiagnostics(result: HciEventResult, language: AppLanguage): List<Diagnostic> {
        val parameters = result.getParameters()
        
        // 1. Ranking por Prioridade (HCI_KNOWLEDGE_PLAN)
        // Menor score = Maior prioridade
        val sortedParams = parameters.sortedBy { it.priorityScore }
        
        // 2. Criação de Pares (HCI_KNOWLEDGE_PLAN)
        val pairs = mutableListOf<Pair<HciParameter, HciParameter>>()
        for ((i, p1) in sortedParams.withIndex()) {
            for (j in (i + 1) until sortedParams.size) {
                pairs.add(Pair(p1, sortedParams[j]))
            }
        }
        
        // 3. Seleção dos Top 3 Diagnósticos (TB_HCI_OUTPUT_DECISION_ENGINE)
        return pairs.asSequence().take(3).mapIndexed { index, pair ->
            val p1 = pair.first
            val p2 = pair.second
            
            val slot = when (index) {
                0 -> "PRIMARY"
                1 -> "SECONDARY"
                2 -> "TERCIARY"
                else -> "SUPPORT"
            }

            Diagnostic(
                rank = index + 1,
                slot = slot,
                title = "${p1.name} (${p1.level(language)}) + ${p2.name} (${p2.level(language)})",
                insight = generateInsight(p1, p2, language),
                action = generateAction(p1, p2, language),
                parameter1 = p1.name,
                parameter2 = p2.name,
            )
        }.toList()
    }

    private fun generateInsight(p1: HciParameter, p2: HciParameter, language: AppLanguage): String {
        return if (language == AppLanguage.PT) {
            "${p1.name} e ${p2.name} são os fatores limitantes atuais. " +
            "${p1.name} está no nível ${p1.level(language)}, enquanto ${p2.name} está no nível ${p2.level(language)}. " +
            "O treinamento deve priorizar a interação entre essas duas demandas."
        } else {
            "${p1.name} and ${p2.name} are current limiting factors. " +
            "${p1.name} is at ${p1.level(language)} level, while ${p2.name} is at ${p2.level(language)} level. " +
            "Training should prioritize the interaction between these two demands."
        }
    }

    private fun generateAction(p1: HciParameter, p2: HciParameter, language: AppLanguage): String {
        return if (language == AppLanguage.PT) {
            "Atacar gargalo em ${p1.name} e ${p2.name}: " +
            "converter diagnóstico em blocos de treino direcionados com progressão mensurável."
        } else {
            "Attack bottleneck in ${p1.name} and ${p2.name}: " +
            "convert diagnosis into targeted training blocks with measurable progression."
        }
    }
}
