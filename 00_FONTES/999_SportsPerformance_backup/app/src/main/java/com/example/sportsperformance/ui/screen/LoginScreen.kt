package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.sportsperformance.R
import com.example.sportsperformance.data.model.AppLanguage
import com.example.sportsperformance.data.model.SubscriptionTier
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.theme.HciBackground
import com.example.sportsperformance.ui.theme.HciCardBorder
import com.example.sportsperformance.ui.theme.HciPrimaryDark
import com.example.sportsperformance.ui.theme.HciPrimaryLight
import com.example.sportsperformance.ui.theme.HciTextPrimary
import com.example.sportsperformance.ui.theme.HciTextSecondary
import com.example.sportsperformance.ui.viewmodel.HciViewModel

@Composable
fun LoginScreen(viewModel: HciViewModel) {
    val avatars = viewModel.availableLoginAthletes
    val selectedLanguage by viewModel.appLanguage.collectAsState()
    var athleteName by remember { mutableStateOf("") }
    var athleteEmail by remember { mutableStateOf("") }
    var selectedAvatarRes by remember { mutableIntStateOf(avatars.first().avatarRes) }
    var selectedTier by remember { mutableStateOf(SubscriptionTier.GOLD) }
    val emailRegex = remember { Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$") }
    val normalizedName = athleteName.trim()
    val normalizedEmail = athleteEmail.trim()
    val isEmailValid = normalizedEmail.matches(emailRegex)
    val canEnter = normalizedName.isNotBlank() && isEmailValid

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(HciBackground)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .padding(4.dp),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_hci_app),
                    contentDescription = "HCI Logo",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            }
            Spacer(modifier = Modifier.size(12.dp))
            Column {
                Text("SPORTS PERFORMANCE", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = HciTextPrimary)
                Text(
                    if (selectedLanguage == AppLanguage.PT) "HCI Performance Intelligence" else "HCI Performance Intelligence",
                    fontSize = 13.sp,
                    color = HciTextSecondary
                )
            }
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, HciCardBorder)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(if (selectedLanguage == AppLanguage.PT) "Idioma" else "Language", fontWeight = FontWeight.Bold, color = HciAccentBlue)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                ) {
                    AppLanguage.entries.forEach { language ->
                        FilterChip(
                            selected = language == selectedLanguage,
                            onClick = { viewModel.setAppLanguage(language) },
                            label = { Text(if (language == AppLanguage.PT) "Português" else "English", fontSize = 11.sp) }
                        )
                    }
                }

                Text(if (selectedLanguage == AppLanguage.PT) "Nome" else "Name", fontWeight = FontWeight.Bold, color = HciAccentBlue)
                OutlinedTextField(
                    value = athleteName,
                    onValueChange = { athleteName = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text(if (selectedLanguage == AppLanguage.PT) "Ex.: Paulo Henrique" else "Ex.: Paul Henderson") }
                )

                Text(if (selectedLanguage == AppLanguage.PT) "Email" else "Email", fontWeight = FontWeight.Bold, color = HciAccentBlue)
                OutlinedTextField(
                    value = athleteEmail,
                    onValueChange = { athleteEmail = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = normalizedEmail.isNotEmpty() && !isEmailValid,
                    placeholder = { Text(if (selectedLanguage == AppLanguage.PT) "Ex.: paulo@hci.com.br" else "Ex.: paul@hci.com") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    supportingText = {
                        Text(
                            if (normalizedEmail.isEmpty() || isEmailValid) {
                                if (selectedLanguage == AppLanguage.PT) "Digite seu email para acessar o painel."
                                else "Enter your email to access the dashboard."
                            } else {
                                if (selectedLanguage == AppLanguage.PT) "Digite um email válido para liberar a entrada."
                                else "Enter a valid email to continue."
                            }
                        )
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = HciAccentBlue,
                        unfocusedBorderColor = HciCardBorder,
                        errorBorderColor = Color(0xFFDC2626)
                    )
                )

                Text(if (selectedLanguage == AppLanguage.PT) "Assinatura" else "Plan", fontWeight = FontWeight.Bold, color = HciAccentBlue)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                ) {
                    SubscriptionTier.entries.forEach { tier ->
                        FilterChip(
                            selected = tier == selectedTier,
                            onClick = { selectedTier = tier },
                            label = { Text(tier.name, fontSize = 11.sp) }
                        )
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (selectedLanguage == AppLanguage.PT) "Escolha seu avatar" else "Choose avatar", color = HciAccentBlue, fontWeight = FontWeight.Bold)
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
            ) {
                avatars.forEach { avatar ->
                    Box(
                        modifier = Modifier
                            .size(76.dp)
                            .clip(CircleShape)
                            .background(if (avatar.avatarRes == selectedAvatarRes) HciAccentBlue else Color.White)
                            .clickable { 
                                selectedAvatarRes = avatar.avatarRes
                                selectedTier = avatar.defaultTier
                            }
                            .padding(4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = avatar.avatarRes),
                            contentDescription = null,
                            modifier = Modifier
                                .size(68.dp)
                                .clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    }
                }
            }
        }
        val safeAvatarRes = if (selectedAvatarRes != 0) selectedAvatarRes else R.drawable.ic_hci_app
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.horizontalGradient(listOf(HciPrimaryDark, HciPrimaryLight)))
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Image(
                        painter = painterResource(id = safeAvatarRes),
                        contentDescription = null,
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                    Column {
                        Text(athleteName.ifBlank { if (selectedLanguage == AppLanguage.PT) "Seu atleta" else "Your athlete" }, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text(
                            if (selectedLanguage == AppLanguage.PT) "Plano ${selectedTier.name}" else "${selectedTier.name} plan",
                            color = Color(0xCCFFFFFF),
                            fontSize = 12.sp
                        )
                        if (athleteEmail.isNotBlank()) {
                            Text(athleteEmail.trim(), color = Color(0xCCFFFFFF), fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = { viewModel.completeLogin(normalizedName, normalizedEmail, selectedAvatarRes, selectedTier, selectedLanguage) },
            enabled = canEnter,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = HciAccentBlue)
        ) {
            Text(if (selectedLanguage == AppLanguage.PT) "Entrar no painel" else "Enter dashboard", fontWeight = FontWeight.Bold)
        }
    }
}
