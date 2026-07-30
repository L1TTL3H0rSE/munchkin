[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$bucketKey = 'tests/state-lock/terraform.tfstate'
$expectedPlanPattern =
    'Plan:\s+1 to add,\s+0 to change,\s+0 to destroy'
$workerCount = 4

if (
    [string]::IsNullOrWhiteSpace($env:AWS_ACCESS_KEY_ID) -or
    [string]::IsNullOrWhiteSpace($env:AWS_SECRET_ACCESS_KEY)
) {
    throw 'AWS backend credentials are missing from the process environment.'
}

$terraformCommand = Get-Command terraform -ErrorAction Stop
$terraformExecutable = $terraformCommand.Source
$testRoot = [IO.Path]::GetFullPath($PSScriptRoot)

$oldTfDataDir = [Environment]::GetEnvironmentVariable(
    'TF_DATA_DIR',
    'Process'
)

$tempRoot = [IO.Path]::GetFullPath(
    [IO.Path]::Combine(
        [IO.Path]::GetTempPath(),
        'munchkin-tf-race-' + [Guid]::NewGuid().ToString('N')
    )
)
$tempParent = [IO.Path]::GetFullPath(
    [IO.Path]::GetTempPath()
).TrimEnd(
    [char[]]@(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
)
$tempPrefix = $tempParent + [IO.Path]::DirectorySeparatorChar
$tempLeaf = [IO.Path]::GetFileName($tempRoot)

if (
    -not $tempRoot.StartsWith(
        $tempPrefix,
        [StringComparison]::OrdinalIgnoreCase
    ) -or
    $tempLeaf -notmatch '^munchkin-tf-race-[0-9a-f]{32}$'
) {
    throw 'Refusing to use an unsafe temporary directory.'
}

$workerDataDirs = @()
$workers = @()

try {
    [void](New-Item -ItemType Directory -Path $tempRoot)

    for ($workerIndex = 1; $workerIndex -le $workerCount; $workerIndex++) {
        $workerDataDir = Join-Path $tempRoot "worker-$workerIndex"
        [void](New-Item -ItemType Directory -Path $workerDataDir)
        $workerDataDirs += $workerDataDir

        $env:TF_DATA_DIR = $workerDataDir
        $initOutput = @(
            & $terraformExecutable `
                "-chdir=$testRoot" `
                init `
                -reconfigure `
                -input=false `
                -no-color 2>&1
        )
        $initExitCode = $LASTEXITCODE

        if ($initExitCode -ne 0) {
            throw (
                'Worker {0} init failed with exit {1}; output hidden.' -f
                $workerIndex,
                $initExitCode
            )
        }
    }

    Write-Host "race_init=$workerCount"

    for ($workerIndex = 1; $workerIndex -le $workerCount; $workerIndex++) {
        $startInfo = [Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $terraformExecutable
        $startInfo.WorkingDirectory = $testRoot
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $startInfo.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
        $startInfo.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
        $startInfo.Environment['TF_DATA_DIR'] =
            $workerDataDirs[$workerIndex - 1]

        [void]$startInfo.ArgumentList.Add("-chdir=$testRoot")
        [void]$startInfo.ArgumentList.Add('plan')
        [void]$startInfo.ArgumentList.Add('-input=false')
        [void]$startInfo.ArgumentList.Add('-lock-timeout=0s')
        [void]$startInfo.ArgumentList.Add('-detailed-exitcode')
        [void]$startInfo.ArgumentList.Add('-no-color')

        $process = [Diagnostics.Process]::new()
        $process.StartInfo = $startInfo

        if (-not $process.Start()) {
            throw "Worker $workerIndex did not start."
        }

        $workers += [pscustomobject]@{
            Index      = $workerIndex
            Process    = $process
            StdOutTask = $process.StandardOutput.ReadToEndAsync()
            StdErrTask = $process.StandardError.ReadToEndAsync()
        }
    }

    $results = @()

    foreach ($worker in $workers) {
        $worker.Process.WaitForExit()
        $standardOutput = $worker.StdOutTask.GetAwaiter().GetResult()
        $standardError = $worker.StdErrTask.GetAwaiter().GetResult()
        $combinedOutput = $standardOutput + "`n" + $standardError
        $exitCode = $worker.Process.ExitCode

        $planned = (
            $exitCode -eq 2 -and
            $combinedOutput -match $expectedPlanPattern
        )
        $blocked = (
            $exitCode -eq 1 -and
            $combinedOutput -match 'Error acquiring the state lock'
        )

        $outcome = if ($planned) {
            'planned'
        }
        elseif ($blocked) {
            'blocked'
        }
        else {
            'unexpected'
        }

        Write-Host "race_worker_$($worker.Index)=$outcome"

        $results += [pscustomobject]@{
            Index   = $worker.Index
            Exit    = $exitCode
            Planned = $planned
            Blocked = $blocked
        }
    }

    $plannedCount = @($results | Where-Object Planned).Count
    $blockedCount = @($results | Where-Object Blocked).Count
    $unexpectedCount = @(
        $results |
            Where-Object { -not $_.Planned -and -not $_.Blocked }
    ).Count

    Write-Host "race_planned_count=$plannedCount"
    Write-Host "race_blocked_count=$blockedCount"

    if (
        $plannedCount -lt 1 -or
        $blockedCount -lt 1 -or
        $unexpectedCount -ne 0
    ) {
        throw (
            'Concurrent lock proof failed for {0}: planned={1}, ' +
            'blocked={2}, unexpected={3}.'
        ) -f $bucketKey, $plannedCount, $blockedCount, $unexpectedCount
    }

    $env:TF_DATA_DIR = $workerDataDirs[0]
    $releaseOutput = @(
        & $terraformExecutable `
            "-chdir=$testRoot" `
            plan `
            -input=false `
            -lock-timeout=10s `
            -detailed-exitcode `
            -no-color 2>&1
    )
    $releaseExitCode = $LASTEXITCODE
    $releaseText = $releaseOutput -join "`n"

    if (
        $releaseExitCode -ne 2 -or
        $releaseText -notmatch $expectedPlanPattern
    ) {
        throw (
            'Post-race lock release check failed with exit {0}; ' +
            'output hidden.'
        ) -f $releaseExitCode
    }

    Write-Host "lock_release_plan_exit=$releaseExitCode"
    Write-Host 'concurrent_lock_cycle=ok'
}
finally {
    foreach ($worker in $workers) {
        if (-not $worker.Process.HasExited) {
            $worker.Process.WaitForExit()
        }

        $worker.Process.Dispose()
    }

    if ($null -eq $oldTfDataDir) {
        Remove-Item Env:TF_DATA_DIR -ErrorAction SilentlyContinue
    }
    else {
        $env:TF_DATA_DIR = $oldTfDataDir
    }

    $resolvedTempRoot = [IO.Path]::GetFullPath($tempRoot)
    $resolvedTempLeaf = [IO.Path]::GetFileName($resolvedTempRoot)

    if (
        $resolvedTempRoot.StartsWith(
            $tempPrefix,
            [StringComparison]::OrdinalIgnoreCase
        ) -and
        $resolvedTempLeaf -match '^munchkin-tf-race-[0-9a-f]{32}$' -and
        (Test-Path -LiteralPath $resolvedTempRoot)
    ) {
        Remove-Item `
            -LiteralPath $resolvedTempRoot `
            -Recurse `
            -Force
    }
}
