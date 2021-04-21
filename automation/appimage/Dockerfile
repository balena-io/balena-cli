FROM ubuntu:20.04
WORKDIR /usr/src/app
RUN apt-get -q update && apt-get -qy install fuse file curl unzip
COPY balena.desktop icon.png make-appimage.sh ./
RUN chmod +x /usr/src/app/make-appimage.sh
