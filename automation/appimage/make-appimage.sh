#!/usr/bin/env bash

curl -LO https://github.com/balena-io/balena-cli/releases/download/v12.44.11/balena-cli-v12.44.11-linux-x64-standalone.zip
curl -Lo /usr/local/bin/appimagetool https://github.com/AppImage/AppImageKit/releases/download/12/appimagetool-x86_64.AppImage
chmod +x /usr/local/bin/appimagetool
unzip -q balena-cli-v12.44.11-linux-x64-standalone.zip
mv balena-cli/balena balena-cli/AppRun
cp balena.desktop icon.png balena-cli/
ARCH=x86_64 appimagetool balena-cli
mv balena-x86_64.AppImage /usr/local/bin/balena

/usr/local/bin/balena version -a
