#!/usr/bin/env bash
# install.sh — Install Firefly Media Library on Steam Deck
# Run once: bash install.sh
# Then launch: bash ~/firefly-media-library/launch.sh

set -e
INSTALL_DIR="$HOME/firefly-media-library"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Firefly Media Library — Deck Setup    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Install VLC ───────────────────────────────────────────────────────
echo "▸ Checking VLC..."
if flatpak list --app 2>/dev/null | grep -q "org.videolan.VLC"; then
    echo "  ✓ VLC already installed"
else
    echo "  Installing VLC..."
    flatpak install --noninteractive --user flathub org.videolan.VLC 2>/dev/null || \
    flatpak install --noninteractive flathub org.videolan.VLC
    echo "  ✓ VLC installed"
fi

# ── Step 2: Extract zip ───────────────────────────────────────────────────────
echo ""
echo "▸ Setting up Firefly Media Library..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIPFILE=$(find "$SCRIPT_DIR" -name "*firefly-media-library.zip" 2>/dev/null | head -1)

if [ -z "$ZIPFILE" ]; then
    echo "  ERROR: No firefly-media-library.zip found next to install.sh"
    echo "  Make sure the zip from dist/ is in the same folder as install.sh"
    exit 1
fi

echo "  Found: $(basename "$ZIPFILE")"
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$ZIPFILE" -d "$INSTALL_DIR"
echo "  ✓ Extracted to $INSTALL_DIR"

# Make the executable runnable
chmod +x "$INSTALL_DIR/firefly-media-library" 2>/dev/null || true

# ── Step 3: Create launch script ─────────────────────────────────────────────
cat > "$INSTALL_DIR/launch.sh" << 'LAUNCH'
#!/usr/bin/env bash
export DISPLAY="${DISPLAY:-:0}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/firefly-media-library" --no-sandbox "$@"
LAUNCH
chmod +x "$INSTALL_DIR/launch.sh"
echo "  ✓ Launch script created"

# ── Step 4: Desktop shortcut ─────────────────────────────────────────────────
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/firefly-media-library.desktop" << DESKTOP
[Desktop Entry]
Name=Firefly Media Library
Comment=Local movie and TV show frontend
Exec=bash $INSTALL_DIR/launch.sh
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;
StartupWMClass=Firefly Media Library
DESKTOP
echo "  ✓ Desktop shortcut created"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Done! Launch with:                                      ║"
echo "║    bash ~/firefly-media-library/launch.sh                ║"
echo "║                                                          ║"
echo "║  To add to Steam Game Mode:                              ║"
echo "║    Steam → Add Non-Steam Game → browse to launch.sh     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
