# Token-free Android updates

The phone needs only a public GitHub repository address, initially https://github.com/daisy169903-stack/language-app. This repository was made public with explicit user authorization. Its source and history are public; podcast recordings, models and signing keys are excluded.

There is no token field or account login in the updater. All checks send only the Accept header to the fixed GitHub API endpoint, with credentials omitted and redirects rejected. Private repositories cannot provide anonymous update checks; use a public repository containing a published release and the exact APK asset VietLingo-HU-Android.apk. A private/inaccessible repository or missing release produces a clear public-repository message instead of asking for a token.

Automatic checks run from the persistent settings component at app startup, at most once per 24 hours. Manual checking is always available. GitHub may rate-limit anonymous requests; the app explains when to retry. The release must use a stable numeric vMAJOR.MINOR.PATCH tag, must not be a draft/prerelease, and its exact HTTPS download URL must belong to the configured repository/tag. The app opens that public APK in the system browser; Android asks the user to approve installation. It never silently installs.

Version 0.3.1 removes the previous credential bridge. On Android launch it clears only the obsolete secure-updates preferences and hu.vietlingo.app.github-updates Keystore alias. Progress and imported audio databases are untouched.

## Publishing updates

Increase package.json version and publish a GitHub Release containing VietLingo-HU-Android.apk. Source changes without a new release do not create an installable update. The repository workflow automates building after a main/master push or version tag once its original Android signing key is configured as an Actions secret. This is developer-side signing, not a token entered on the phone. Exporting that existing signing key remains subject to the separate pending user approval; no key was uploaded by making the repository public.

Keep application ID hu.vietlingo.app and the exact existing signing key. Android versionCode derives from package.json as major×1000000 + minor×1000 + patch. Each component is 0–999. A different key cannot update the installed app. Never uninstall as a workaround, because uninstalling removes local progress and recordings.

The local publisher script uploads an already signed APK without reading/transmitting the signing key. Releases are not overwritten. Private podcast packs must stay separate from the APK and public repository; the build guard enforces this for public assets.

## Verification

Unit tests verify numeric version comparison, repository parsing, exact APK URLs, absent Authorization headers/omitted credentials, invalid input, HTTP failures and cancellation. Browser checks verify that the token UI is absent and all startup/manual/reload requests are anonymous. Android build/signature and public release checks are performed during delivery. A physical-phone upgrade and obsolete credential cleanup still require device verification.
