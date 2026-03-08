param(
    [string]$DashboardUrl
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ==="
}

function Set-EnvFromLocalSettings {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $localSettingsPath = Join-Path $repoRoot "local.settings.json"

    if (-not (Test-Path $localSettingsPath)) {
        return
    }

    $settings = Get-Content $localSettingsPath -Raw | ConvertFrom-Json
    $values = $settings.Values

    if (-not $values) {
        return
    }

    foreach ($property in $values.PSObject.Properties) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($property.Name))) {
            [Environment]::SetEnvironmentVariable($property.Name, [string]$property.Value)
        }
    }
}

function Get-RequiredEnv {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $Name"
    }

    return $value.Trim()
}

function Get-SheetId {
    $sheetId = [Environment]::GetEnvironmentVariable("SHEET_ID")

    if ([string]::IsNullOrWhiteSpace($sheetId)) {
        $sheetId = [Environment]::GetEnvironmentVariable("GOOGLE_SHEET_ID")
    }

    if ([string]::IsNullOrWhiteSpace($sheetId)) {
        throw "Missing required environment variable: SHEET_ID or GOOGLE_SHEET_ID"
    }

    return $sheetId.Trim()
}

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)

    $encoded = [Convert]::ToBase64String($Bytes)
    return $encoded.TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-ResponseBody {
    param($Exception)

    if ($Exception.ErrorDetails -and $Exception.ErrorDetails.Message) {
        return $Exception.ErrorDetails.Message
    }

    if ($Exception.Exception.Response -and $Exception.Exception.Response.Content) {
        return $Exception.Exception.Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    }

    return $Exception.Exception.Message
}

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Uri,
        $Body,
        [hashtable]$Headers,
        [string]$ContentType
    )

    try {
        $response = Invoke-WebRequest -Method $Method -Uri $Uri -Headers $Headers -Body $Body -ContentType $ContentType

        return [PSCustomObject]@{
            Success = $true
            StatusCode = [int]$response.StatusCode
            RawBody = $response.Content
        }
    } catch {
        return [PSCustomObject]@{
            Success = $false
            StatusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { -1 }
            RawBody = Get-ResponseBody -Exception $_
        }
    }
}

Set-EnvFromLocalSettings

$authSuccessful = $false

try {
    $clientEmail = Get-RequiredEnv "GOOGLE_CLIENT_EMAIL"
    $privateKey = (Get-RequiredEnv "GOOGLE_PRIVATE_KEY") -replace "\\n", "`n"
    $projectId = Get-RequiredEnv "GOOGLE_PROJECT_ID"
    $sheetId = Get-SheetId
    $scope = "https://www.googleapis.com/auth/spreadsheets"
    $audience = "https://oauth2.googleapis.com/token"

    Write-Section "Environment Audit"
    Write-Host "GOOGLE_CLIENT_EMAIL: $clientEmail"
    Write-Host "GOOGLE_PROJECT_ID: $projectId"
    Write-Host "SHEET_ID: $sheetId"
    Write-Host "Private key normalized: $($privateKey.Contains([Environment]::NewLine))"

    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $headerJson = @{ alg = "RS256"; typ = "JWT" } | ConvertTo-Json -Compress
    $payloadJson = @{
        iss   = $clientEmail
        scope = $scope
        aud   = $audience
        iat   = $now
        exp   = $now + 3600
    } | ConvertTo-Json -Compress

    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headerJson)
    $payloadBytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
    $unsignedToken = "{0}.{1}" -f (ConvertTo-Base64Url $headerBytes), (ConvertTo-Base64Url $payloadBytes)

    $rsa = [System.Security.Cryptography.RSA]::Create()
    $rsa.ImportFromPem($privateKey.ToCharArray())
    $signatureBytes = $rsa.SignData(
        [System.Text.Encoding]::UTF8.GetBytes($unsignedToken),
        [System.Security.Cryptography.HashAlgorithmName]::SHA256,
        [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $jwt = "{0}.{1}" -f $unsignedToken, (ConvertTo-Base64Url $signatureBytes)

    Write-Section "Token Request"
    $tokenResponse = Invoke-JsonRequest `
        -Method "Post" `
        -Uri $audience `
        -Body @{
            grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
            assertion = $jwt
        } `
        -ContentType "application/x-www-form-urlencoded"

    Write-Host "HTTP Status: $($tokenResponse.StatusCode)"
    Write-Host $tokenResponse.RawBody

    if ($tokenResponse.Success) {
        $tokenJson = $tokenResponse.RawBody | ConvertFrom-Json
        $accessToken = $tokenJson.access_token

        if ([string]::IsNullOrWhiteSpace($accessToken)) {
            throw "Token response did not include access_token."
        }

        Write-Section "Google Sheets API Request"
        $sheetUri = "https://sheets.googleapis.com/v4/spreadsheets/$sheetId"
        $sheetResponse = Invoke-JsonRequest `
            -Method "Get" `
            -Uri $sheetUri `
            -Headers @{ Authorization = "Bearer $accessToken" }

        Write-Host "HTTP Status: $($sheetResponse.StatusCode)"
        Write-Host $sheetResponse.RawBody

        if ($sheetResponse.Success) {
            Write-Host "Spreadsheet metadata read succeeded."
            $authSuccessful = $true
        } else {
            Write-Host "Spreadsheet metadata read failed. Verify the sheet is shared with $clientEmail and that the Sheets and Drive APIs are enabled."
        }
    }
} catch {
    Write-Section "Authentication Error"
    Write-Host $_.Exception.Message
}

if (-not [string]::IsNullOrWhiteSpace($DashboardUrl)) {
    Write-Section "Dashboard Endpoint Request"
    $dashboardResponse = Invoke-JsonRequest -Method "Get" -Uri $DashboardUrl
    Write-Host "HTTP Status: $($dashboardResponse.StatusCode)"
    Write-Host $dashboardResponse.RawBody
}

if (-not $authSuccessful) {
    exit 1
}
