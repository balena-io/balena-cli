#!/bin/bash

set -e

# OS image mounted read-write from host working copy
OS_IMAGE="/tmp/balena-os.img"

# SSH port inside the VM (balenaOS uses 22222)
SSH_PORT=22222
# Memory and CPU defaults
MEMORY=${MEMORY:-2048}
CPUS=${CPUS:-4}
# Accelerator (passed from host detection, e.g., "kvm:tcg" or "tcg")
# QEMU will try accelerators in order and use the first available one
QEMU_ACCEL=${QEMU_ACCEL:-tcg}

echo "Accelerator: ${QEMU_ACCEL}"

# Build accelerator arguments
# QEMU accepts multiple -accel flags, trying each in order
# Format: "kvm:tcg" becomes "-accel kvm -accel tcg"
build_accel_args() {
    local accel_str="$1"
    local args=""
    IFS=':' read -ra ACCELS <<< "$accel_str"
    for accel in "${ACCELS[@]}"; do
        args="${args} -accel ${accel}"
    done
    echo "$args"
}

ACCEL_ARGS=$(build_accel_args "${QEMU_ACCEL}")

# Guest architecture - determines which QEMU binary to use
# This is passed from the host based on the image type, NOT the container's arch
# GUEST_ARCH should be "x86_64" or "aarch64"
GUEST_ARCH=${GUEST_ARCH:-$(uname -m)}

echo "Guest architecture: ${GUEST_ARCH}"

case "${GUEST_ARCH}" in
"x86_64" | "amd64")
    echo "Starting QEMU for x86_64 guest (interactive console - Ctrl+A,C for monitor)..."
    # shellcheck disable=SC2086
    exec qemu-system-x86_64 \
        -serial mon:stdio \
        -nographic \
        -drive "file=${OS_IMAGE},media=disk,format=raw,if=none,id=disk,cache=writeback" \
        -device virtio-blk-pci,drive=disk \
        -device virtio-net-pci,netdev=n1 \
        -device virtio-rng-pci \
        -device virtio-balloon \
        -netdev "user,id=n1,hostfwd=tcp::${SSH_PORT}-:${SSH_PORT}" \
        -m "${MEMORY}" \
        -machine type=q35 \
        -smp "${CPUS}" \
        ${ACCEL_ARGS} \
        -bios /usr/share/ovmf/OVMF.fd \
        -nodefaults
    ;;
"aarch64" | "arm64")
    echo "Starting QEMU for aarch64 guest (interactive console - Ctrl+A,C for monitor)..."
    # shellcheck disable=SC2086
    exec qemu-system-aarch64 \
        -serial mon:stdio \
        -nographic \
        -device virtio-net-device,netdev=n1 \
        -netdev "user,id=n1,hostfwd=tcp::${SSH_PORT}-:${SSH_PORT}" \
        -drive "file=${OS_IMAGE},media=disk,format=raw,cache=writeback" \
        -device virtio-rng-device \
        -device virtio-balloon-device \
        -m "${MEMORY}" \
        -machine virt \
        -smp "${CPUS}" \
        ${ACCEL_ARGS} \
        -cpu cortex-a72 \
        -bios /usr/share/AAVMF/AAVMF_CODE.fd \
        -nodefaults
    ;;
*)
    echo "Unsupported guest architecture: ${GUEST_ARCH}"
    exit 1
    ;;
esac
