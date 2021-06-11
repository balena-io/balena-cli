ARG BUILD_BASE=balenalib/amd64-debian-node:12.22.1-build
FROM ${BUILD_BASE}

SHELL ["/bin/bash", "-c"]
WORKDIR /usr/src/app

COPY . .

RUN npm install --unsafe-perm && npm run build:fast
RUN mkdir -p dist && npm run build:caxa

# test the installer
# file will be something like balena-cli-v12.45.20-linux-x64-installer
RUN ls -la dist; file=$(ls -t dist/balena-cli-v* | head -n 1); echo "$file"; "$file"

# fail early if balena binary won't run
RUN balena --version

# install resinci-deploy
ARG GITHUB_TOKEN
RUN cd /usr/src && \
    git clone https://product-os:${GITHUB_TOKEN}@github.com/product-os/resinci-deploy.git && \
    cd resinci-deploy && \
    npm install --unsafe-perm && npm link --force

RUN unset IFS; read branch owner repo version <<<$(node automation/caxa/parse-version.js); \
    echo "branch=${branch}" "owner=${owner}" "repo=${repo}" "version=${version}"
RUN unset IFS; read branch owner repo version <<<$(node automation/caxa/parse-version.js) && \
    echo "branch=${branch}" "owner=${owner}" "repo=${repo}" "version=${version}" && \
    resinci-deploy store github-release dist/* --branch=$branch --owner=$owner --repo=$repo --version=$version

CMD /bin/bash
