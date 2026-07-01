package com.example.sportsperformance.logic

import com.example.sportsperformance.data.model.AppLanguage
import kotlin.math.roundToInt

class TrainingPlanEngine {
    data class Fundamental(
        val code: String,
        val name: String,
        val percent: Int
    )

    data class PlanDay(
        val day: Int,
        val microcycle: String,
        val routine: String,
        val aerobic: String,
        val review: String,
        val strategic: String,
        val technicalMorning: String,
        val technicalAfternoon: String,
        val mental: String,
        val neuromuscular: String
    )

    data class TrainingOption(
        val id: String,
        val code: String,
        val title: String,
        val family: String,
        val prescription: String,
        val duration: String,
        val volume: String
    )

    fun generate30Days(fundamentals: List<Fundamental>, language: AppLanguage): List<PlanDay> {
        val technicalCodes = weightedCodes(fundamentals, 60)
        val strategicPattern = listOf("COM", "COM", "SC", "SC", "RT", "RT", "COM", "R")

        return (1..30).map { day ->
            val index = day - 1
            val isRestDay = day % 7 == 6 || day % 7 == 0
            val isCompetitionDay = day == 13
            val microcycle = when (day) {
                in 1..7 -> if (language == AppLanguage.PT) "MICROCICLO PRÉ-COMPETITIVO" else "PRE COMPETITIVE MICROCYCLE"
                in 8..15 -> if (language == AppLanguage.PT) "MICROCICLO COMPETITIVO" else "COMPETITIVE MICROCYCLE"
                in 16..23 -> if (language == AppLanguage.PT) "MICROCICLO PREPARAÇÃO GERAL" else "GENERAL PREPARATION MICROCYCLE"
                else -> if (language == AppLanguage.PT) "MICROCICLO PREPARAÇÃO ESPECIAL" else "SPECIFIC PREPARATION MICROCYCLE"
            }

            PlanDay(
                day = day,
                microcycle = microcycle,
                routine = if (isRestDay) "R" else "Y",
                aerobic = if (day % 4 == 1 || day % 7 == 3) "Y" else "R",
                review = if (day in listOf(1, 4, 8, 11, 16, 24)) "Y" else "",
                strategic = if (isCompetitionDay) "COMPET" else if (isRestDay) "R" else strategicPattern[index % strategicPattern.size],
                technicalMorning = if (isCompetitionDay) "COMPET" else if (isRestDay) "R" else technicalCodes[(index * 2) % technicalCodes.size],
                technicalAfternoon = if (isCompetitionDay) "COMPET" else if (isRestDay) "R" else technicalCodes[(index * 2 + 1) % technicalCodes.size],
                mental = if (isRestDay) "R" else "Y",
                neuromuscular = if (day % 3 == 2 || day % 7 == 4) "Y" else "R"
            )
        }
    }

    private fun weightedCodes(fundamentals: List<Fundamental>, slots: Int): List<String> {
        val active = fundamentals.filter { it.percent > 0 }
        if (active.isEmpty()) return listOf("AT", "PT", "P", "Q", "W")

        val raw = active.map { it to ((it.percent / 100.0) * slots).roundToInt().coerceAtLeast(1) }
        val expanded = raw.flatMap { (fundamental, count) -> List(count) { fundamental.code } }.toMutableList()
        while (expanded.size < slots) {
            expanded.add(active.maxBy { it.percent }.code)
        }
        return expanded.take(slots)
    }

    fun compatibleTrainings(code: String, block: String, language: AppLanguage): List<TrainingOption> {
        val normalized = normalizeCode(code, block)
        val catalog = if (language == AppLanguage.PT) trainingCatalogPT else trainingCatalogEN
        return catalog.filter { it.code == normalized }
    }

    fun defaultTraining(code: String, block: String, language: AppLanguage): TrainingOption? {
        return compatibleTrainings(code, block, language).firstOrNull()
    }

    private fun normalizeCode(code: String, block: String): String {
        return when {
            code == "Y" && block.contains("ROUTINE", ignoreCase = true) -> "ROUTINE"
            code == "Y" && block.contains("MENTAL", ignoreCase = true) -> "MENTAL"
            code == "Y" && block.contains("AEROBIC", ignoreCase = true) -> "AEROBIC"
            code == "Y" && block.contains("NEUROMUSCULAR", ignoreCase = true) -> "NEURO"
            code == "R" -> "R"
            code == "RIT" -> "RT"
            else -> code
        }
    }

