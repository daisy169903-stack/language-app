param([switch]$SkipWebBuild)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $tools = Join-Path $projectRoot '.android-tools'
    if (-not $env:JAVA_HOME) {
        $jdk = Get-ChildItem (Join-Path $tools 'jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $jdk) { throw 'JDK 21 required. Set JAVA_HOME or place the extracted JDK in .android-tools/jdk/.' }
        $env:JAVA_HOME = $jdk.FullName
    }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $tools 'sdk' }
    if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms/android-36/android.jar'))) {
        throw 'Android SDK API 36 required. Set ANDROID_HOME or install it in .android-tools/sdk/.'
    }
    $env:ANDROID_USER_HOME = Join-Path $tools 'user'
    $env:GRADLE_USER_HOME = Join-Path $tools 'gradle'
    New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME, $env:GRADLE_USER_HOME | Out-Null
    $debugKey = Join-Path $tools 'debug.keystore'
    if (-not (Test-Path -LiteralPath $debugKey)) {
        & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') -genkeypair -keystore $debugKey -storepass android -keypass android -alias androiddebugkey -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
        if ($LASTEXITCODE -ne 0) { throw 'Local debug signing key creation failed.' }
    }
    if (-not $SkipWebBuild) {
        & node 'node_modules/typescript/bin/tsc' -b
        if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed.' }
        & node 'node_modules/vite/bin/vite.js' build
        if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    }
    & node 'node_modules/@capacitor/cli/bin/capacitor' sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    Push-Location android
    try {
        & .\gradlew.bat --no-daemon assembleDebug
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
    $destination = Join-Path $projectRoot 'release/VietLingo-HU-Android.apk'
    New-Item -ItemType Directory -Force (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $destination -Force
    Write-Output "Android APK: $destination"
} finally { Pop-Location }
