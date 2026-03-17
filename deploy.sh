#!/bin/bash
set -uo pipefail

REMOTE="pi-remote"
REMOTE_DIR="/mnt/ssd/Deploy/worktracker"

# Flags: --minor, --major, --patch, --no-bump, --web-only, --skip-android, --skip-mac
BUMP_TYPE="patch"
BUILD_MAC=true
BUILD_ANDROID=true
BUILD_WEB=true
for arg in "$@"; do
  case "$arg" in
    --major) BUMP_TYPE="major" ;;
    --minor) BUMP_TYPE="minor" ;;
    --patch) BUMP_TYPE="patch" ;;
    --no-bump) BUMP_TYPE="none" ;;
    --web-only) BUILD_MAC=false; BUILD_ANDROID=false ;;
    --skip-android) BUILD_ANDROID=false ;;
    --skip-mac) BUILD_MAC=false ;;
    --skip-web) BUILD_WEB=false ;;
  esac
done

CURRENT_VERSION=$(node -p "require('./package.json').version")

if [ "$BUMP_TYPE" = "none" ]; then
  VERSION="$CURRENT_VERSION"
  echo "Skipping version bump (--no-bump), using $VERSION"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
  case "$BUMP_TYPE" in
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch) PATCH=$((PATCH + 1)) ;;
  esac
  VERSION="$MAJOR.$MINOR.$PATCH"

  # Update package.json version
  node -e "const pkg=require('./package.json'); pkg.version='$VERSION'; require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n')"
  echo "Version bumped: $CURRENT_VERSION → $VERSION ($BUMP_TYPE)"
fi

TAG="v$VERSION"

# Track which steps succeed
STEPS_DONE=""

step() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
  echo ""
}

FAILURES=""

fail() {
  echo ""
  echo "FAILED: $1"
  FAILURES="$FAILURES [$1]"
}

# --- Parallel builds: macOS + Android ---
MAC_PID=""
ANDROID_PID=""

if $BUILD_MAC || $BUILD_ANDROID; then
  step "Building macOS + Android (parallel)"
fi

if $BUILD_MAC; then
  (
    if npm run electron:package:mac; then
      echo "[mac] Build succeeded"
    else
      echo "[mac] Build FAILED"
      exit 1
    fi
  ) &
  MAC_PID=$!
else
  echo "Skipping macOS build (--skip-mac or --web-only)"
fi

if $BUILD_ANDROID; then
  (
    if npx eas build --platform android --profile preview --local; then
      echo "[android] Build succeeded"
    else
      echo "[android] Build FAILED"
      exit 1
    fi
  ) &
  ANDROID_PID=$!
else
  echo "Skipping Android build (--skip-android or --web-only)"
fi

# Wait for background builds
if [ -n "$MAC_PID" ]; then
  if wait $MAC_PID; then
    STEPS_DONE="$STEPS_DONE [mac]"
    echo "macOS build output: electron/dist/"
  else
    fail "macOS Electron build"
  fi
fi

if [ -n "$ANDROID_PID" ]; then
  if wait $ANDROID_PID; then
    STEPS_DONE="$STEPS_DONE [android]"
    echo "Android APK built locally"
  else
    fail "Android build"
  fi
fi

# --- Find the APK, rename, and clean old ones ---
APK_FILE=$(ls -t build-*.apk 2>/dev/null | head -1)
APK_RELEASE_NAME=""
if [ -z "$APK_FILE" ]; then
  fail "Could not find built APK"
else
  APK_RELEASE_NAME="WorkTracker-${VERSION}.apk"
  mv "$APK_FILE" "$APK_RELEASE_NAME"
  APK_FILE="$APK_RELEASE_NAME"
  # Remove any other APKs
  ls build-*.apk WorkTracker-*.apk 2>/dev/null | grep -v "$APK_RELEASE_NAME" | xargs rm -f 2>/dev/null || true
fi

# --- GitHub Release ---
step "Uploading to GitHub Release $TAG"

# Create release if it doesn't exist
if ! gh release view "$TAG" &>/dev/null; then
  echo "Creating release $TAG..."
  if gh release create "$TAG" --title "$TAG" --generate-notes; then
    echo "Release $TAG created"
  else
    fail "Creating GitHub release"
  fi
fi

# Upload APK (delete old one first if it exists)
if [ -n "$APK_RELEASE_NAME" ]; then
  gh release delete-asset "$TAG" "$APK_RELEASE_NAME" --yes 2>/dev/null || true
  if gh release upload "$TAG" "$APK_FILE#$APK_RELEASE_NAME"; then
    echo "APK uploaded as $APK_RELEASE_NAME"
  else
    fail "Uploading APK to release"
  fi
