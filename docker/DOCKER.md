# Docker Images for the balena CLI

Docker images with the balena CLI and Docker-in-Docker.

## Features Overview

These CLI images are based on the popular [Balena base images](https://www.balena.io/docs/reference/base-images/base-images/)
so they include many of the features you see there.

- Multiple Architectures:
    - `rpi`
    - `armv7hf`
    - `aarch64`
    - `amd64`
    - `i386`
- Multiple Distributions
    - `debian`
    - `alpine`
- [cross-build](https://www.balena.io/docs/reference/base-images/base-images/#building-arm-containers-on-x86-machines) functionality for building ARM containers on x86.
- Helpful package installer script called `install_packages` inspired by [minideb](https://github.com/bitnami/minideb#why-use-minideb).

Note that there are some additional considerations when running the CLI via Docker so
pay close attention to the [Usage](#usage) section for examples of different CLI commands.

## Image Names

`balenalib/<arch>-<distro>-balenacli:<cli_ver>`

- `<arch>` is the architecture and is mandatory. If using `Dockerfile.template`, you can replace this with `%%BALENA_ARCH%%`.
For a list of available device names and architectures, see the [Device types](https://www.balena.io/docs/reference/base-images/devicetypes/).
- `<distro>` is the Linux distribution and is mandatory. Currently there are 2 distributions, namely `debian` and `alpine`.

## Image Tags

In the tags, all of the fields are optional, and if they are left out, they will default to their `latest` pointer.

- `<cli_ver>` is the version of the balena CLI, for example, `12.40.2`, it can also be substituted for `latest`.

## Examples

`balenalib/amd64-debian-balenacli:12.40.2`

- `<arch>`: amd64 - suitable for running on most workstations
- `<distro>`: debian - widely used base distro
- `<cli_ver>`: 12.40.2

`balenalib/armv7hf-alpine-balenacli`

- `<arch>`: armv7hf - suitable for running on a Raspberry Pi 3 for example
- `<distro>`: alpine - smaller footprint than debian
- `<cli_ver>`: omitted - the latest available CLI version will be used

## Volumes

Volumes can be used to persist data between instances of the CLI container, or to share
files between the host and the container.
In most cases these are optional, but some examples will highlight when volumes are required.

- `-v "balena_data:/root/.balena"`: persist balena credentials and downloads between instances
- `-v "docker_data:/var/lib/docker"`: persist cache between instances when using Docker-in-Docker (requires `-e "DOCKERD=1"`)
- `-v "$PWD:$PWD" -w "$PWD"`: bind mount your current working directory in the container to share app sources or balenaOS image files
- `-v "${SSH_AUTH_SOCK}:/ssh-agent"`: bind mount your host ssh-agent socket with preloaded SSH keys
- `-v "/var/run/docker.sock:/var/run/docker.sock"`: bind mount your host Docker socket instead of Docker-in-Docker

## Environment Variables

These environment variables are available for additional functionality included in the CLI image.
In most cases these are optional, but some examples will highlight when environment variables are required.

- `-e "SSH_PRIVATE_KEY=$(</path/to/priv/key)"`: copy your private SSH key file contents as an environment variable
- `-e "DOCKERD=1"`: enable the included Docker-in-Docker daemon (requires `--privileged`)

## Keeping the CLI image up to date

Please note that using the `:latest` tag is not enough to keep the image up to date,
because Docker will reuse a locally cached image. To update the image to the latest
version, run:

```bash
$ docker pull balenalib/<arch>-<distro>-balenacli
```

Replacing `<arch>` and `<distro>` with the image architecture and distribution as
described earlier.

If you are using Docker v19.09 or later, you can also add the `--pull always` flag to
`docker run` commands, so that Docker automatically checks for available updates
(new image layers will only be downloaded if a new version is available).

## Usage

We've provided some examples of common CLI commands and how they are best used
with this image, since some special considerations must be made.

- [login](#login) - login to balena
- [push](#push) - start a build on the remote balenaCloud build servers, or a local mode device
- [logs](#logs) - show device logs
- [ssh](#ssh) - SSH into the host or application container of a device
- [apps](#app--apps) - list all applications
- [app](#app--apps) - display information about a single application
- [devices](#device--devices) - list all devices
- [device](#device--devices) - show info about a single device
- [tunnel](#tunnel) - tunnel local ports to your balenaOS device
- [preload](#preload) - preload an app on a disk image (or Edison zip archive)
- [build](#build--deploy) - build a project locally
- [deploy](#build--deploy) - deploy a single image or a multicontainer project to a balena application
- [join](#join--leave) - move a local device to an application on another balena server
- [leave](#join--leave) - remove a local device from its balena application
- [scan](#scan) - scan for balenaOS devices on your local network

For each example we have also linked to the corresponding sections of the
balena CLI Documentation here: https://www.balena.io/docs/reference/balena-cli

### login

- <https://www.balena.io/docs/reference/balena-cli/#login>

The `balena login` command can't be used with web authorization and a browser
when running in a container. Instead it must be used with `--token` or `--credentials`.

Notice that here we've used a named volume `balena_data` to store credentials
for future runs of the CLI image. This is optional but avoids having to run the login
command again every time you run the image.

```bash
$ docker volume create balena_data
$ docker run --rm -it -v "balena_data:/root/.balena" balenalib/amd64-debian-balenacli /bin/bash
    
> balena login --credentials --email "johndoe@gmail.com" --password "secret"
> balena login --token "..."
> exit
```

### push

- <https://www.balena.io/docs/reference/balena-cli/#push-applicationordevice>

In this example we are mounting your current working directory into the container with `-v "$PWD:$PWD" -w "$PWD"`.
This will bind mount your current working directory into the container at the same absolute path.

This bind mount is required so the CLI has access to your app sources.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "$PWD:$PWD" -w "$PWD" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena push myApp --source .
> balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value
> exit
```

### logs

- <https://www.balena.io/docs/reference/balena-cli/#logs-device>

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena logs 23c73a1 --service my-service
> balena logs 23c73a1.local --system --tail
> exit
```

### ssh

- <https://www.balena.io/docs/reference/balena-cli/#key-add-name-path>
- <https://www.balena.io/docs/reference/balena-cli/#ssh-applicationordevice-service>

The `balena ssh` command requires an existing SSH key added to your balenaCloud
account.

One way to make this key available to the container is to pass the private key file contents as an environment variable.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -e "SSH_PRIVATE_KEY=$(</path/to/priv/key)" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena ssh f49cefd
> balena ssh f49cefd my-service
> balena ssh 192.168.0.1 --verbose
> exit
```

Another way to share SSH keys with the container is to mount your SSH agent socket with keys preloaded.

```bash
$ eval ssh-agent
$ ssh-add /path/to/priv/key

$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "${SSH_AUTH_SOCK}:/ssh-agent" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena ssh f49cefd
> balena ssh f49cefd my-service
> balena ssh 192.168.0.1 --verbose
> exit
```

### app | apps

- <https://www.balena.io/docs/reference/balena-cli/#app-nameorslug>
- <https://www.balena.io/docs/reference/balena-cli/#apps>

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena apps
> balena app myorg/myapp
> exit
```

### device | devices

- <https://www.balena.io/docs/reference/balena-cli/#device-uuid>
- <https://www.balena.io/docs/reference/balena-cli/#devices>

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena devices --application MyApp
> balena device 7cf02a6
> exit
```

### tunnel

- <https://www.balena.io/docs/reference/balena-cli/#tunnel-deviceorapplication>

The `balena tunnel` command is easiest used when the host networking stack
can be shared with the container and ports can be easily assigned.

However the host networking driver only works on Linux hosts, and is not supported
on Docker Desktop for Mac, Docker Desktop for Windows, or Docker EE for Windows Server.

Instead you can bind specific port ranges to the host so you can access the tunnel
from outside the container via `localhost:[localPort]`.

Note that when exposing individual ports, you must specify all interfaces in the format
`[remotePort]:0.0.0.0:[localPort]` otherwise the tunnel will only be listening for
connections within the container.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -p 22222:22222 \
    -p 12345:54321
    balenalib/amd64-debian-balenacli /bin/bash

> balena tunnel 2ead211 -p 22222:0.0.0.0
> balena tunnel myApp -p 54321:0.0.0.0:12345
> exit
```

If you have host networking available then you do not need to specify ports
in your run command, and the interface `0.0.0.0` is optional in your tunnel command.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    --network host \
    balenalib/amd64-debian-balenacli /bin/bash

> balena tunnel 2ead211 -p 22222
> balena tunnel myApp -p 54321:12345
> exit
```

### preload

- <https://www.balena.io/docs/reference/balena-cli/#os-download-type>
- <https://www.balena.io/docs/reference/balena-cli/#os-configure-image>
- <https://www.balena.io/docs/reference/balena-cli/#preload-image>

The `balena preload` command requires access to a Docker client and daemon.

The easiest way to run this command is to use the included Docker-in-Docker daemon.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "docker_data:/var/lib/docker" \
    -e "DOCKERD=1" --privileged \
    balenalib/amd64-debian-balenacli /bin/bash

> balena os download raspberrypi3 -o raspberry-pi.img
> balena os configure raspberry-pi.img --app MyApp
> balena preload raspberry-pi.img --app MyApp --commit current
> exit
```

Another way to run the `preload` command is to use the host OS Docker socket and avoid
starting a Docker daemon in the container. This is achieved with `-v "/var/run/docker.sock:/var/run/docker.sock"`.

In this example we are mounting your current working directory into the container with `-v "$PWD:$PWD" -w "$PWD"`.
This will bind mount your current working directory into the container at the same absolute path.

This bind mount is required when using the host Docker socket because the absolute path to the balenaOS image
file must be the same from both the perspective of the CLI in the container and the host Docker socket.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "/var/run/docker.sock:/var/run/docker.sock" \
    -v "$PWD:$PWD" -w "$PWD" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena os download raspberrypi3 -o raspberry-pi.img
> balena os configure raspberry-pi.img --app MyApp
> balena preload raspberry-pi.img --app MyApp --commit current
> exit
```

### build | deploy

- <https://www.balena.io/docs/reference/balena-cli/#build-source>
- <https://www.balena.io/docs/reference/balena-cli/#deploy-appname-image>

The `build` and `deploy` commands both require access to a Docker client and daemon.

The easiest way to run these commands is to use the included Docker-in-Docker daemon.

In this example we are mounting your current working directory into the container with `-v "$PWD:$PWD" -w "$PWD"`.
This will bind mount your current working directory into the container at the same absolute path.

This bind mount is required so the CLI has access to your app sources.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "docker_data:/var/lib/docker" \
    -e DOCKERD=1 --privileged \
    -v "$PWD:$PWD" -w "$PWD" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena build --application myApp
> balena deploy myApp
> exit
```

Another way to run the `build` and `deploy` commands is to use the host OS Docker socket and avoid
starting a Docker daemon in the container. This is achieved with `-v "/var/run/docker.sock:/var/run/docker.sock"`.

In this example we are mounting your current working directory into the container with `-v "$PWD:$PWD" -w "$PWD"`.
This will bind mount your current working directory into the container at the same absolute path.

This bind mount is required so the CLI has access to your app sources.

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    -v "/var/run/docker.sock:/var/run/docker.sock" \
    -v "$PWD:$PWD" -w "$PWD" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena build --application myApp
> balena deploy myApp
> exit
```

### join | leave

- <https://www.balena.io/docs/reference/balena-cli/#join-deviceiporhostname>
- <https://www.balena.io/docs/reference/balena-cli/#leave-deviceiporhostname>

```bash
$ docker run --rm -it -v "balena_data:/root/.balena" \
    balenalib/amd64-debian-balenacli /bin/bash

> balena join balena.local --application MyApp
> balena leave balena.local
> exit
```

### scan

- <https://www.balena.io/docs/reference/balena-cli/#scan>

The `balena scan` command requires access to the host network interface
in order to bind and listen for multicast responses from devices.

However the host networking driver only works on Linux hosts, and is not supported
on Docker Desktop for Mac, Docker Desktop for Windows, or Docker EE for Windows Server.

```bash
$ docker run --rm -it --network host balenalib/amd64-debian-balenacli scan
```

## Custom images / contributing

The following steps may be used to create custom CLI images or
to contribute bug reports, fixes or features.

```bash
# the currently supported base images are 'debian' and 'alpine'
export BALENA_DISTRO="debian"

# provide the architecture where you will be testing the image
export BALENA_ARCH="amd64"

# optionally register QEMU binfmt if building for other architectures (eg. armv7hf)
$ docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# build and tag an image with docker
docker build . -f docker/${BALENA_DISTRO}/Dockerfile \
    --build-arg "BUILD_BASE=balenalib/${BALENA_ARCH}-${BALENA_DISTRO}-node:12.19-build" \
    --build-arg "RUN_BASE=balenalib/${BALENA_ARCH}-${BALENA_DISTRO}-node:12.19-run" \
    --tag "balenalib/${BALENA_ARCH}-${BALENA_DISTRO}-balenacli"
```
