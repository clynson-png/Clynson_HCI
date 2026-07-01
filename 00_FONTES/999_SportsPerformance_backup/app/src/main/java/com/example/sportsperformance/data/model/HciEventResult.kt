package com.example.sportsperformance.data.model

/**
 * Resultado consolidado de um evento HCI (Equivalente à linha expandida da TB_HCI)
 */
data class HciEventResult(
    val athleteName: String,
    val eventId: String,
    val prova: String,
    val totalEvento: Double,
    
    // Scores de TARGETS
    val outcomeScore: Double,
    val processScore: Double,
    val rhythmScore: Double,
    val deepeningScore: Double,
    val consistencyScore: Double,
    
    // Scores de STRUCTURE
    val transferScore: Double,
    val resilienceScore: Double,
    val pressureScore: Double,
    val emotionalScore: Double,
    val physicalScore: Double,
    
    // Níveis (ELITE, HIGH PERFORMANCE, etc.)
    val overallLevel: String,
    val overallScore: Double,
    
    // Dados brutos para diagnóstico e gráficos
    val stdAjustadoRhythm: Double,
    val dropCount: Int,
    val hciSR1Total: Double = 0.0,
    val hciSR2Total: Double = 0.0,
    val hciSR3Total: Double = 0.0,
    val hciSR4Total: Double = 0.0,
    val hciSR5Total: Double = 0.0,
    val hciSR6Total: Double = 0.0,
    val rhythmPath: List<Double> = emptyList(), // 18 pontos (P1, P2, P3 por série)
    val olympicRank: String = "N/A", // Comparação ISSF
    val rawSeries: List<ShotSeries> = emptyList()
) {
    fun overallLevel(language: AppLanguage): String {
        return if (language == AppLanguage.PT) {
            when {
                overallScore >= 8.5 -> "ELITE"
                overallScore >= 7.0 -> "ALTO RENDIMENTO"
                overallScore >= 5.0 -> "INTERMEDIÁRIO"
                else -> "INICIANTE"
            }
        } else {
            when {
                overallScore >= 8.5 -> "ELITE"
                overallScore >= 7.0 -> "HIGH PERFORMANCE"
                overallScore >= 5.0 -> "INTERMEDIATE"
                else -> "BEGINNER"
            }
        }
    }

    fun getParameters(): List<HciParameter> {
        return listOf(
            HciParameter("OUTCOME", outcomeScore, "TARGETS"),
            HciParameter("PROCESS", processScore, "TARGETS"),
            HciParameter("RHYTHM", rhythmScore, "TARGETS"),
            HciParameter("DEEPENING", deepeningScore, "TARGETS"),
            HciParameter("CONSISTENCY", consistencyScore, "TARGETS"),
            HciParameter("TRANSFER", transferScore, "STRUCTURE"),
            HciParameter("RESILIENCE", resilienceScore, "STRUCTURE"),
            HciParameter("PRESSURE", pressureScore, "STRUCTURE"),
            HciParameter("EMOTIONAL", emotionalScore, "STRUCTURE"),
            HciParameter("PHYSICAL", physicalScore, "STRUCTURE")
        )
    }
}

data class HciParameter(
    val name: String,
    val score: Double,
    val profile: String
) {
    fun level(language: AppLanguage): String {
        return if (language == AppLanguage.PT) {
            when {
                score >= 8.5 -> "ELITE"
                score >= 6.0 -> "ALTO RENDIMENTO"
                score >= 3.0 -> "INTERMEDIÁRIO"
                else -> "INICIANTE"
            }
        } else {
            when {
                score >= 8.5 -> "ELITE"
                score >= 6.0 -> "HIGH PERFORMANCE"
                score >= 3.0 -> "INTERMEDIATE"
                else -> "BEGINNER"
            }
        }
    }

    val level: String get() = level(AppLanguage.PT)
    
    val priorityScore: Double get() = if (name == "PHYSICAL") 10.0 - score else score
}
