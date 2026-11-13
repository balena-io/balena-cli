#!/bin/bash
# Generate minimal test images for flasher detection tests
# This script runs inside a Docker container with necessary tools
#
# Usage from repo root:
#   docker run --rm \
#     -v $(pwd)/tests/test-data/virtual-device:/data \
#     alpine:latest sh /data/generate-flasher-test-images.sh /data

set -e

OUTDIR="${1:-/output}"
mkdir -p "$OUTDIR"

# Install required tools
apk add --no-cache e2fsprogs sgdisk

echo "Generating flasher test images..."

# === Flasher test image (256KB) ===
# Has flash-rootA partition with /opt/*.balenaos-img file
echo ""
echo "=== Creating flasher-test.img ==="

FLASHER_IMG="$OUTDIR/flasher-test.img"

# 256KB = 512 sectors
# GPT needs sectors 0-33 at start, last 33 at end
# Use sectors 40-450 (411 sectors = ~210KB) for partition
dd if=/dev/zero of="$FLASHER_IMG" bs=1K count=256 2>/dev/null
sgdisk -n 1:40:450 -c 1:flash-rootA "$FLASHER_IMG" > /dev/null 2>&1

# Create temp directory structure to populate ext4
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/opt"
echo "dummy" > "$TMPDIR/opt/test.balenaos-img"

# Create ext4 filesystem with content
PART_IMG=$(mktemp)
dd if=/dev/zero of="$PART_IMG" bs=512 count=411 2>/dev/null
mke2fs -t ext4 -L flash-rootA -d "$TMPDIR" -q "$PART_IMG" 2>/dev/null

# Write partition to image at sector 40
dd if="$PART_IMG" of="$FLASHER_IMG" bs=512 seek=40 conv=notrunc 2>/dev/null
rm -rf "$PART_IMG" "$TMPDIR"

echo "  Created: $FLASHER_IMG ($(wc -c < "$FLASHER_IMG") bytes)"

# === Non-flasher test image (256KB) ===
# Has resin-rootA partition but NO .balenaos-img file
echo ""
echo "=== Creating non-flasher-test.img ==="

NONFLASHER_IMG="$OUTDIR/non-flasher-test.img"

dd if=/dev/zero of="$NONFLASHER_IMG" bs=1K count=256 2>/dev/null
sgdisk -n 1:40:450 -c 1:resin-rootA "$NONFLASHER_IMG" > /dev/null 2>&1

# Create temp directory with /opt but NO .balenaos-img file
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/opt"
echo "readme" > "$TMPDIR/opt/readme.txt"

# Create ext4 filesystem
PART_IMG=$(mktemp)
dd if=/dev/zero of="$PART_IMG" bs=512 count=411 2>/dev/null
mke2fs -t ext4 -L resin-rootA -d "$TMPDIR" -q "$PART_IMG" 2>/dev/null

# Write partition to image
dd if="$PART_IMG" of="$NONFLASHER_IMG" bs=512 seek=40 conv=notrunc 2>/dev/null
rm -rf "$PART_IMG" "$TMPDIR"

echo "  Created: $NONFLASHER_IMG ($(wc -c < "$NONFLASHER_IMG") bytes)"

echo ""
echo "Done! Test images generated in $OUTDIR (512KB total)"
