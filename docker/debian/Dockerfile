ARG BUILD_BASE=balenalib/amd64-debian-node:12.19.1-build
ARG RUN_BASE=balenalib/amd64-debian-node:12.19.1-run

FROM ${BUILD_BASE} as build

WORKDIR /usr/src/docker

ARG DOCKER_VERSION=19.03.8

# set pipefail before running shell commands with a pipe
# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# install official static docker binaries
# https://github.com/docker-library/docker/blob/master/20.10/Dockerfile
RUN case "$(dpkg --print-architecture)" in \
        'arm64') DOCKER_ARCH='aarch64' ;; \
        'amd64') DOCKER_ARCH='x86_64' ;; \
        'armhf') DOCKER_ARCH='armel' ;; \
        'i386') DOCKER_ARCH='x86_64' ;; \
        *) echo >&2 "error: unsupported architecture ($(dpkg --print-architecture))"; exit 1 ;; \
    esac && \
    curl -L https://download.docker.com/linux/static/stable/$DOCKER_ARCH/docker-$DOCKER_VERSION.tgz | tar xzv --strip-components 1

WORKDIR /usr/src/app

COPY . .

# dev dependencies are required for build:fast
# --unsafe-perm is not needed because of global /usr/local/etc/npmrc
RUN npm install

RUN npm run build:fast

# remove dev dependencies after build:fast
RUN npm prune --production

FROM ${RUN_BASE}

# https://github.com/balena-io/balena-cli/blob/master/INSTALL-LINUX.md#additional-dependencies
RUN install_packages avahi-daemon ca-certificates iptables jq openssh-client && \
    update-alternatives --set iptables /usr/sbin/iptables-legacy && \
    update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/ /usr/src/app/
COPY --from=build /usr/src/docker/ /usr/local/bin/

ENV PATH $PATH:/usr/src/app/bin

# fail if binaries are missing or won't run
RUN echo -n "balena CLI version " && balena --version && dockerd --version && docker --version

COPY docker/docker-init.sh init.sh

RUN CLI_CMDS=$(jq -r '.commands | keys | map(.[0:index(":")]) | unique | join("\\ ")' < oclif.manifest.json); \
    sed -ie "s/CLI_CMDS=\"help\"/CLI_CMDS=\"help\\ ${CLI_CMDS}\"/" init.sh && \
    chmod +x init.sh

ENTRYPOINT [ "/usr/src/app/init.sh" ]

CMD [ "help" ]

ENV SSH_AUTH_SOCK "/ssh-agent"

# docker data must be a volume or tmpfs
VOLUME /var/lib/docker
