package com.example.sportsperformance.ui.screen

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.example.sportsperformance.R
import com.example.sportsperformance.ui.theme.HciAccentBlue
import com.example.sportsperformance.ui.viewmodel.HciViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HciScreenTopBar(
    title: String,
    viewModel: HciViewModel,
    actions: @Composable () -> Unit = {}
) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = { viewModel.navigateTo("DASHBOARD") }) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color.White, RoundedCornerShape(8.dp))
                        .padding(3.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_hci_app),
                        contentDescription = "Voltar para o início",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        },
        actions = { actions() }
    )
}
