#!/bin/sh
# Build Frame Mic without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
#
# Signing uses a release keystore kept outside the repository:
#   FRAME_MIC_KEYSTORE       (default ~/.android/frame-mic-release.jks)
#   FRAME_MIC_KEYSTORE_PASS  (default: contents of ~/.android/frame-mic-release.pass)
# Keep the same keystore for every release, or devices must uninstall before updating.
#
# Calls use Google's WebRTC library, prebuilt by Stream (io.getstream:stream-webrtc-android) and fetched from
# Maven Central into FRAME_MIC_CACHE (default ~/.cache/frame-mic), pinned by SHA-256.
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
WEBRTC_VERSION=1.3.10
WEBRTC_SHA256=afa3b0feaa2902f6ece10e67ce3b7e6d9def18a86b73f0c6a524209cb938aa96
AAR="${FRAME_MIC_CACHE:-$HOME/.cache/frame-mic}/stream-webrtc-android-$WEBRTC_VERSION.aar"

if [ ! -f "$AAR" ]; then
  curl -sfL --create-dirs -o "$AAR.part" \
    "https://repo1.maven.org/maven2/io/getstream/stream-webrtc-android/$WEBRTC_VERSION/stream-webrtc-android-$WEBRTC_VERSION.aar"
  mv "$AAR.part" "$AAR"
fi
echo "$WEBRTC_SHA256  $AAR" | shasum -a 256 -c -

rm -rf build && mkdir -p build/classes build/dex build/webrtc
# ponytail: arm64 only (Lenovo Smart Frame, current tablets); add jni/armeabi-v7a/* for 32-bit-only devices
unzip -q "$AAR" classes.jar 'jni/arm64-v8a/*' -d build/webrtc
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml \
  --min-sdk-version 26 --target-sdk-version 29 -o build/base.apk
javac -source 8 -target 8 -bootclasspath "$JAR" -classpath build/webrtc/classes.jar -Xlint:-options \
  -d build/classes $(find src -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 26 --release --output build/dex \
  $(find build/classes -name '*.class') build/webrtc/classes.jar
(cd build/dex && zip -q ../base.apk classes*.dex)
(cd build/webrtc && mv jni lib && zip -q -r ../base.apk lib)
"$BT/zipalign" -f -p 4 build/base.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --out "$OUT" build/aligned.apk
"$BT/apksigner" verify "$OUT"
shasum -a 256 "$OUT"
