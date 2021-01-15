#!/bin/sh

# start dockerd if socket not mounted from host
if ! docker info >/dev/null 2>&1
then
    [ -e /var/run/docker.sock ] && rm /var/run/docker.sock
    dockerd &
fi

# start ssh agent if socket not mounted from host
if [ ! -e "${SSH_AUTH_SOCK}" ]
then
    eval "$(ssh-agent -s)"
fi

# install private ssh key if one is provided
if [ -n "${SSH_PRIVATE_KEY}" ]
then
    echo "${SSH_PRIVATE_KEY}" | tr -d '\r' | ssh-add -
fi

# try to determine if an executable was provided or just args
if [ "${1}" = "balena" ] || [ -x "${1}" ] || "${1}" -v >/dev/null 2>&1
then
    exec "$@"
else
    exec balena "$@"
fi
