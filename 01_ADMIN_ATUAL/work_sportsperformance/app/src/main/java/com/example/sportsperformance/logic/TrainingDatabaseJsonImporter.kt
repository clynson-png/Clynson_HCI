package com.example.sportsperformance.logic

import com.example.sportsperformance.data.local.entities.TargetSession
import com.example.sportsperformance.data.local.entities.TrainingPlanConfig
import com.example.sportsperformance.data.local.entities.TrainingPlanPrescription
import com.example.sportsperformance.data.model.ShotSeries
import org.json.JSONArray
import org.json.JSONObject
import java.util.Date

object TrainingDatabaseJsonImporter {
    private const val JSON_FORMAT = "SPORTS_PERFORMANCE_ATHLETE_TRAINING_DB"
    private const val CSV_INDICATOR = "SPORTS_PERFORMANCE_TRAINING_DB_V1"

    data class Result(
        val athlete: String,
        val config: TrainingPlanConfig?,
        val prescriptions: List<TrainingPlanPrescription>,
        val series: List<ShotSeries>,
        val targetSessions: List<TargetSession>
    )

    fun parse(rawText: String): Result {
        val text = rawText.trim().removePrefix("\uFEFF")
        return if (text.startsWith("{")) parseJson(text) else parseCsv(text)
    }

    private fun parseJson(jsonText: String): Result {
        val root = JSONObject(jsonText)
        val format = root.optString("format")
        val indicator = root.optString("indicator")

        require(format == JSON_FORMAT || indicator == CSV_INDICATOR) {
            "Arquivo sem indicador SportsPerformance valido."
        }

        val athlete = root.optString("athlete").ifBlank {
            root.optJSONObject("athlete360")
                ?.optString("athlete")
                .orEmpty()
                .ifBlank { "Atleta" }
        }

        val config = parseConfig(root.optJSONArray("trainingPlan"), athlete)
        val prescriptions = parsePrescriptions(root.optJSONArray("prescriptions"))
        val series = parseShotSeries(root.optJSONArray("shotSeries"))
        val targetSessions = parseTargetSessions(root.optJSONArray("targetSessions"))

        require(
            config != null ||
                    prescriptions.isNotEmpty() ||
                    series.isNotEmpty() ||
                    targetSessions.isNotEmpty()
        ) {
            "Arquivo sem dados validos para importar."
        }

        return Result(
            athlete = athlete,
            config = config,
            prescriptions = prescriptions,
            series = series,
            targetSessions = targetSessions
        )
    }

    private fun parseCsv(csvText: String): Result {
        val rows = csvText.lineSequence()
            .map { parseCsvLine(it) }
            .filter { it.any(String::isNotBlank) }
            .toList()

        require(rows.any { it.firstOrNull() == "indicator" && it.getOrNull(1) == CSV_INDICATOR }) {
            "CSV sem indicador SportsPerformance valido."
        }

        val athlete = rows.firstOrNull { it.firstOrNull() == "athlete" }
            ?.getOrNull(1)
            ?.ifBlank { null }
            ?: "Atleta"

        val headerIndex = rows.indexOfFirst { it.firstOrNull() == "cellKey" }
        require(headerIndex >= 0) { "CSV sem cabecalho de treinos." }

        val header = rows[headerIndex]
        val dataRows = rows.drop(headerIndex + 1)

        fun List<String>.value(name: String): String {
            val index = header.indexOf(name)
            return if (index >= 0) getOrNull(index).orEmpty() else ""
        }

        val prescriptions = dataRows.mapNotNull { row ->
            val title = row.value("trainingTitle").trim()
            if (title.isBlank()) return@mapNotNull null

            val cellKey = row.value("cellKey").ifBlank {
                "ADMIN_CSV_${row.value("day")}_${title.hashCode()}"
            }

            TrainingPlanPrescription(
                cellKey = cellKey,
                day = row.value("day").toIntOrNull() ?: 1,
                block = row.value("block").ifBlank { "Treino Admin" },
                code = row.value("code").ifBlank { "ADMIN" },
                trainingId = row.value("trainingId").ifBlank { cellKey },
                trainingTitle = title,
                prescribedByRole = row.value("prescribedByRole").ifBlank { "ADMIN_DESKTOP_CSV" },
                updatedAt = row.value("updatedAt").toLongOrNull() ?: System.currentTimeMillis()
            )
        }

        require(prescriptions.isNotEmpty()) { "CSV sem treinos para importar." }

        return Result(
            athlete = athlete,
            config = null,
            prescriptions = prescriptions,
            series = emptyList(),
            targetSessions = emptyList()
        )
    }

    private fun parseConfig(items: JSONArray?, athlete: String): TrainingPlanConfig? {
        if (items == null || items.length() == 0) return null
        val obj = items.optJSONObject(0) ?: return null

        return TrainingPlanConfig(
            id = obj.optString("id", "CURRENT_PLAN").ifBlank { "CURRENT_PLAN" },
            athlete = athlete,
            event = obj.optString("event", "ADMIN_EXPORT").ifBlank { "ADMIN_EXPORT" },
            session = normalizeSessionName(obj.optString("session", "TREINO").ifBlank { "TREINO" }),
            goal = obj.optInt("goal", 0),
            atPercent = obj.optInt("atPercent", 20),
            ptPercent = obj.optInt("ptPercent", 20),
            pPercent = obj.optInt("pPercent", 20),
            qPercent = obj.optInt("qPercent", 20),
            wPercent = obj.optInt("wPercent", 20)
        )
    }

