# Android updates through GitHub Releases

The app checks GitHub Releases from the configured repository, initially `daisy169903-stack/language-app` (currently private). In the app's update settings, save `owner/repository` or `https://github.com/owner/repository` to change it. This repository setting is stored only on the device. The workflow does not change repository visibility.

Public repositories work without authentication. For a private repository, create a GitHub fine-grained personal access token restricted to that repository with **Contents: Read-only** permission. Enter it in the app's password field, never in chat or source code. The app sends it only as an Authorization header to the fixed `https://api.github.com` endpoint; redirects are rejected. Android stores the token using the native secure storage bridge, encrypted with an Android Keystore key. The web version keeps it only in memory for the current session. Tokens are never saved in localStorage, release assets or logs. The app shows whether a token exists without redisplaying its value; a delete button removes it. Expired/revoked tokens must be replaced.

Automatic checks run from the persistent settings component at app startup, at most once per 24 hours. A manual check is always available. No push permission or background service is required. GitHub's API can rate limit checks; the app shows a retry message. A missing/inaccessible repository or a repository without releases also displays an explanation.

The updater reads GitHub's latest stable release, accepts a numeric `vMAJOR.MINOR.PATCH` (or unprefixed numeric) tag, excludes drafts and prereleases, and requires the exact asset `VietLingo-HU-Android.apk`. Only an HTTPS GitHub download URL under the configured repository and release tag can open. It opens in the system browser; **for private releases, the browser must separately be signed into a GitHub account with repository access**. The API token is not appended to the download URL or passed to the browser. The user downloads and approves the normal Android installation. There is no silent installation. A failed check never deletes app data.

## Repository setup

1. Push this project to the chosen GitHub repository with Actions enabled. Set the app's repository field to that repository. It can remain private; configure the app token and browser login as described above.
2. Keep the original `.android-tools/debug.keystore` securely backed up. Existing locally installed APKs use that key. The Actions repository secret `ANDROID_KEYSTORE_BASE64` must contain the Base64 encoding of **that exact file**, not a newly generated signing key. Do not commit the key, its Base64 representation, or print it in logs. This debug signing identity is retained for compatibility; it is not suitable for a new Play Store release identity.
3. For the existing debug key, the default password is `android`, alias `androiddebugkey`, and key password `android`. For another existing signing identity, configure `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` as Actions secrets too. A missing key fails the workflow; it never generates a replacement.
4. Increase `package.json` version, for example `0.3.0` → `0.3.1`, then push to `main` or `master`. The workflow installs locked dependencies, tests, builds with Node 22 / Java 21 / Android API 36, and publishes a GitHub Release with its APK. You can also push a matching `v0.3.1` tag or run the workflow manually. Pushing source code without increasing the version does not replace an existing release.

Releases are never overwritten by this workflow. If the release exists, publication is skipped; bump the version to publish a correction. A manually created release without the APK also needs a new version or manual repair. No private device recordings are bundled in the repository build.

Android's `versionName` comes from `package.json`; `versionCode = major × 1,000,000 + minor × 1,000 + patch`. Each component must be 0–999 and the resulting code must be positive. Always increase the semantic version. Existing version code 1 is upgraded by `0.3.0` (code 3000).

## Data and signing continuity

Keep application ID `hu.vietlingo.app` and the signing key unchanged. Android will then install a newer version over the existing app and preserve local data. A different signing certificate cannot update an installed copy; do not uninstall to work around this because uninstalling removes local data. Use the app's backup feature before upgrades. The updater verifies the expected GitHub URL; Android verifies the APK signing identity during installation. Control of the configured repository remains a trust requirement.

## Verification limits

Updater unit tests cover version comparison, configuration parsing, URL restrictions, API statuses and cancellation. The v0.3.0 APK was published from the locally signed build without transmitting its private signing key. Authenticated live checks correctly report v0.3.0 as available to 0.2.0 and current to 0.3.0. The workflow ran successfully and skipped replacing the existing release. A future version build still requires the explicitly approved signing secret; that upload remains pending. An on-device upgrade has not been verified. Test the first published update on the existing installed app and confirm its saved progress and recordings remain available.
