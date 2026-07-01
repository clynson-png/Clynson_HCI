package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.viewmodel.HciViewModel

@Composable
fun PremiumLockedFeatureScreen(
    viewModel: HciViewModel,
    titlePt: String,
    titleEn: String,
    tierLabel: String,
    headlinePt: String,
    headlineEn: String,
    bodyPt: String,
    bodyEn: String
) {
    val appLanguage by viewModel.appLanguage.collectAsState()
    val title = if (appLanguage == AppLanguage.PT) titlePt else titleEn
    val headline = if (appLanguage == AppLanguage.PT) headlinePt else headlineEn
    val body = if (appLanguage == AppLanguage.PT) bodyPt else bodyEn

    Scaffold(
        topBar = { HciScreenTopBar(title = title, viewModel = viewModel) },
        bottomBar = { HciBottomNavigation(viewModel) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(HciBackground)
                .padding(16.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.Transparent),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x66F8D24A))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF111827))
                            ),
                            RoundedCornerShape(18.dp)
                        )
                        .padding(22.dp)
                ) {
                    Text(title, color = Color(0xFFF8FAFC), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(12.dp))
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFF8D24A))
                        Text(tierLabel, color = Color(0xFFF8D24A), fontWeight = FontWeight.Bold)
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFF8D24A))
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(headline, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(body, color = Color(0xCCFFFFFF), fontSize = 13.sp, lineHeight = 20.sp)
                }
            }
        }
    }
}
