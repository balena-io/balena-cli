# Docker Images for balena CLI

Docker images with balena CLI and docker-in-docker.

## Available architectures

- `rpi`
- `armv7hf`
- `aarch64` (debian only)
- `amd64`
- `i386`

## Basic Usage

Here's a small example of running a single, detached container
in the background and using `docker exec` to run balena CLI commands.

```
$ docker run --detach --privileged --network host --name cli --rm -it balenalib/amd64-debian-balenacli /bin/bash

$ docker exec -it cli balena version -a
balena-cli version "12.38.1"
Node.js version "12.19.1"

$ docker exec -it cli balena login --token abc...

$ docker exec -it cli balena whoami
== ACCOUNT INFORMATION
USERNAME: ...
EMAIL:    ...
URL:      balena-cloud.com

$ docker exec -it cli balena apps
ID      APP NAME         SLUG                            DEVICE TYPE     ONLINE DEVICES DEVICE COUNT
1491721 test-nuc         gh_paulo_castro/test-nuc        intel-nuc       0              1
...

$ docker exec -it cli balena app test-nuc
== test-nuc
ID:          149...
DEVICE TYPE: intel-nuc
SLUG:        gh_.../test-nuc
COMMIT:      ce9...
```

## Advanced Usage

The following are examples of running the docker image in various
modes in order to allow only the required functionality, and not
elevate permissions unless required.

### scan

- <https://www.balena.io/docs/reference/balena-cli/#scan>

```bash
# balena scan requires the host network and NET_ADMIN
docker run --rm -it --cap-add NET_ADMIN --network host \
    balenalib/amd64-debian-balenacli scan
```

### ssh

- <https://www.balena.io/docs/reference/balena-cli/#login>
- <https://www.balena.io/docs/reference/balena-cli/#key-add-name-path>
- <https://www.balena.io/docs/reference/balena-cli/#ssh-applicationordevice-service>

```bash
# balena ssh requires a private ssh key
docker run --rm -it -e SSH_PRIVATE_KEY="$(</path/to/priv/key)" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena ssh f49cefd my-service
> exit

# OR use your host ssh agent socket with a key already loaded
docker run --rm -it -e SSH_AUTH_SOCK -v "$(dirname "${SSH_AUTH_SOCK}")" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena ssh f49cefd my-service
> exit
```

### build | deploy

- <https://www.balena.io/docs/reference/balena-cli/#build-source>
- <https://www.balena.io/docs/reference/balena-cli/#deploy-appname-image>

```bash
# docker-in-docker requires SYS_ADMIN
# note that we are mounting your app source into the container
# with -v $PWD:$PWD -w $PWD for convenience
docker run --rm -it --cap-add SYS_ADMIN \
    -v $PWD:$PWD -w $PWD \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena build --application myApp
> balena deploy myApp
> exit

# OR use your host docker socket
# note that we are mounting your app source into the container
# with -v $PWD:$PWD -w $PWD for convenience
docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:$PWD -w $PWD \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena build --application myApp
> balena deploy myApp
> exit
```

### preload

- <https://www.balena.io/docs/reference/balena-cli/#os-download-type>
- <https://www.balena.io/docs/reference/balena-cli/#os-configure-image>
- <https://www.balena.io/docs/reference/balena-cli/#preload-image>

```bash
# docker-in-docker requires SYS_ADMIN
docker run --rm -it --cap-add SYS_ADMIN \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena os download raspberrypi3 -o raspberry-pi.img
> balena os configure raspberry-pi.img --app MyApp
> balena preload raspberry-pi.img --app MyApp --commit current
> exit

# OR use your host docker socket
# note the .img path must be the same on the host as in the container
# therefore we are using -v $PWD:$PWD -w $PWD so the paths align
docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:$PWD -w $PWD \
    balenalib/amd64-debian-balenacli /bin/bash

> balena login --credentials --email johndoe@gmail.com --password secret
> balena os download raspberrypi3 -o raspberry-pi.img
> balena os configure raspberry-pi.img --app MyApp
> balena preload raspberry-pi.img --app MyApp --commit current
> exit
```

## Custom images / contributing

The following script / steps may be used to create custom CLI images or
to contribute bug reports, fixes or features.

```bash
# optionally enable qemu for cross-compiling
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

export BALENA_ARCH="amd64"
export BALENA_DISTRO="debian"
export BALENA_CLI_VERSION="12.38.0"

docker build ${BALENA_DISTRO} \
    --build-arg BALENA_ARCH \
    --build-arg BALENA_CLI_VERSION \
    --tag "balenalib/${BALENA_ARCH}-${BALENA_DISTRO}-balenacli:${BALENA_CLI_VERSION}" \
    --tag "balenalib/${BALENA_ARCH}-${BALENA_DISTRO}-balenacli:latest" \
    --pull
```
