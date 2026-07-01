$outputPath = "C:\Users\clyns\AndroidStudioProjects\SportsPerformance\app\src\main\assets\training_library_canonical.json"

$phaseConfig = @{
    GENERAL_PREPARATION = @{ label = "General Preparation"; technicalTime = 50; technicalShots = 70; physicalTime = 35; physicalLoad = "base load" }
    SPECIFIC_PREPARATION = @{ label = "Specific Preparation"; technicalTime = 55; technicalShots = 80; physicalTime = 40; physicalLoad = "specific support" }
    PRE_COMPETITION = @{ label = "Pre Competition"; technicalTime = 45; technicalShots = 60; physicalTime = 30; physicalLoad = "taper support" }
    COMPETITION = @{ label = "Competition"; technicalTime = 30; technicalShots = 40; physicalTime = 20; physicalLoad = "maintenance / recovery" }
}

$parameterTemplates = @(
    @{ parameter = "OUTCOME"; technical = "Outcome Confirmation Block"; physical = "Endurance Support for Outcome Stability"; objective = "Sustain score intent under match structure."; physicalObjective = "Support stability and late-block efficiency."; },
    @{ parameter = "PROCESS"; technical = "Shot Routine Sequence Builder"; physical = "Neural Support for Process Control"; objective = "Lock routine checkpoints before release."; physicalObjective = "Improve motor readiness and repeatable setup."; },
    @{ parameter = "RHYTHM"; technical = "Cadence Stability Block"; physical = "Aerobic Rhythm Support"; objective = "Stabilize cadence and recovery after drops."; physicalObjective = "Support breathing rhythm and recovery capacity."; },
    @{ parameter = "DEEPENING"; technical = "Deepening Series Consolidation"; physical = "Core Endurance for Deepening"; objective = "Increase clean sequence depth without collapse."; physicalObjective = "Support trunk stability through long blocks."; },
    @{ parameter = "CONSISTENCY"; technical = "Repeatability Control Block"; physical = "Postural Consistency Support"; objective = "Repeat the same execution window shot after shot."; physicalObjective = "Support repeatable posture and hold."; },
    @{ parameter = "TRANSFER"; technical = "Transfer Under Variation"; physical = "Motor Transfer Circuit"; objective = "Transfer good execution across contexts and drills."; physicalObjective = "Integrate movement quality into shooting posture."; },
    @{ parameter = "RESILIENCE"; technical = "Reset and Recovery Drill"; physical = "Recovery Capacity Circuit"; objective = "Recover immediately after error or break."; physicalObjective = "Improve fatigue resistance and reset capacity."; },
    @{ parameter = "PRESSURE"; technical = "Pressure Simulation Drill"; physical = "Breath and Grip Pressure Control"; objective = "Execute under score pressure and time demand."; physicalObjective = "Control physiological pressure response."; },
    @{ parameter = "EMOTIONAL"; technical = "Emotional Regulation Shot Cycle"; physical = "Parasympathetic Reset Block"; objective = "Keep emotional tone neutral during execution."; physicalObjective = "Downregulate tension and restore control."; },
    @{ parameter = "PHYSICAL"; technical = "Posture and Hold Technical Integration"; physical = "Core and Shoulder Stability"; objective = "Integrate posture, hold and technical alignment."; physicalObjective = "Build core, shoulder and balance support for shooting."; }
)

$entries = foreach ($template in $parameterTemplates) {
    foreach ($phaseName in $phaseConfig.Keys) {
        $phase = $phaseConfig[$phaseName]

        [pscustomobject]@{
            trainingId = "TECH_$($template.parameter)_$phaseName"
            parameter = $template.parameter
            phase = $phaseName
            trainingType = "TECHNICAL"
            category = "TECHNICAL"
            weaponClass = "PISTOL/RIFLE"
            language = "pt-BR"
            active = $true
            name = "$($template.technical) - $($phase.label)"
            objective = $template.objective
            description = "Technical prescription for $($template.parameter) during $($phase.label). Use one primary session for this parameter in the current phase."
            defaultTime = $phase.technicalTime
            defaultShots = $phase.technicalShots
            loadNote = "technical emphasis"
            source = "canonical_v1"
        }

        [pscustomobject]@{
            trainingId = "PHYS_$($template.parameter)_$phaseName"
            parameter = $template.parameter
            phase = $phaseName
            trainingType = "PHYSICAL"
            category = "PHYSICAL"
            weaponClass = "PISTOL/RIFLE"
            language = "pt-BR"
            active = $true
            name = "$($template.physical) - $($phase.label)"
            objective = $template.physicalObjective
            description = "Physical support package for $($template.parameter) during $($phase.label). Use one primary physical session for this parameter in the current phase."
            defaultTime = $phase.physicalTime
            defaultShots = 0
            loadNote = $phase.physicalLoad
            source = "canonical_v1"
        }
    }
}

$payload = [pscustomobject]@{
    version = 1
    updatedAt = (Get-Date).ToString("s")
    designRule = "One technical and one physical training per parameter and periodization phase."
    parameters = $parameterTemplates.parameter
    phases = @($phaseConfig.Keys)
    entries = $entries
}

$json = $payload | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote canonical library to $outputPath"
