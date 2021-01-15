ARG BALENA_ARCH

FROM balenalib/${BALENA_ARCH}-alpine-node:12-run

WORKDIR /usr/src/app

ARG BALENA_CLI_VERSION

# hadolint ignore=DL3018
RUN apk add --no-cache -t .build-deps \
        build-base \
        curl \
        git \
        linux-headers \
        python3 && \
    npm install balena-cli@${BALENA_CLI_VERSION} -g --production --unsafe-perm && \
    apk del --purge .build-deps

# fail early if balena binary won't run
RUN balena --version

# https://github.com/balena-io/balena-cli/blob/master/INSTALL-LINUX.md#additional-dependencies
# hadolint ignore=DL3018
RUN apk add --no-cache avahi bash ca-certificates docker openssh

COPY init.sh ./

RUN chmod +x ./init.sh

ENTRYPOINT [ "./init.sh" ]

CMD [ "--help" ]