    private val trainingCatalogEN = listOf(
        TrainingOption("AT_01", "AT", "Aiming and Triggering", "AIMING_TRIGGERING", "Sight alignment, trigger pressure and follow through with controlled cadence.", "45 min", "40-60 shots"),
        TrainingOption("AT_02", "AT", "Blank Target Trigger Routine", "AIMING_TRIGGERING", "Alternate mental shot, dry shot and real shot, keeping front sight attention before, during and after release.", "50 min", "50 shots"),
        TrainingOption("PT_01", "PT", "Position & Triggering Stability", "POSITION_TRIGGERING", "Build position, confirm grip pressure, execute trigger release without disturbing alignment.", "45 min", "40 shots"),
        TrainingOption("P_01", "P", "Precision Block", "PRECISION", "Low-volume precision work with strict quality gate before each shot.", "40 min", "30-40 shots"),
        TrainingOption("Q_01", "Q", "Quality Gate Session", "QUALITY", "Every shot starts only after routine, sight picture and breathing checkpoints are confirmed.", "45 min", "40 shots"),
        TrainingOption("W_01", "W", "Wrist Lock Automation", "WRIST", "Automate wrist lock feeling with dry-fire and live-fire alternation.", "45 min", "40 shots"),
        TrainingOption("D_01", "D", "Deepening Sequence", "DEEPENING", "Increase clean 10-sequences through short series with immediate correction after any break.", "50 min", "50 shots"),
        TrainingOption("RT_01", "RT", "Rhythm Stabilization", "RHYTHM", "Stabilize SR/P1/P2/P3 rhythm and recover after the main drop point.", "45 min", "50 shots"),
        TrainingOption("COM_01", "COM", "Competition Test Event", "COMPETITION_TEST", "Run a test event with score, routine, timing and pressure notes.", "75 min", "60 shots"),
        TrainingOption("SC_01", "SC", "Simulated Competition & Contingency", "SIMULATED_COMPETITION", "Simulate competition conditions and rehearse contingency response after error.", "60 min", "50-60 shots"),
        TrainingOption("COMPET_01", "COMPET", "Competition Day Protocol", "COMPETITION_DAY", "Warm-up, routine lock, competition execution, post-event notes.", "Event day", "Match volume"),
        TrainingOption("ROUTINE_01", "ROUTINE", "Daily Routine Lock", "ROUTINE", "Short routine rehearsal before technical or competition blocks.", "15 min", "Dry + mental"),
        TrainingOption("MENTAL_01", "MENTAL", "Mindfulness Breath Control", "MENTAL", "Breathing, visualization and pressure reset before sleep or post-training.", "15-20 min", "1 session"),
        TrainingOption("AEROBIC_01", "AEROBIC", "Zone 2 Aerobic Maintenance", "PHYSICAL_CARDIO", "Controlled aerobic work to support late-match stability.", "20-40 min", "50-70% load"),
        TrainingOption("NEURO_01", "NEURO", "Core + Shoulder Stability", "PHYSICAL_NEURO", "Core stability, shoulder elastic band and balance control.", "30-45 min", "2-3x/week"),
        TrainingOption("R_01", "R", "Rest / Equipment Adjust", "RECOVERY", "Recovery, equipment check and notes. No training load.", "10 min", "No load")
    )

    private val trainingCatalogPT = listOf(
        TrainingOption("AT_01", "AT", "Visada e Acionamento", "AIMING_TRIGGERING", "Alinhamento de miras, pressão no gatilho e follow-through com cadência controlada.", "45 min", "40-60 tiros"),
        TrainingOption("AT_02", "AT", "Rotina de Gatilho Alvo Branco", "AIMING_TRIGGERING", "Alternar tiro mental, tiro em seco e tiro real, mantendo atenção na massa de mira antes, durante e após o disparo.", "50 min", "50 tiros"),
        TrainingOption("PT_01", "PT", "Estabilidade de Posição e Gatilho", "POSITION_TRIGGERING", "Construir a posição, confirmar pressão da empunhadura e executar o gatilho sem perturbar o alinhamento.", "45 min", "40 tiros"),
        TrainingOption("P_01", "P", "Bloco de Precisão", "PRECISION", "Trabalho de precisão de baixo volume com rigoroso controle de qualidade antes de cada tiro.", "40 min", "30-40 tiros"),
        TrainingOption("Q_01", "Q", "Sessão de Controle de Qualidade", "QUALITY", "Cada tiro começa apenas após a confirmação da rotina, imagem de mira e pontos de verificação respiratória.", "45 min", "40 tiros"),
        TrainingOption("W_01", "W", "Automação de Trava de Pulso", "WRIST", "Automatizar a sensação de trava de pulso com alternância entre tiro seco e real.", "45 min", "40 tiros"),
        TrainingOption("D_01", "D", "Sequência de Aprofundamento", "DEEPENING", "Aumentar sequências de 10 limpos através de séries curtas com correção imediata após qualquer quebra.", "50 min", "50 tiros"),
        TrainingOption("RT_01", "RT", "Estabilização de Ritmo", "RHYTHM", "Estabilizar o ritmo SR/P1/P2/P3 e recuperar após o principal ponto de queda.", "45 min", "50 tiros"),
        TrainingOption("COM_01", "COM", "Evento de Teste de Competição", "COMPETITION_TEST", "Realizar um evento de teste com notas de pontuação, rotina, tempo e pressão.", "75 min", "60 tiros"),
        TrainingOption("SC_01", "SC", "Simulado e Contingência", "SIMULATED_COMPETITION", "Simular condições de competição e ensaiar a resposta de contingência após o erro.", "60 min", "50-60 tiros"),
        TrainingOption("COMPET_01", "COMPET", "Protocolo de Dia de Competição", "COMPETITION_DAY", "Aquecimento, trava de rotina, execução de competição, notas pós-evento.", "Dia do evento", "Volume de prova"),
        TrainingOption("ROUTINE_01", "ROUTINE", "Trava de Rotina Diária", "ROUTINE", "Curto ensaio de rotina antes dos blocos técnicos ou de competição.", "15 min", "Seco + mental"),
        TrainingOption("MENTAL_01", "MENTAL", "Controle de Respiração Mindfulness", "MENTAL", "Respiração, visualização e reset de pressão antes de dormir ou pós-treino.", "15-20 min", "1 sessão"),
        TrainingOption("AEROBIC_01", "AEROBIC", "Manutenção Aeróbica Zona 2", "PHYSICAL_CARDIO", "Trabalho aeróbico controlado para suportar a estabilidade no final da prova.", "20-40 min", "50-70% carga"),
        TrainingOption("NEURO_01", "NEURO", "Estabilidade de Core + Ombros", "PHYSICAL_NEURO", "Estabilidade de core, elástico de ombro e controle de equilíbrio.", "30-45 min", "2-3x/semana"),
        TrainingOption("R_01", "R", "Descanso / Ajuste de Equipamento", "RECOVERY", "Recuperação, verificação de equipamento e notas. Sem carga de treino.", "10 min", "Sem carga")
    )
}