else
  echo "Skipping APK upload (no APK built)"
fi

# Upload DMG
DMG_RELEASE=$(ls -t electron-dist/WorkTracker-*-arm64.dmg 2>/dev/null | head -1)
if [ -n "$DMG_RELEASE" ]; then
  DMG_RELEASE_NAME=$(basename "$DMG_RELEASE")
  gh release delete-asset "$TAG" "$DMG_RELEASE_NAME" --yes 2>/dev/null || true
  if gh release upload "$TAG" "$DMG_RELEASE#$DMG_RELEASE_NAME"; then
    echo "DMG uploaded as $DMG_RELEASE_NAME"
  else
    echo "Warning: Failed to upload DMG to release"
  fi
else
  echo "Warning: No arm64 DMG found for release upload"
fi

STEPS_DONE="$STEPS_DONE [release]"

# --- Web deploy to Pi ---
if ! $BUILD_WEB; then
  echo "Skipping web deploy (--skip-web)"
else

step "Building web Docker image locally (linux/arm64)"
if docker build \
  --build-arg SUPABASE_URL="${SUPABASE_URL:-}" \
  --build-arg SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}" \
  --build-arg GOOGLE_IOS_REVERSED_CLIENT_ID="${GOOGLE_IOS_REVERSED_CLIENT_ID:-}" \
  --build-arg EAS_PROJECT_ID="${EAS_PROJECT_ID:-}" \
  -t worktracker-web:latest \
  . && docker save worktracker-web:latest -o worktracker-web.tar; then
  STEPS_DONE="$STEPS_DONE [build]"
else
  fail "Local Docker build"
fi

step "Deploying image to $REMOTE"
if [ -f worktracker-web.tar ]; then
  # Sync image, compose files, nginx config, and .env to Pi
  rsync -avz --progress worktracker-web.tar \
    docker-compose.prod.yml docker-compose.yml nginx/ .env \
    "$REMOTE:$REMOTE_DIR/"

  # Load image and restart on Pi
  if ssh "$REMOTE" "cd $REMOTE_DIR && docker images -q worktracker-web 2>/dev/null | xargs -r docker rmi -f 2>/dev/null && docker load -i worktracker-web.tar && docker compose -f docker-compose.prod.yml up -d && rm -f worktracker-web.tar && docker image prune -f --filter 'label=com.docker.compose.project=worktracker' 2>/dev/null"; then
    STEPS_DONE="$STEPS_DONE [web]"
  else
    fail "Docker deploy on $REMOTE"
  fi
  rm -f worktracker-web.tar
else
  fail "No image tar to deploy"
fi

fi # BUILD_WEB

# --- Copy latest builds to latest/ folder ---
step "Updating latest/ folder"
LATEST_DIR="latest"
rm -rf "$LATEST_DIR"
mkdir -p "$LATEST_DIR"

# Copy APK
if [ -n "$APK_RELEASE_NAME" ] && [ -f "$APK_RELEASE_NAME" ]; then
  cp "$APK_RELEASE_NAME" "$LATEST_DIR/"
  echo "Copied $APK_RELEASE_NAME to $LATEST_DIR/"
else
  echo "Warning: No APK to copy to $LATEST_DIR/"
fi

# Copy arm64 DMG
DMG_FILE=$(ls -t electron-dist/WorkTracker-*-arm64.dmg 2>/dev/null | head -1)
if [ -n "$DMG_FILE" ]; then
  cp "$DMG_FILE" "$LATEST_DIR/"
  echo "Copied $(basename "$DMG_FILE") to $LATEST_DIR/"
else
  echo "Warning: No arm64 DMG found in electron-dist/"
fi

echo ""
echo "=========================================="
if [ -n "$FAILURES" ]; then
  echo "  Deploy finished with failures ($TAG)"
  echo "  FAILED:$FAILURES"
  echo "  Completed:$STEPS_DONE"
else
  echo "  All builds complete! ($TAG)"
fi
echo "  macOS:   electron/dist/"
echo "  Android: ${APK_RELEASE_NAME:-N/A}"
echo "  Latest:  $LATEST_DIR/"
echo "  Release: https://github.com/PolarBaeJr/time-tracker/releases/tag/$TAG"
echo "  Web:     deployed to $REMOTE"
echo "=========================================="

# Exit with error if anything failed
if [ -n "$FAILURES" ]; then
  exit 1
fi
