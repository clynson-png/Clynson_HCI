package com.example.sportsperformance.logic

import android.content.Context
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.ui.screen.TargetReportPayload
import org.json.JSONObject
import kotlin.math.max

class TargetIntelligenceEngine(private val context: Context) {

    private data class DirectionalMatrixResult(
        val directionCode: String,
        val label: String,
        val primaryParameter: String,
        val secondaryParameter: String,
        val targetTrainingParameter: String,
        val trainingLookupCodes: List<String>,
        val insights: List<String>
    )
    private data class TrainingLookupRule(
        val targetType: String?,
        val trainingType: String,
        val weaponClass: String,
        val phase: String,
        val parameter: String
    )
    fun analyze(
        targetType: String,
        athleteName: String,
        eventLabel: String,
        sessionLabel: String,
        appLanguage: AppLanguage,
        hotspots: List<String>,
        counts: List<Int>,
        totalShots: Int
    ): TargetReportPayload {
        val total = max(1, totalShots)
        val assignedShots = counts.sum()
        val zeroShots = (totalShots - assignedShots).coerceAtLeast(0)
        val percentages = hotspots.zip(counts)
            .map { (label, count) -> label to ((count * 100) / total) }
            .sortedByDescending { it.second }
        val top1 = percentages.getOrNull(0) ?: ("Sem dados" to 0)
        val top2 = percentages.getOrNull(1) ?: top1
        val top3 = percentages.getOrNull(2) ?: top2
        val directionalMatrix = lookupDirectionalMatrixEntry(
            targetType = targetType,
            percentages = percentages,
            appLanguage = appLanguage
        )
        val parameter = directionalMatrix?.targetTrainingParameter
            ?: inferTargetTrainingParameter(
                targetType = targetType,
                percentages = percentages,
                zeroShots = zeroShots
            )
        val training = lookupTraining(parameter, appLanguage, targetType)
        val directionRows = buildDirectionRows(targetType, percentages)
        val officialMetrics = buildOfficialMetrics(targetType, totalShots, counts, top1, top2, appLanguage, zeroShots)

        val baseInsights = buildInsights(targetType, top1, top2, top3, appLanguage, zeroShots)

        val insights = when {
            targetType == "DUEL_20" && directionalMatrix != null -> {
                buildDirectionalInsightLines(directionalMatrix, appLanguage)
            }

            directionalMatrix != null -> {
                buildDirectionalInsightLines(directionalMatrix, appLanguage) + baseInsights
            }

            else -> {
                baseInsights
            }
        }
        return TargetReportPayload(
            reportTitle = when (targetType) {
                "DEFENSE_HUMANOID" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Relatório HCI de Análise de Alvo Humanoide"
                    } else {
                        "HCI Humanoid Target Analysis Report"
                    }
                }
                "PRECISION_COLOR" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Relatório HCI de Análise de Cartões Coloridos"
                    } else {
                        "HCI Color Cards Analysis Report"
                    }
                }
                "DUEL_20" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Relatório HCI de Análise Duelo 20"
                    } else {
                        "HCI Duel 20 Target Analysis Report"
                    }
                }
                else -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Relatório HCI de Análise de Alvo"
                    } else {
                        "HCI Target Analysis Report"
                    }
                }
            },
            athleteName = athleteName,
            eventLabel = eventLabel,
            sessionLabel = sessionLabel,
            language = appLanguage,
            targetType = targetType,
            totalShots = totalShots,
            percentages = percentages,
            officialMetrics = officialMetrics,
            directionalRows = directionRows,
            insights = insights,
            trainingTitle = training.first,
            trainingDescription = training.second,
            keyPhrase = when (targetType) {
                "DEFENSE_HUMANOID" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "O disparo só termina depois de encerrado o follow-through."
                    } else {
                        "The shot only ends after the follow-through."
                    }
                }
                "PRECISION_COLOR" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Reconheça a cor, organize o processo e só então execute."
                    } else {
                        "Recognize the color, organize the process, and only then execute."
                    }
                }
                "DUEL_20" -> {
                    if (appLanguage == AppLanguage.PT) {
                        "A direção do impacto revela o padrão técnico por trás do resultado."
                    } else {
                        "Impact direction reveals the technical pattern behind the result."
                    }
                }
                else -> {
                    if (appLanguage == AppLanguage.PT) {
                        "Analise o alvo, identifique o padrão e prescreva pelo motor."
                    } else {
                        "Analyze the target, identify the pattern, and prescribe through the engine."
                    }
                }
            }
        )
    }
    private fun inferTargetTrainingParameter(
        targetType: String,
        percentages: List<Pair<String, Int>>,
        zeroShots: Int
    ): String {
        val topZone = percentages.firstOrNull()?.first.orEmpty()
        val activeZones = percentages.filter { it.second > 0 }
        if (targetType == "DEFENSE_HUMANOID") {
            // Regra 1: se tem tiro zerado, primeiro corrigir POSIÇÃO.
            if (zeroShots > 0) {
                return "TARGET_POSITION"
            }

            // Regra 2: tiros espalhados, aproximadamente um por quadrante/zona.
            val isSpread = activeZones.size >= 4 &&
                    activeZones.take(4).all { it.second <= 35 }
            if (isSpread) {
                return "TARGET_AIMING"
            }

            // Regra 3: concentração abaixo e à direita.
            val isLowRight = (
                    topZone.contains("inferior", true) ||
                            topZone.contains("baixo", true) ||
                            topZone.contains("quadrante direito", true) ||
                            topZone.contains("pélvis", true) ||
                            topZone.contains("pelvis", true)
                    ) && (
                    topZone.contains("direito", true) ||
                            topZone.contains("direita", true)
                    )
            if (isLowRight) {
                return "TARGET_TRIGGERING"
            }

            // Regra 4: lateralização esquerda/direita.
            val isLateralized = topZone.contains("esquerdo", true) ||
                    topZone.contains("esquerda", true) ||
                    topZone.contains("direito", true) ||
                    topZone.contains("direita", true)
            if (isLateralized) {
                return "TARGET_GRIP"
            }
            return "TARGET_AIMING"
        }
        if (targetType == "PRECISION_COLOR") {
            // Regra 1: mais de um zero = identification de cores.
            if (zeroShots > 1) {
                return "TARGET_COLOR_IDENTIFICATION"
            }
            val upperRight = (
                    topZone.contains("superior", true) ||
                            topZone.contains("cima", true) ||
                            topZone.contains("verde", true)
                    ) && (
                    topZone.contains("direito", true) ||
                            topZone.contains("direita", true) ||
                            topZone.contains("verde", true)
                    )
            val lowerRight = (
                    topZone.contains("inferior", true) ||
                            topZone.contains("baixo", true) ||
                            topZone.contains("azul", true)
                    ) && (
                    topZone.contains("direito", true) ||
                            topZone.contains("direita", true) ||
                            topZone.contains("azul", true)
                    )

            val lowerLeft = (
                    topZone.contains("inferior", true) ||
                            topZone.contains("baixo", true) ||
                            topZone.contains("vermelho", true)
                    ) && (
                    topZone.contains("esquerdo", true) ||
                            topZone.contains("esquerda", true) ||
                            topZone.contains("vermelho", true)
                    )
            val upperLeft = (
                    topZone.contains("superior", true) ||
                            topZone.contains("cima", true) ||
                            topZone.contains("amarelo", true)
                    ) && (
                    topZone.contains("esquerdo", true) ||
                            topZone.contains("esquerda", true) ||
                            topZone.contains("amarelo", true)
                    )
            return when {
                upperRight -> "TARGET_AIMING"
                lowerRight -> "TARGET_TRIGGERING"
                lowerLeft -> "TARGET_GRIP"
                upperLeft -> "TARGET_POSITION"
                else -> "TARGET_AIMING"
            }
        }
        return "TARGET_AIMING"
    }
    private fun lookupTraining(
        parameter: String,
        appLanguage: AppLanguage,
        targetType: String
    ): Pair<String, String> {
        val raw = try {
            context.assets.open("training_library_canonical.json")
                .bufferedReader()
                .use { it.readText() }
        } catch (e: Exception) {
            ""
        }

        if (raw.isBlank()) {
            return fallbackTargetTraining(appLanguage)
        }
        val entries = JSONObject(raw).getJSONArray("entries")
        val langKey = if (appLanguage == AppLanguage.PT) "pt-BR" else "en-US"
        val lookupParameter = if (targetType == "DUEL_20") {
            when (parameter) {
                "TARGET_AIMING" -> "PROCESS"
                "TARGET_TRIGGERING" -> "PROCESS"
                "TARGET_GRIP" -> "PROCESS"
                "TARGET_POSITION" -> "TRANSFER"
                "TARGET_COLOR_IDENTIFICATION" -> "PROCESS"
                else -> parameter
            }
        } else {
            parameter
        }
        val lookupRules = when (targetType) {
            "DUEL_20" -> listOf(
                TrainingLookupRule(
                    targetType = "DUEL_20",
                    trainingType = "TECHNICAL",
                    weaponClass = "PISTOL",
                    phase = "SPECIFIC_PREPARATION",
                    parameter = lookupParameter
                )
            )

            "DEFENSE_HUMANOID" -> listOf(
                TrainingLookupRule(
                    targetType = "DEFENSE_HUMANOID",
                    trainingType = "TARGET_BASIC",
                    weaponClass = "HUMANOID_BASIC",
                    phase = "GENERAL_PREPARATION",
                    parameter = lookupParameter
                )
            )

            "PRECISION_COLOR" -> listOf(
                TrainingLookupRule(
                    targetType = "PRECISION_COLOR",
                    trainingType = "TARGET_BASIC",
                    weaponClass = "COLOR_CARD_BASIC",
                    phase = "GENERAL_PREPARATION",
                    parameter = lookupParameter
                )
            )

            else -> listOf(
                TrainingLookupRule(
                    targetType = null,
                    trainingType = "TARGET_BASIC",
                    weaponClass = "TARGET_BASIC",
                    phase = "GENERAL_PREPARATION",
                    parameter = parameter
                )
            )
        }

        lookupRules.forEach { rule ->
            for (index in 0 until entries.length()) {
                val item = entries.getJSONObject(index)

                val targetTypeMatches = rule.targetType == null ||
                        item.optString("targetType") == rule.targetType

                if (
                    item.optBoolean("active") &&
                    targetTypeMatches &&
                    item.optString("phase") == rule.phase &&
                    item.optString("trainingType") == rule.trainingType &&
                    item.optString("weaponClass") == rule.weaponClass &&
                    item.optString("parameter") == rule.parameter
                ) {
                    val name = localizedText(item, "name", langKey)
                    val description = localizedText(item, "description", langKey)

                    return name to description
                }
            }
        }
        return fallbackTargetTraining(appLanguage)
    }
    private fun fallbackTargetTraining(
        appLanguage: AppLanguage
    ): Pair<String, String> {
        return if (appLanguage == AppLanguage.PT) {
            "Treino básico de alvo" to "Exercício introdutório liberado para esta tela de alvo."
        } else {
            "Basic target training" to "Introductory exercise unlocked for this target screen."
        }
    }
    private fun localizedText(
        item: JSONObject,
        field: String,
        langKey: String
    ): String {
        return when (val value = item.opt(field)) {
            is JSONObject -> value.optString(langKey, value.optString("en-US", ""))
            is String -> value
            else -> ""
        }
    }
    private fun lookupDirectionalMatrixEntry(
                targetType: String,
                percentages: List<Pair<String, Int>>,
                appLanguage: AppLanguage
            ): DirectionalMatrixResult? {
                if (targetType != "DUEL_20") {
                    return null
                }
                val dominantDirection = percentages
                    .filter { it.second > 0 }
                    .mapNotNull { directionCodeFromTargetLabel(it.first) }
                    .firstOrNull { it != "C" }
                    ?: return null
                        val raw = try {
                            context.assets.open("target_intelligence_direction_matrix.json")
                                .bufferedReader()
                                .use { it.readText() }
                        } catch (e: Exception) {
                            ""
                        }
                if (raw.isBlank()) {
                    return null
                }
                val langKey = if (appLanguage == AppLanguage.PT) "pt-BR" else "en-US"
                val profiles = JSONObject(raw).getJSONArray("profiles")
                for (profileIndex in 0 until profiles.length()) {
                    val profile = profiles.getJSONObject(profileIndex)
                    if (
                        profile.optString("weaponClass") == "PISTOL" &&
                        profile.optString("model") == "DUEL_20_8_SECTORS"
                    ) {
                        val directions = profile.getJSONArray("directions")
                        for (directionIndex in 0 until directions.length()) {
                            val item = directions.getJSONObject(directionIndex)
                            if (item.optString("appDirectionCode") == dominantDirection) {
                                val insightsObject = item.optJSONObject("insights")
                                val insightsArray = insightsObject?.optJSONArray(langKey)
                                    ?: insightsObject?.optJSONArray("en-US")
                                val insights = mutableListOf<String>()
                                if (insightsArray != null) {
                                    for (i in 0 until insightsArray.length()) {
                                        insights.add(insightsArray.optString(i))
                                    }
                                }
                                val trainingCodesArray = item.optJSONArray("trainingLookupCodes")
                                val trainingCodes = mutableListOf<String>()
                                if (trainingCodesArray != null) {
                                    for (i in 0 until trainingCodesArray.length()) {
                                        trainingCodes.add(trainingCodesArray.optString(i))
                                    }
                                }
                                val labelObject = item.optJSONObject("label")
                                val label = labelObject?.optString(langKey, labelObject.optString("en-US"))
                                    ?: dominantDirection
                                return DirectionalMatrixResult(
                                    directionCode = dominantDirection,
                                    label = label,
                                    primaryParameter = item.optString("primaryParameter"),
                                    secondaryParameter = item.optString("secondaryParameter"),
                                    targetTrainingParameter = item.optString("targetTrainingParameter", "TARGET_AIMING"),
                                    trainingLookupCodes = trainingCodes,
                                    insights = insights
                                )
                            }
                        }
                    }
                }

                return null
            }
    private fun directionCodeFromTargetLabel(label: String): String? {
        val clean = label.substringBefore("|").trim()
        if (clean == "XC") {
        return "C"
                }
                if (clean.startsWith("X")) {
        return clean.drop(1).ifBlank { "C" }
                }
                val direction = clean.dropWhile { it.isDigit() }
        return direction.ifBlank {
                    null
                }
            }
    private fun buildDirectionalInsightLines(
        matrix: DirectionalMatrixResult,
        appLanguage: AppLanguage
    ): List<String> {
        val technicalInsights = matrix.insights.joinToString(", ")

        return if (appLanguage == AppLanguage.PT) {
            listOf(
                "Insight direcional. O padrão dominante apareceu em ${matrix.label} (${matrix.directionCode}), sugerindo ${matrix.primaryParameter} como parâmetro técnico principal e ${matrix.secondaryParameter} como apoio.",
                "Leitura técnica do Coach. A matriz direcional aponta: $technicalInsights."
            )
        } else {
            listOf(
                "Directional insight. The dominant pattern appeared in ${matrix.label} (${matrix.directionCode}), suggesting ${matrix.primaryParameter} as the primary technical parameter and ${matrix.secondaryParameter} as support.",
                "Coach technical reading. The directional matrix indicates: $technicalInsights."
            )
        }
    }
    private fun buildOfficialMetrics(
        targetType: String,
        totalShots: Int,
        counts: List<Int>,
        top1: Pair<String, Int>,
        top2: Pair<String, Int>,
        appLanguage: AppLanguage,
        zeroShots: Int
    ): List<Pair<String, String>> {
        val focused = counts.maxOrNull() ?: 0
        val spread = (counts.maxOrNull() ?: 0) - (counts.minOrNull() ?: 0)
        return if (appLanguage == AppLanguage.PT) {
            listOf(
                "Total de tiros" to totalShots.toString(),
                "Zona dominante" to "${top1.first} (${top1.second}%)",
                "Zona secundária" to "${top2.first} (${top2.second}%)",
                "Concentração máxima" to focused.toString(),
                "Tiros zerados" to zeroShots.toString(),
                "Dispersão entre zonas" to spread.toString(),
                "Modelo" to if (targetType == "DEFENSE_HUMANOID") {
                    "8 hotspots de alvo humanoide"
                } else {
                    "4 quadrantes de cartões coloridos"
                }
            )
        } else {
            listOf(
                "Total shots" to totalShots.toString(),
                "Primary zone" to "${top1.first} (${top1.second}%)",
                "Secondary zone" to "${top2.first} (${top2.second}%)",
                "Peak concentration" to focused.toString(),
                "Zero shots" to zeroShots.toString(),
                "Zone spread" to spread.toString(),
                "Model" to if (targetType == "DEFENSE_HUMANOID") {
                    "8 humanoid target hotspots"
                } else {
                    "4 color card quadrants"
                }
            )
        }
    }
    private fun buildDirectionRows(
        targetType: String,
        percentages: List<Pair<String, Int>>
    ): List<List<String>> {
        return percentages.mapIndexed { index, (label, pct) ->
            listOf(
                (index + 1).toString(),
                angleFor(targetType, label),
                label,
                "$pct%",
                readingFor(index, targetType, label)
            )
        }
    }
    private fun angleFor(targetType: String, label: String): String {
        if (targetType == "DUEL_20") {
            return when (directionCodeFromTargetLabel(label)) {
                "E" -> "0°"
                "NE" -> "45°"
                "N" -> "90°"
                "NW" -> "135°"
                "W" -> "180°"
                "SW" -> "225°"
                "S" -> "270°"
                "SE" -> "315°"
                "C" -> "Centro"
                else -> "-"
            }
        }
        return if (targetType == "DEFENSE_HUMANOID") {
            when {
                label.contains("Cabeça", true) -> "90°"
                label.contains("Tórax", true) -> "0°"
                label.contains("Abdômen", true) -> "270°"
                label.contains("Pélvis", true) -> "270°"
                label.contains("Ombro esquerdo", true) -> "135°"
                label.contains("Ombro direito", true) -> "45°"
                label.contains("Quadrante esquerdo", true) -> "225°"
                label.contains("Quadrante direito", true) -> "315°"
                else -> "-"
            }
        } else {
            when {
                label.contains("Amarelo", true) -> "135°"
                label.contains("Verde", true) -> "45°"
                label.contains("Vermelho", true) -> "225°"
                label.contains("Azul", true) -> "315°"
                else -> "-"
            }
        }
    }
    private fun readingFor(index: Int, targetType: String, label: String): String {
        if (index == 0) {
            return if (targetType == "DEFENSE_HUMANOID") {
                "Primary dominant zone"
            } else {
                "Primary dominant color"
            }
        }
        if (index == 1) {
            return if (targetType == "DEFENSE_HUMANOID") {
                "Secondary support zone"
            } else {
                "Secondary color response"
            }
        }
        return when {
            label.contains("esquerda", true) -> "Residual left influence"
            label.contains("direita", true) -> "Residual right influence"
            else -> "Minor balance effect"
        }
    }
    private fun buildInsights(
        targetType: String,
        top1: Pair<String, Int>,
        top2: Pair<String, Int>,
        top3: Pair<String, Int>,
        appLanguage: AppLanguage,
        zeroShots: Int
    ): List<String> {
        return if (targetType == "DEFENSE_HUMANOID" && appLanguage == AppLanguage.PT) {
            listOf(
                "Insight 1. A maior concentração apareceu em ${top1.first}, com ${top1.second}% dos disparos, indicando a zona dominante de resposta do atleta.",
                "Insight 2. A zona secundária foi ${top2.first}, com ${top2.second}%, sugerindo padrão complementar de indexação sob estresse.",
                if (zeroShots > 0) {
                    "Insight 3. Houve $zeroShots disparos sem acerto registrado. Isso reforça a necessidade de melhorar mira, decisão visual e acionamento para evitar tiros fora do alvo."
                } else {
                    "Insight 3. A terceira leitura em ${top3.first} reforça a necessidade de consolidar decisão visual, estabilidade e repetição do gesto."
                }
            )
        } else if (targetType == "DEFENSE_HUMANOID") {
            listOf(
                "Insight 1. The highest concentration appeared in ${top1.first}, with ${top1.second}% of shots, marking the dominant response zone.",
                "Insight 2. The secondary zone was ${top2.first}, with ${top2.second}%, suggesting a complementary indexing pattern under stress.",
                if (zeroShots > 0) {
                    "Insight 3. There were $zeroShots shots with no registered hit. This reinforces the need to improve aiming, visual decision and trigger action to avoid zero shots."
                } else {
                    "Insight 3. The third reading in ${top3.first} reinforces the need to consolidate visual decision, stability and repeatable action."
                }
            )
        } else if (appLanguage == AppLanguage.PT) {
            listOf(
                "Insight 1. O agrupamento dominante ficou em ${top1.first}, com ${top1.second}% dos disparos, definindo a principal resposta visual atual.",
                "Insight 2. O segundo polo apareceu em ${top2.first}, com ${top2.second}%, sugerindo troca de referência visual ou hesitação.",
                if (zeroShots > 0) {
                    "Insight 3. Houve $zeroShots disparos zerados fora do alvo. O atleta precisa melhorar reconhecimento visual, processo e controle antes de aumentar velocidade."
                } else {
                    "Insight 3. A terceira contribuição em ${top3.first} ajuda a qualificar se o erro é estável, alternado ou reativo à mudança de cor."
                }
            )
        } else {
            listOf(
                "Insight 1. The dominant cluster landed in ${top1.first}, with ${top1.second}% of shots, defining the current main visual response.",
                "Insight 2. The second pole appeared in ${top2.first}, with ${top2.second}%, suggesting a visual reference switch or hesitation.",
                if (zeroShots > 0) {
                    "Insight 3. There were $zeroShots zero shots outside the target. The athlete needs to improve visual recognition, process and control before increasing speed."
                } else {
                    "Insight 3. The third contribution in ${top3.first} helps qualify whether the error is stable, alternating or reactive to the color change."
                }
            )
        }
    }
}