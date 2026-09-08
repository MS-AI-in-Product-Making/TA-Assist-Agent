[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NpmInstall {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = @(& npm.cmd @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = ($output | Out-String)
    }
}

function Test-RegistryProxyNotFound {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Output
    )

    return $Output -match "packagefeedproxy\.microsoft\.io" -and $Output -match "E404|404 Not Found"
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot

try {
    foreach ($command in @("node", "npm.cmd")) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Required command '$command' is unavailable. Install the approved Node.js toolchain and retry."
        }
    }

    if (-not (Test-Path -LiteralPath "package-lock.json" -PathType Leaf)) {
        throw "package-lock.json is required for reproducible environment preparation."
    }

    Write-Host "Node: $(& node --version)"
    Write-Host "npm: $(& npm.cmd --version)"
    Write-Host "Installing locked dependencies with the configured npm registry..."

    $ciArguments = @("ci", "--ignore-scripts", "--no-audit", "--no-fund")
    $install = Invoke-NpmInstall -Arguments $ciArguments
    if ($install.ExitCode -ne 0) {
        $isLockfileOutOfSync = $install.Output -match "EUSAGE" -and $install.Output -match "package\.json and package-lock\.json.*in sync"
        if ($isLockfileOutOfSync) {
            Write-Host "The package manifests and lockfile are out of sync. Refreshing lockfile metadata without running lifecycle scripts..."
            $lockfileSync = Invoke-NpmInstall -Arguments @("install", "--package-lock-only", "--ignore-scripts")
            if (Test-RegistryProxyNotFound -Output $lockfileSync.Output) {
                $lockfileSync = Invoke-NpmInstall -Arguments @(
                    "install",
                    "--package-lock-only",
                    "--ignore-scripts",
                    "--registry=https://registry.npmjs.org/",
                    "--replace-registry-host=never"
                )
            }
            if ($lockfileSync.ExitCode -ne 0) {
                throw "Lockfile metadata synchronization failed with exit code $($lockfileSync.ExitCode)."
            }

            $install = Invoke-NpmInstall -Arguments $ciArguments
        }

        if ($install.ExitCode -ne 0 -and -not (Test-RegistryProxyNotFound -Output $install.Output)) {
            throw "npm ci failed with exit code $($install.ExitCode). The failure did not match an approved automatic recovery condition."
        }

        if ($install.ExitCode -ne 0) {
            Write-Host "The configured package proxy returned 404. Retrying this install against npmjs without changing npm configuration..."
            $install = Invoke-NpmInstall -Arguments ($ciArguments + @(
                "--registry=https://registry.npmjs.org/",
                "--replace-registry-host=never"
            ))
            if ($install.ExitCode -ne 0) {
                throw "npm ci recovery failed with exit code $($install.ExitCode)."
            }
        }
    }

    Write-Host "Verifying the repository build..."
    & npm.cmd run build -- --force
    if ($LASTEXITCODE -ne 0) {
        throw "Repository build verification failed with exit code $LASTEXITCODE."
    }

    Write-Host "Environment bootstrap completed successfully."
}
finally {
    Pop-Location
}