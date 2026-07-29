param(
  [Parameter(Mandatory = $true)] [string]$WorkbookPath,
  [Parameter(Mandatory = $true)] [string]$CapturePlanPath,
  [Parameter(Mandatory = $true)] [string]$OutputDir,
  [Parameter(Mandatory = $true)] [string]$ResultPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

function New-CaptureResult {
  param(
    [string]$WorksheetName,
    [string]$Status,
    [string]$CaptureRange,
    [string]$OutputFile,
    [string]$ErrorMessage
  )
  return [pscustomobject]@{
    worksheetName = $WorksheetName
    status = $Status
    captureRange = $CaptureRange
    outputFile = $OutputFile
    error = $ErrorMessage
  }
}

[void][System.IO.Directory]::CreateDirectory($OutputDir)
$resolvedOutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

$plan = Get-Content -LiteralPath $CapturePlanPath -Raw | ConvertFrom-Json -Depth 20
if (-not $plan -or -not $plan.captures) {
  throw "Capture plan is empty."
}

$excel = $null
$workbook = $null
$results = New-Object System.Collections.Generic.List[object]

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $true
  $excel.DisplayAlerts = $false
  $excel.ScreenUpdating = $true

  $resolvedWorkbookPath = (Resolve-Path -LiteralPath $WorkbookPath).Path
  $workbook = $excel.Workbooks.Open($resolvedWorkbookPath, $null, $true)

  foreach ($capture in $plan.captures) {
    $worksheetName = [string]$capture.worksheetName
    $captureRange = if ($capture.captureRange) { [string]$capture.captureRange } else { "A1:Z120" }
    $fileName = if ($capture.fileName) { [string]$capture.fileName } else { "$worksheetName.png" }
    $outputPath = Join-Path -Path $resolvedOutputDir -ChildPath $fileName

    try {
      $sheet = $workbook.Worksheets.Item($worksheetName)
      [void]$sheet.Activate()
      [System.Windows.Forms.Application]::DoEvents()

      $range = $sheet.Range($captureRange)
      [void]$range.CopyPicture(1, 2)
      [System.Windows.Forms.Application]::DoEvents()
      $clipboardImage = [System.Windows.Forms.Clipboard]::GetImage()
      if ($null -eq $clipboardImage) {
        throw "composed snapshot clipboard image is empty"
      }
      try {
        $clipboardImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $clipboardImage.Dispose()
      }

      if (-not (Test-Path -LiteralPath $outputPath)) {
        throw "composed snapshot export produced no file"
      }
      $length = (Get-Item -LiteralPath $outputPath).Length
      if ($length -le 0) {
        Remove-Item -LiteralPath $outputPath -Force -ErrorAction SilentlyContinue
        throw "composed snapshot export produced an empty file"
      }

      $results.Add((New-CaptureResult -WorksheetName $worksheetName -Status "ok" -CaptureRange $captureRange -OutputFile $fileName -ErrorMessage ""))
    } catch {
      $results.Add((New-CaptureResult -WorksheetName $worksheetName -Status "failed" -CaptureRange $captureRange -OutputFile $fileName -ErrorMessage $_.Exception.Message))
    }
  }
} finally {
  if ($workbook) { $workbook.Close($false) }
  if ($excel) { $excel.Quit() }
  if ($workbook) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
  if ($excel) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$payload = [pscustomobject]@{ captures = $results }
$payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
