package com.example.sportsperformance

import android.os.Bundle
import android.graphics.Color
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.example.sportsperformance.ui.screen.CoachReportScreen
import com.example.sportsperformance.ui.screen.HciDashboardScreen
import com.example.sportsperformance.ui.screen.LoginScreen
import com.example.sportsperformance.ui.screen.ShotEntryScreen
import com.example.sportsperformance.ui.screen.TrainingPlanScreen
import com.example.sportsperformance.ui.screen.admin.TrainingAdminScreen
import com.example.sportsperformance.ui.theme.SportsPerformanceTheme
import com.example.sportsperformance.ui.viewmodel.HciViewModel
import com.example.sportsperformance.ui.viewmodel.HciViewModelFactory

class MainActivity : ComponentActivity() {
    
    private val hciViewModel: HciViewModel by viewModels {
        HciViewModelFactory((application as SportsPerformanceApplication).repository)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.rgb(242, 246, 252)))
        setContent {
            SportsPerformanceTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    val currentScreen by hciViewModel.currentScreen.collectAsState()
                    val isLoggedIn by hciViewModel.isLoggedIn.collectAsState()

                    BackHandler(enabled = (currentScreen != "DASHBOARD") && (currentScreen != "LOGIN")) {
                        hciViewModel.navigateTo("DASHBOARD")
                    }
                    
                    if (!isLoggedIn) {
                        LoginScreen(hciViewModel)
                    } else {
                        when (currentScreen) {
                            "LOGIN" -> HciDashboardScreen(hciViewModel)
                            "DASHBOARD" -> HciDashboardScreen(hciViewModel)
                            "PLAN" -> TrainingPlanScreen(hciViewModel)
                            "ENTRY" -> ShotEntryScreen(hciViewModel)
                            "REPORT" -> CoachReportScreen(hciViewModel)
                            "ADMIN" -> TrainingAdminScreen(hciViewModel)
                            else -> HciDashboardScreen(hciViewModel)
                        }
                    }
                }
            }
        }
    }
}
