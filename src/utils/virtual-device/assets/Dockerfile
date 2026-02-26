FROM ubuntu:24.04

ARG TARGETARCH

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /opt

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install QEMU, OVMF firmware, networking tools, and e2fsprogs for native ext4 extraction
# hadolint ignore=DL3008
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    e2fsprogs \
    netcat-openbsd \
    ovmf \
    qemu-efi-aarch64 \
    qemu-kvm \
    qemu-system-arm \
    qemu-system-x86 \
    qemu-utils \
    socat \
    && rm -rf /var/lib/apt/lists/*

COPY entry.sh /usr/bin/entry.sh
RUN chmod +x /usr/bin/entry.sh

CMD ["/bin/bash", "/usr/bin/entry.sh"]