    private fun parsePrescriptions(items: JSONArray?): List<TrainingPlanPrescription> {
        if (items == null) return emptyList()

        return buildList {
            for (index in 0 until items.length()) {
                val obj = items.optJSONObject(index) ?: continue
                val title = obj.optString("trainingTitle").trim()
                if (title.isBlank()) continue

                val cellKey = obj.optString("cellKey").ifBlank {
                    "ADMIN_JSON_${obj.optInt("day", index + 1)}_$index"
                }

                add(
                    TrainingPlanPrescription(
                        cellKey = cellKey,
                        day = obj.optInt("day", index + 1),
                        block = obj.optString("block", "Treino Admin").ifBlank { "Treino Admin" },
                        code = obj.optString("code", "ADMIN").ifBlank { "ADMIN" },
                        trainingId = obj.optString("trainingId", cellKey).ifBlank { cellKey },
                        trainingTitle = title,
                        prescribedByRole = obj.optString(
                            "prescribedByRole",
                            "ADMIN_DESKTOP_JSON"
                        ).ifBlank { "ADMIN_DESKTOP_JSON" },
                        updatedAt = obj.optLong("updatedAt", System.currentTimeMillis())
                    )
                )
            }
        }
    }

    private fun parseShotSeries(items: JSONArray?): List<ShotSeries> {
        if (items == null) return emptyList()

        return buildList {
            for (index in 0 until items.length()) {
                val obj = items.optJSONObject(index) ?: continue

                val tiros = obj.optString("tiros")
                    .split(",")
                    .mapNotNull { it.trim().toDoubleOrNull() }

                if (tiros.size != 10) continue

                val athlete = obj.optString("atleta").ifBlank { "ATLETA" }
                val prova = obj.optString("prova").ifBlank { "PISTOL" }
                val evento = obj.optString("evento").ifBlank { "ADMIN_EXPORT" }
                val sessao = normalizeSessionName(obj.optString("sessao").ifBlank { "TREINO" })
                val serie = obj.optString("serie").ifBlank { "SR${index + 1}" }
                val idBloco = obj.optString("idBloco").ifBlank {
                    "${athlete}_${evento}_${sessao}"
                }

                add(
                    ShotSeries(
                        chaveSerie = obj.optString("chaveSerie").ifBlank {
                            ShotSeries.createChave(
                                athlete,
                                prova,
                                evento,
                                sessao,
                                idBloco,
                                serie
                            )
                        },
                        dataColeta = Date(obj.optLong("dataColeta", System.currentTimeMillis())),
                        prova = prova,
                        atleta = athlete,
                        evento = evento,
                        sessao = sessao,
                        idBloco = idBloco,
                        statusEvento = obj.optString("statusEvento").ifBlank {
                            if (serie == "SR6") "FINAL" else "PARCIAL"
                        },
                        serie = serie,
                        tiros = tiros,
                        hciSerieOrder = obj.optInt(
                            "hciSerieOrder",
                            serie.filter { it.isDigit() }.toIntOrNull() ?: 1
                        )
                    )
                )
            }
        }
    }

    private fun parseTargetSessions(items: JSONArray?): List<TargetSession> {
        if (items == null) return emptyList()

        return buildList {
            for (index in 0 until items.length()) {
                val obj = items.optJSONObject(index) ?: continue

                val submittedAt = obj.optLong("submittedAt", System.currentTimeMillis())
                val athlete = obj.optString("athlete").ifBlank { "ATLETA" }
                val event = obj.optString("event").ifBlank { "ADMIN_EXPORT" }
                val session = normalizeSessionName(obj.optString("session").ifBlank { "TREINO" })
                val targetType = obj.optString("targetType").ifBlank { "TARGET" }

                add(
                    TargetSession(
                        sessionId = obj.optString("sessionId").ifBlank {
                            "${athlete}_${event}_${session}_${targetType}_$submittedAt"
                        },
                        athlete = athlete,
                        event = event,
                        session = session,
                        targetType = targetType,
                        totalShots = obj.optInt("totalShots", 0),
                        zoneLabels = obj.optString("zoneLabels")
                            .split("||")
                            .filter { it.isNotBlank() },
                        zoneCounts = obj.optString("zoneCounts")
                            .split(",")
                            .mapNotNull { it.trim().toIntOrNull() },
                        recommendedTraining = obj.optString("recommendedTraining"),
                        submittedAt = submittedAt
                    )
                )
            }
        }
    }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false
        var index = 0

        while (index < line.length) {
            val ch = line[index]

            if (ch == '"' && inQuotes && index + 1 < line.length && line[index + 1] == '"') {
                current.append('"')
                index++
            } else if (ch == '"') {
                inQuotes = !inQuotes
            } else if (ch == ',' && !inQuotes) {
                result.add(current.toString())
                current.clear()
            } else {
                current.append(ch)
            }

            index++
        }

        result.add(current.toString())
        return result
    }

    private fun normalizeSessionName(value: String): String {
        return value
            .trim()
            .uppercase()
            .replace("COMPETIÇÃO", "COMPETICAO")
    }
}