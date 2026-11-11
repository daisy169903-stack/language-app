# Android app

VietLingo HU is packaged as a Capacitor Android app (`hu.vietlingo.app`). The compiled React app is bundled inside the APK, so no PC, development server, hosted website, or internet connection is needed for lessons and saved progress.

## Install on your phone

1. Copy `release/VietLingo-HU-Android.apk` to an Android 7.0 or newer phone.
2. Open the APK and allow installation from that file manager when Android asks.
3. Install and launch **VietLingo HU**. You can turn off the file manager's installation permission afterward.

This is a personally installable **debug APK**, signed with a local development key. It is not a production Play Store release. Keep `.android-tools/debug.keystore` if you want future APK updates to retain the same signing identity. Uninstalling the app removes its local progress; changing signing keys requires uninstalling the old build.

## Rebuild on Windows

After installing project dependencies as described in the README, run:

```powershell
npm run android:build
```

Requirements: Node.js 22+, JDK 21, Android SDK platform 36 and build tools 36.0.0. The provided build uses project-local tools in `.android-tools/jdk/` and `.android-tools/sdk/`. Alternatively set `JAVA_HOME` and `ANDROID_HOME` for an existing installation. Gradle downloads dependencies on the first build; installation and normal app use do not need those build tools.

The script builds `dist`, syncs it into `android/app/src/main/assets/public`, compiles the native app, and copies the APK into `release/`. For an already verified current `dist`, use `& .\scripts\package-android.ps1 -SkipWebBuild`.

Native settings use `adjustResize` for the software keyboard and Capacitor's SystemBars safe-area CSS variables for display cutouts and navigation bars. Android phone installation and physical keyboard/inset behavior still require a device check.

Build prerequisites came from the official [Eclipse Adoptium API](https://api.adoptium.net/) (Temurin 21) and [Android developer downloads](https://developer.android.com/studio#command-line-tools-only). Capacitor's [Android 8 migration documentation](https://capacitorjs.com/docs/updating/8-0) specifies Android API 36 and describes its safe-area handling.
