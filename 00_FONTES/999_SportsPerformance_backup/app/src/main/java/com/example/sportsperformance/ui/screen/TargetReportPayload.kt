package com.example.sportsperformance.ui.screen

import com.example.sportsperformance.data.model.AppLanguage

data class TargetReportPayload(
    val reportTitle: String,
    val athleteName: String,
    val eventLabel: String,
    val sessionLabel: String,
    val language: AppLanguage,
    val targetType: String,
    val totalShots: Int,
    val percentages: List<Pair<String, Int>>,
    val officialMetrics: List<Pair<String, String>>,
    val directionalRows: List<List<String>>,
    val insights: List<String>,
    val trainingTitle: String,
    val trainingDescription: String,
    val keyPhrase: String
)
