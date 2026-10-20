#!/bin/sh
# Build Frame Mic without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
#
# Signing uses a release keystore kept outside the repository:
#   FRAME_MIC_KEYSTORE       (default ~/.android/frame-mic-release.jks)
#   FRAME_MIC_KEYSTORE_PASS  (default: contents of ~/.android/frame-mic-release.pass)
# Keep the same keystore for every release, or devices must uninstall before updating.
set -eu
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
JAR="$SDK/platforms/$(ls "$SDK/platforms" | sort -V | tail -1)/android.jar"
JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
PATH="$JAVA_HOME/bin:$PATH"
KS="${FRAME_MIC_KEYSTORE:-$HOME/.android/frame-mic-release.jks}"
KS_PASS="${FRAME_MIC_KEYSTORE_PASS:-$(cat "$HOME/.android/frame-mic-release.pass")}"
VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)
OUT="build/frame-mic-$VERSION.apk"

rm -rf build && mkdir -p build/classes build/dex
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml \
  --min-sdk-version 26 --target-sdk-version 29 -o build/base.apk
javac -source 8 -target 8 -bootclasspath "$JAR" -Xlint:-options \
  -d build/classes $(find src -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 26 --release --output build/dex $(find build/classes -name '*.class')
(cd build/dex && zip -q ../base.apk classes.dex)
"$BT/zipalign" -f -p 4 build/base.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --out "$OUT" build/aligned.apk
"$BT/apksigner" verify "$OUT"
shasum -a 256 "$OUT"
