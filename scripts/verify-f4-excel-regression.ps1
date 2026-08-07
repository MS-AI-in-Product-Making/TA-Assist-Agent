param(
  [string]$WorkbookPath,
  [string]$ExpectedSha256,
  [string]$WorksheetName,
  [string]$MappingPath,
  [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Variable -Name DefaultTolerance -Value 1e-12 -Option Constant -Scope Script
Set-Variable -Name MaximumTolerance -Value 1e-12 -Option Constant -Scope Script
Set-Variable -Name MaximumMappingBytes -Value 1MB -Option Constant -Scope Script
Set-Variable -Name MaximumMappingItems -Value 100 -Option Constant -Scope Script
Set-Variable -Name MaximumNameLength -Value 128 -Option Constant -Scope Script
Set-Variable -Name MaximumStringLength -Value 1024 -Option Constant -Scope Script
Set-Variable -Name MaximumFormulaIdLength -Value 128 -Option Constant -Scope Script
Set-Variable -Name MaximumFormulaLength -Value 4096 -Option Constant -Scope Script
Set-Variable -Name MaximumFormulaFallbackCells -Value 10000 -Option Constant -Scope Script

function Write-Json {
  param([Parameter(Mandatory = $true)] [object]$Payload)
  Write-Output ($Payload | ConvertTo-Json -Depth 20 -Compress)
}

function New-StatusException {
  param(
    [Parameter(Mandatory = $true)] [string]$Status,
    [Parameter(Mandatory = $true)] [string]$Message,
    [object]$Payload
  )
  $exception = [System.InvalidOperationException]::new($Message)
  $exception.Data["IsStatusException"] = $true
  $exception.Data["Status"] = $Status
  if ($null -ne $Payload) {
    $exception.Data["Payload"] = $Payload
  }
  return $exception
}

function Assert-ExactProperties {
  param(
    [Parameter(Mandatory = $true)] [object]$Value,
    [Parameter(Mandatory = $true)] [string[]]$Allowed,
    [Parameter(Mandatory = $true)] [string]$Location
  )
  if ($Value -isnot [pscustomobject]) {
    throw (New-StatusException -Status "invalid_mapping" -Message "$Location must be an object.")
  }
  foreach ($property in $Value.PSObject.Properties.Name) {
    if ($property -cnotin $Allowed) {
      throw (New-StatusException -Status "invalid_mapping" -Message "$Location contains an unknown field.")
    }
  }
  foreach ($property in $Allowed) {
    if ($property -in @("tolerance")) { continue }
    if ($property -cnotin $Value.PSObject.Properties.Name) {
      throw (New-StatusException -Status "invalid_mapping" -Message "$Location is missing a required field.")
    }
  }
}

function Test-JsonNumber {
  param([object]$Value)
  if ($null -eq $Value -or $Value -is [bool]) { return $false }
  $typeCode = [System.Type]::GetTypeCode($Value.GetType())
  if ($typeCode -notin @(
      [System.TypeCode]::Byte, [System.TypeCode]::SByte,
      [System.TypeCode]::Int16, [System.TypeCode]::UInt16,
      [System.TypeCode]::Int32, [System.TypeCode]::UInt32,
      [System.TypeCode]::Int64, [System.TypeCode]::UInt64,
      [System.TypeCode]::Single, [System.TypeCode]::Double,
      [System.TypeCode]::Decimal
    )) { return $false }
  $number = [double]$Value
  return -not ([double]::IsNaN($number) -or [double]::IsInfinity($number))
}

function Test-A1Address {
  param([object]$Value)
  if ($Value -isnot [string] -or $Value -cnotmatch '^([A-Za-z]{1,3})([1-9][0-9]{0,6})$') {
    return $false
  }
  $columnNumber = 0
  foreach ($character in $Matches[1].ToUpperInvariant().ToCharArray()) {
    $columnNumber = ($columnNumber * 26) + ([int]$character - [int][char]'A' + 1)
  }
  $rowNumber = [int]$Matches[2]
  return $columnNumber -le 16384 -and $rowNumber -le 1048576
}

function Assert-ScalarValue {
  param(
    [object]$Value,
    [string]$Location,
    [switch]$RejectFormulaPrefix
  )
  if ($Value -is [string]) {
    if ($Value.Length -gt $script:MaximumStringLength -or $Value -match '[\x00\r\n]') {
      throw (New-StatusException -Status "invalid_mapping" -Message "$Location contains invalid text.")
    }
    if ($RejectFormulaPrefix -and $Value.TrimStart() -match '^[=+\-@]') {
      throw (New-StatusException -Status "invalid_mapping" -Message "$Location contains invalid text.")
    }
    return
  }
  if (Test-JsonNumber -Value $Value) { return }
  throw (New-StatusException -Status "invalid_mapping" -Message "$Location must be a number or string.")
}

function Assert-ControlledString {
  param(
    [object]$Value,
    [string]$Location,
    [int]$MaximumLength,
    [string]$Status = "invalid_mapping",
    [switch]$AllowEmpty
  )
  if ($Value -isnot [string]) {
    throw (New-StatusException -Status $Status -Message "$Location must be a string.")
  }
  if ($Value.Length -gt $MaximumLength -or $Value -match '[\x00\r\n]') {
    throw (New-StatusException -Status $Status -Message "$Location contains invalid text.")
  }
  if (-not $AllowEmpty -and [string]::IsNullOrWhiteSpace($Value)) {
    throw (New-StatusException -Status $Status -Message "$Location must be a non-empty string.")
  }
}

function Assert-Mapping {
  param([Parameter(Mandatory = $true)] [object]$Mapping)

  Assert-ExactProperties -Value $Mapping -Allowed @("version", "inputs", "outputs") -Location "mapping"
  if ($Mapping.version -isnot [string] -or $Mapping.version -cne "excel-ta-v1") {
    throw (New-StatusException -Status "invalid_mapping" -Message "mapping version must be excel-ta-v1.")
  }
  if ($Mapping.inputs -isnot [array]) {
    throw (New-StatusException -Status "invalid_mapping" -Message "mapping inputs must be an array.")
  }
  if ($Mapping.inputs.Count -gt $script:MaximumMappingItems) {
    throw (New-StatusException -Status "invalid_mapping" -Message "mapping inputs exceeds the item limit.")
  }
  if ($Mapping.outputs -isnot [array] -or $Mapping.outputs.Count -eq 0) {
    throw (New-StatusException -Status "invalid_mapping" -Message "mapping outputs must be a non-empty array.")
  }
  if ($Mapping.outputs.Count -gt $script:MaximumMappingItems) {
    throw (New-StatusException -Status "invalid_mapping" -Message "mapping outputs exceeds the item limit.")
  }

  $cells = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($inputItem in $Mapping.inputs) {
    Assert-ExactProperties -Value $inputItem -Allowed @("cell", "value") -Location "mapping input"
    if (-not (Test-A1Address -Value $inputItem.cell)) {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping input contains an invalid A1 cell.")
    }
    Assert-ScalarValue -Value $inputItem.value -Location "mapping input value" -RejectFormulaPrefix
    if (-not $cells.Add([string]$inputItem.cell)) {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping contains a duplicate cell.")
    }
  }

  $names = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($outputItem in $Mapping.outputs) {
    Assert-ExactProperties -Value $outputItem -Allowed @("name", "cell", "expected", "tolerance", "formulaId") -Location "mapping output"
    if ($outputItem.name -isnot [string] -or [string]::IsNullOrWhiteSpace($outputItem.name) -or
      $outputItem.name.Length -gt $script:MaximumNameLength -or $outputItem.name -match '[\x00\r\n]') {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping output name must be a non-empty string.")
    }
    if (-not $names.Add([string]$outputItem.name)) {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping contains a duplicate output name.")
    }
    if (-not (Test-A1Address -Value $outputItem.cell)) {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping output contains an invalid A1 cell.")
    }
    if (-not $cells.Add([string]$outputItem.cell)) {
      throw (New-StatusException -Status "invalid_mapping" -Message "mapping contains a duplicate cell.")
    }
    Assert-ScalarValue -Value $outputItem.expected -Location "mapping output expected value"
    Assert-ControlledString -Value $outputItem.formulaId -Location "mapping output formulaId" -MaximumLength $script:MaximumFormulaIdLength
    if ("tolerance" -in $outputItem.PSObject.Properties.Name) {
      if (-not (Test-JsonNumber -Value $outputItem.tolerance) -or
          [double]$outputItem.tolerance -lt 0 -or
          [double]$outputItem.tolerance -gt $script:MaximumTolerance) {
        throw (New-StatusException -Status "invalid_mapping" -Message "mapping output tolerance must be between 0 and 1e-12.")
      }
    }
  }
}

function Release-ComObject {
  param([object]$Value)
  if ($null -ne $Value -and [Runtime.InteropServices.Marshal]::IsComObject($Value)) {
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($Value)
  }
}

function Test-FormulaOptionalMetric {
  param([string]$MetricName)
  return $MetricName -ceq "system.additionalMeanShift"
}

function Test-FormulaEvidenceSafe {
  param([string]$FormulaText)
    return $FormulaText -cnotmatch '(?i)([A-Za-z]:[\\/]|\\\\|\.\.[\\/]|(https?|file)://|["''](?!(?:Note):)[A-Za-z][A-Za-z0-9+.-]*:|\[[^\]]+\][^!]*!|\b(WEBSERVICE|RTD)\s*\(|\|[^!]*!|(password|secret|token|api[_ -]?key)\s*[=:])'
}

function Assert-FormulaEvidenceSafe {
  param([object]$FormulaValue)
  Assert-ControlledString -Value $FormulaValue -Location "workbook formula" -MaximumLength $script:MaximumFormulaLength -Status "excel_error"
  if ($FormulaValue -match '[\x00-\x1F\x7F]') {
    throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence is indeterminate.")
  }
  if (-not (Test-FormulaEvidenceSafe -FormulaText $FormulaValue)) {
    throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence is not safe to execute.")
  }
}

function Assert-UsedRangeFormulasSafeByCell {
  param([Parameter(Mandatory = $true)] [object]$UsedRange)

  $cells = $null
  $after = $null
  $current = $null
  try {
    $cells = $UsedRange.Cells
    $after = $cells.Item(1, 1)
    $current = $UsedRange.Find("=*", $after, -4123, 2, 1, 1, $false, $false, $false)
    Release-ComObject -Value $after
    $after = $null
    if ($null -eq $current) {
      throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence is indeterminate.")
    }

    $firstAddress = [string]$current.Address()
    $formulaCount = 0
    while ($null -ne $current) {
      $formulaCount++
      if ($formulaCount -gt $script:MaximumFormulaFallbackCells) {
        throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence could not be bounded.")
      }
      if ($current.HasFormula -ne $true) {
        throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence is indeterminate.")
      }
      Assert-FormulaEvidenceSafe -FormulaValue $current.Formula

      $next = $UsedRange.FindNext($current)
      Release-ComObject -Value $current
      $current = $next
      if ($null -eq $current) {
        throw (New-StatusException -Status "excel_error" -Message "Workbook formula evidence is indeterminate.")
      }
      if ([string]$current.Address() -ceq $firstAddress) {
        break
      }
    }
  } finally {
    Release-ComObject -Value $current
    Release-ComObject -Value $after
    Release-ComObject -Value $cells
  }
}

function Convert-OutputToDiagnostic {
  param(
    [Parameter(Mandatory = $true)] [object]$OutputItem,
    [Parameter(Mandatory = $true)] [object]$ActualValue,
    [Parameter(Mandatory = $true)] [AllowEmptyString()] [string]$DisplayText,
    [Parameter(Mandatory = $true)] [AllowEmptyString()] [string]$FormulaText
  )

  $metricName = [string]$OutputItem.name
  $formulaValue = if ($null -eq $FormulaText) { "" } else { [string]$FormulaText }
  $formulaIsOptional = Test-FormulaOptionalMetric -MetricName $metricName
  if ([string]::IsNullOrWhiteSpace($formulaValue)) {
    if ($formulaIsOptional) {
      $formulaValue = "[formula-empty-allowed]"
    } else {
      throw (New-StatusException -Status "excel_error" -Message "Output formula is missing for a required metric.")
    }
  } else {
    Assert-FormulaEvidenceSafe -FormulaValue $formulaValue
  }

  $expectedValue = $OutputItem.expected
  $displayValue = if ($null -eq $DisplayText) { "" } else { [string]$DisplayText }
  Assert-ControlledString -Value $displayValue -Location "output displayText" -MaximumLength $script:MaximumStringLength -Status "excel_error" -AllowEmpty
  $absoluteDifference = $null
  $relativeDifference = $null
  $tolerance = $null
  $pass = $false
  $actualOut = $null

  if (Test-JsonNumber -Value $expectedValue) {
    if (-not (Test-JsonNumber -Value $ActualValue)) {
      throw (New-StatusException -Status "excel_error" -Message "Actual output is non-numeric for a numeric metric.")
    }
    $actualNumber = [double]$ActualValue
    if ([double]::IsNaN($actualNumber) -or [double]::IsInfinity($actualNumber)) {
      throw (New-StatusException -Status "excel_error" -Message "Actual output must be finite.")
    }
    $expectedNumber = [double]$expectedValue
    $absoluteDifference = [Math]::Abs($actualNumber - $expectedNumber)
    $tolerance = if ("tolerance" -in $OutputItem.PSObject.Properties.Name) { [double]$OutputItem.tolerance } else { $script:DefaultTolerance }
    $scale = [Math]::Max(1.0, [Math]::Max([Math]::Abs($actualNumber), [Math]::Abs($expectedNumber)))
    $relativeDifference = $absoluteDifference / $scale
    $pass = $absoluteDifference -le ($tolerance * $scale)
    $actualOut = $actualNumber
  } else {
    $actualText = if ($null -eq $ActualValue) { "" } else { [string]$ActualValue }
    Assert-ControlledString -Value $actualText -Location "output actual value" -MaximumLength $script:MaximumStringLength -Status "excel_error" -AllowEmpty
    $pass = $actualText -ceq [string]$expectedValue
    $actualOut = $actualText
  }

  return [ordered]@{
    name = [string]$OutputItem.name
    cell = [string]$OutputItem.cell
    expected = $OutputItem.expected
    actual = $actualOut
    displayText = $displayValue
    absoluteDifference = $absoluteDifference
    relativeDifference = $relativeDifference
    tolerance = $tolerance
    formula = $formulaValue
    formulaId = [string]$OutputItem.formulaId
    pass = [bool]$pass
  }
}

function Assert-WorkbookFormulaEvidenceSafe {
  param([Parameter(Mandatory = $true)] [object]$Workbook)

  $sheetCollection = $null
  $nameCollection = $null
  try {
    $sheetCollection = $Workbook.Worksheets
    for ($sheetIndex = 1; $sheetIndex -le $sheetCollection.Count; $sheetIndex++) {
      $sheet = $null
      $usedRange = $null
      try {
        $sheet = $sheetCollection.Item($sheetIndex)
        $usedRange = $sheet.UsedRange
        if ($usedRange.HasFormula -ne $false) {
          Assert-UsedRangeFormulasSafeByCell -UsedRange $usedRange
        }
      } finally {
        Release-ComObject -Value $usedRange
        Release-ComObject -Value $sheet
      }
    }

    $nameCollection = $Workbook.Names
    for ($nameIndex = 1; $nameIndex -le $nameCollection.Count; $nameIndex++) {
      $definedName = $null
      try {
        $definedName = $nameCollection.Item($nameIndex)
        $reference = [string]$definedName.RefersTo
        Assert-FormulaEvidenceSafe -FormulaValue $reference
      } finally {
        Release-ComObject -Value $definedName
      }
    }
  } finally {
    Release-ComObject -Value $nameCollection
    Release-ComObject -Value $sheetCollection
  }
}

$resolvedWorkbookPath = $null
$resolvedMappingPath = $null
$sourceSha256 = $null
$mapping = $null

try {
  foreach ($argument in @(
      @{ Name = "WorkbookPath"; Value = $WorkbookPath },
      @{ Name = "ExpectedSha256"; Value = $ExpectedSha256 },
      @{ Name = "WorksheetName"; Value = $WorksheetName },
      @{ Name = "MappingPath"; Value = $MappingPath }
    )) {
    if ([string]::IsNullOrWhiteSpace($argument.Value)) {
      throw (New-StatusException -Status "invalid_arguments" -Message "All parameters are required.")
    }
  }
  if ($ExpectedSha256 -cnotmatch '^[0-9A-Fa-f]{64}$') {
    throw (New-StatusException -Status "invalid_arguments" -Message "ExpectedSha256 must contain 64 hexadecimal characters.")
  }
  if ($WorksheetName.Length -gt 31 -or $WorksheetName -match '[\x00-\x1F\x7F]') {
    throw (New-StatusException -Status "invalid_arguments" -Message "WorksheetName is invalid.")
  }
  if (-not (Test-Path -LiteralPath $WorkbookPath -PathType Leaf) -or
      -not (Test-Path -LiteralPath $MappingPath -PathType Leaf)) {
    throw (New-StatusException -Status "invalid_arguments" -Message "WorkbookPath or MappingPath is unavailable.")
  }
  $resolvedWorkbookPath = (Resolve-Path -LiteralPath $WorkbookPath).Path
  $resolvedMappingPath = (Resolve-Path -LiteralPath $MappingPath).Path
  if ($env:F4_EXCEL_REGRESSION_FAIL_ON_WORKBOOK_READ -eq "1") {
    throw [System.IO.IOException]::new("Unable to read $resolvedWorkbookPath")
  }
  $sourceSha256 = (Get-FileHash -LiteralPath $resolvedWorkbookPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($sourceSha256 -cne $ExpectedSha256.ToUpperInvariant()) {
    throw (New-StatusException -Status "hash_mismatch" -Message "Workbook SHA-256 does not match ExpectedSha256.")
  }
  if ((Get-Item -LiteralPath $resolvedMappingPath).Length -gt $script:MaximumMappingBytes) {
    throw (New-StatusException -Status "invalid_mapping" -Message "Mapping file exceeds the size limit.")
  }
  try {
    if ($env:F4_EXCEL_REGRESSION_FAIL_ON_MAPPING_READ -eq "1") {
      throw [System.IO.IOException]::new("Unable to read $resolvedMappingPath")
    }
    $mapping = Get-Content -LiteralPath $resolvedMappingPath -Raw | ConvertFrom-Json -Depth 20
  } catch {
    throw (New-StatusException -Status "invalid_mapping" -Message "MappingPath must contain valid JSON.")
  }
  Assert-Mapping -Mapping $mapping
} catch {
  $isStatusException = $_.Exception.Data.Contains("IsStatusException") -and $_.Exception.Data["IsStatusException"] -eq $true
  $exceptionStatus = if ($isStatusException -and $_.Exception.Data.Contains("Status")) { [string]$_.Exception.Data["Status"] } else { $null }
  $status = if ($exceptionStatus -in @("invalid_arguments", "hash_mismatch", "invalid_mapping")) { $exceptionStatus } else { "invalid_arguments" }
  $message = switch ($exceptionStatus) {
    "invalid_arguments" { "Invalid arguments." }
    "hash_mismatch" { "Workbook hash validation failed." }
    "invalid_mapping" { "Mapping validation failed." }
    default { "Validation failed." }
  }
  Write-Json -Payload ([ordered]@{ status = $status; error = $message })
  exit 1
}

if ($ValidateOnly) {
  Write-Json -Payload ([ordered]@{
      status = "validated"
      inputCount = $mapping.inputs.Count
      outputCount = $mapping.outputs.Count
      sourceSha256 = $sourceSha256
        version = [string]$mapping.version
    })
  exit 0
}

$excel = $null
$workbooks = $null
$bootstrapWorkbook = $null
$workbook = $null
$worksheets = $null
$worksheet = $null
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("f4-excel-regression-" + [guid]::NewGuid().ToString("N"))
$resultPayload = $null
$failureStatus = $null
$failureMessage = $null

try {
  [void][System.IO.Directory]::CreateDirectory($temporaryDirectory)
  $temporaryWorkbookPath = Join-Path $temporaryDirectory ([System.IO.Path]::GetFileName($resolvedWorkbookPath))
  if ($env:F4_EXCEL_REGRESSION_FAIL_ON_COPY -eq "1") {
    throw [System.IO.IOException]::new("Unable to copy $resolvedWorkbookPath")
  }
  Copy-Item -LiteralPath $resolvedWorkbookPath -Destination $temporaryWorkbookPath
  if ($env:F4_EXCEL_REGRESSION_TAMPER_TEMP_COPY -eq "1") {
    [System.IO.File]::AppendAllText($temporaryWorkbookPath, "x")
  }
  $temporarySha256 = (Get-FileHash -LiteralPath $temporaryWorkbookPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($temporarySha256 -cne $sourceSha256 -or $temporarySha256 -cne $ExpectedSha256.ToUpperInvariant()) {
    throw (New-StatusException -Status "hash_mismatch" -Message "Temporary workbook SHA-256 does not match the approved source.")
  }

  $outputResults = [System.Collections.Generic.List[object]]::new()
  $hasMismatch = $false
  if ($env:F4_EXCEL_REGRESSION_FAIL_ON_COM_START -eq "1") {
    throw (New-StatusException -Status "excel_error" -Message "Excel startup disabled by test hook.")
  }
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.AskToUpdateLinks = $false
  $excel.AutomationSecurity = 3
  $UpdateLinks = 0
  $ReadOnly = $false
  $workbooks = $excel.Workbooks
  $bootstrapWorkbook = $workbooks.Add()
  $excel.Calculation = -4135
  $bootstrapWorkbook.Close($false)
  Release-ComObject -Value $bootstrapWorkbook
  $bootstrapWorkbook = $null
  $workbook = $workbooks.Open($temporaryWorkbookPath, $UpdateLinks, $ReadOnly)
  Assert-WorkbookFormulaEvidenceSafe -Workbook $workbook
  $worksheets = $workbook.Worksheets
  $worksheet = $worksheets.Item($WorksheetName)
  if ([string]$worksheet.Name -cne $WorksheetName) {
    throw (New-StatusException -Status "excel_error" -Message "Worksheet name did not match exactly.")
  }

  foreach ($inputItem in $mapping.inputs) {
    $range = $null
    try {
      $range = $worksheet.Range([string]$inputItem.cell)
      if ($inputItem.value -is [string]) {
        $range.NumberFormat = '@'
      }
      $range.Value2 = $inputItem.value
    } finally {
      Release-ComObject -Value $range
    }
  }

  $excel.CalculateFullRebuild()
  foreach ($outputItem in $mapping.outputs) {
    $range = $null
    try {
      $range = $worksheet.Range([string]$outputItem.cell)
      $displayText = if ($null -eq $range.Text) { "" } else { [string]$range.Text }
      $diagnostic = Convert-OutputToDiagnostic -OutputItem $outputItem -ActualValue $range.Value2 -DisplayText $displayText -FormulaText ([string]$range.Formula)
      if (-not $diagnostic.pass) { $hasMismatch = $true }
      $outputResults.Add($diagnostic)
    } finally {
      Release-ComObject -Value $range
    }
  }

  $resultPayload = [ordered]@{
    status = if ($hasMismatch) { "regression_mismatch" } else { "regression_passed" }
    sourceSha256 = $sourceSha256
    outputs = $outputResults
  }
  if ($hasMismatch) {
    throw (New-StatusException -Status "regression_mismatch" -Message "One or more regression outputs did not match." -Payload $resultPayload)
  }
} catch {
  $isStatusException = $_.Exception.Data.Contains("IsStatusException") -and $_.Exception.Data["IsStatusException"] -eq $true
  $exceptionStatus = if ($isStatusException -and $_.Exception.Data.Contains("Status")) { [string]$_.Exception.Data["Status"] } else { $null }
  $failureStatus = if ($exceptionStatus -in @("hash_mismatch", "excel_error", "regression_mismatch")) { $exceptionStatus } else { "excel_error" }
  $failureMessage = switch ($failureStatus) {
    "hash_mismatch" { "Workbook hash validation failed." }
    "regression_mismatch" { "One or more regression outputs did not match." }
    default { "Excel regression execution failed." }
  }
  if ($failureStatus -eq "regression_mismatch" -and $_.Exception.Data.Contains("Payload")) {
    $resultPayload = $_.Exception.Data["Payload"]
  }
} finally {
  if ($null -ne $workbook) {
    try { $workbook.Close($false) } catch { }
  }
  if ($null -ne $bootstrapWorkbook) {
    try { $bootstrapWorkbook.Close($false) } catch { }
  }
  if ($null -ne $excel) {
    try { $excel.Quit() } catch { }
  }
  Release-ComObject -Value $worksheet
  Release-ComObject -Value $worksheets
  Release-ComObject -Value $workbook
  Release-ComObject -Value $bootstrapWorkbook
  Release-ComObject -Value $workbooks
  Release-ComObject -Value $excel
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  try {
    if (Test-Path -LiteralPath $temporaryDirectory) {
      Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
  } catch {
    $failureStatus = "excel_error"
    $failureMessage = "Excel regression cleanup failed."
    $resultPayload = $null
  }
  try {
    $finalSourceSha256 = (Get-FileHash -LiteralPath $resolvedWorkbookPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($finalSourceSha256 -cne $sourceSha256) {
      $failureStatus = "source_modified"
      $failureMessage = "Source workbook changed during regression execution."
      $resultPayload = $null
    }
  } catch {
    $failureStatus = "excel_error"
    $failureMessage = "Source workbook verification failed."
    $resultPayload = $null
  }
}

if ($null -ne $failureStatus) {
  if ($null -eq $resultPayload) {
    $resultPayload = [ordered]@{ status = $failureStatus; error = $failureMessage }
  }
  Write-Json -Payload $resultPayload
  exit 1
}

Write-Json -Payload $resultPayload