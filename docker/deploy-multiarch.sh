#!/bin/sh

set -e

export DOCKER_REPO="klutchell/balena-cli"
export BALENA_CLI_VERSION="12.38.2"
export DOCKER_CLI_EXPERIMENTAL=enabled

docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

docker buildx build debian \
    --build-arg BALENA_CLI_VERSION \
    --platform linux/amd64,linux/386,linux/arm64,linux/arm/v7,linux/arm/v6 \
    --tag "${DOCKER_REPO}:${BALENA_CLI_VERSION}-debian" \
    --tag "${DOCKER_REPO}:debian" \
    --tag "${DOCKER_REPO}:${BALENA_CLI_VERSION}" \
    --tag "${DOCKER_REPO}:latest" \
    --pull --push -f-<<EOF

FROM balenalib/amd64-debian-node:12-run as linux-amd64
FROM balenalib/i386-debian-node:12-run as linux-386
FROM balenalib/aarch64-debian-node:12-run as linux-arm64
FROM balenalib/armv7hf-debian-node:12-run as linux-armv7
FROM balenalib/rpi-debian-node:12-run as linux-armv6
FROM \$TARGETOS-\$TARGETARCH\$TARGETVARIANT
$(sed -n -e '/^WORKDIR/,$p' debian/Dockerfile)
EOF

# linux/arm64 fails to compile npm dependencies on alpine
docker buildx build alpine \
    --build-arg BALENA_CLI_VERSION \
    --platform linux/amd64,linux/386,linux/arm/v7,linux/arm/v6 \
    --tag "${DOCKER_REPO}:${BALENA_CLI_VERSION}-alpine" \
    --tag "${DOCKER_REPO}:alpine" \
    --pull --push -f-<<EOF

FROM balenalib/amd64-alpine-node:12-run as linux-amd64
FROM balenalib/i386-alpine-node:12-run as linux-386
FROM balenalib/aarch64-alpine-node:12-run as linux-arm64
FROM balenalib/armv7hf-alpine-node:12-run as linux-armv7
FROM balenalib/rpi-alpine-node:12-run as linux-armv6
FROM \$TARGETOS-\$TARGETARCH\$TARGETVARIANT
$(sed -n -e '/^WORKDIR/,$p' alpine/Dockerfile)
EOF
