ARG BUILD_BASE=balenalib/amd64-debian-node:12.19.1-build
ARG RUN_BASE=balenalib/amd64-debian-node:12.19.1-run

FROM ${BUILD_BASE} as build

WORKDIR /usr/src/app

COPY . .

# dev dependencies are required for build:fast
# --unsafe-perm is not needed because of global /usr/local/etc/npmrc
RUN npm install

RUN npm run build:fast

# remove dev dependencies after build:fast
RUN npm prune --production

FROM ${RUN_BASE}

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/ .

ENV PATH $PATH:/usr/src/app/bin

# fail early if balena binary won't run
RUN balena --version

# https://github.com/balena-io/balena-cli/blob/master/INSTALL-LINUX.md#additional-dependencies
RUN install_packages avahi-daemon ca-certificates docker.io jq openssh-client

COPY docker/docker-init.sh init.sh

RUN CLI_CMDS=$(jq -r '.commands | keys | map(.[0:index(":")]) | unique | join("\\ ")' < oclif.manifest.json); \
    sed -ie "s/CLI_CMDS=\"help\"/CLI_CMDS=\"help\\ ${CLI_CMDS}\"/" init.sh && \
    chmod +x init.sh

ENTRYPOINT [ "./init.sh" ]

CMD [ "help" ]

ENV SSH_AUTH_SOCK "/ssh-agent"
