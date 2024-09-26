# balena CLI Installation Instructions for macOS

These instructions are for the recommended installation option. Advanced users may also be
interested in [advanced installation options](./INSTALL-ADVANCED.md).

Selected operating system: **macOS**

1. Download the installer from the [latest release
   page](https://github.com/balena-io/balena-cli/releases/latest).
   Look for a file name that ends with "-installer.pkg":  
   `balena-cli-vX.Y.Z-macOS-x64-installer.pkg`  

2. Double click on the downloaded file to run the installer and follow the installer's
   instructions.

3. Check that the installation was successful:
   - [Open the Terminal
   app](https://support.apple.com/en-gb/guide/terminal/apd5265185d-f365-44cb-8b09-71a064a42125/mac).
   - On the terminal prompt, type `balena version` and hit Enter. It should display
     the version of the balena CLI that you have installed.

No further steps are required to run most CLI commands. The `balena device ssh`, `build`, `deploy`
and `preload` commands may require additional software to be installed, as described
in the next section.

To update the balena CLI, repeat the steps above for the new version.  
To uninstall it, run the following command on a terminal prompt:

```text
sudo /usr/local/src/balena-cli/bin/uninstall
```

## Additional Dependencies

### build and deploy

These commands require [Docker](https://docs.docker.com/install/overview/) or
[balenaEngine](https://www.balena.io/engine/) to be available on a local or remote
machine. Most users will follow [Docker's installation
instructions](https://docs.docker.com/install/overview/) to install Docker on the same
workstation as the balena CLI. The [advanced installation
options](./INSTALL-ADVANCED.md#additional-dependencies) document describes other possibilities.

### balena device ssh

The `balena device ssh` command requires the `ssh` command-line tool to be available. To check whether
it is already installed, run `ssh` on a Terminal window. If it is not yet installed, the options
include:

* Download the Xcode Command Line Tools from https://developer.apple.com/downloads
* Or, if you have Xcode installed, open Xcode, choose Preferences → General → Downloads →
  Components → Command Line Tools → Install.
* Or, install [Homebrew](https://brew.sh/), then `brew install openssh`

The `balena device ssh` command also requires an SSH key to be added to your balena account: see [SSH
Access documentation](https://www.balena.io/docs/learn/manage/ssh-access/). The `balena key*`
command set can also be used to list and manage SSH keys: see `balena help -v`.

### balena preload

Like the `build` and `deploy` commands, the `preload` command requires Docker.
Preloading balenaOS images for some older device types (like the Raspberry
Pi 3, but not the Raspberry 4) requires Docker to support the [AUFS storage
driver](https://docs.docker.com/storage/storagedriver/aufs-driver/). Unfortunately, Docker Desktop
for Windows and macOS dropped support for the AUFS filesystem in Docker CE versions greater than
18.06.1. The present workarounds are to either:

* Install the balena CLI on Linux (e.g. Ubuntu) with a virtual machine like VirtualBox.
  This works because Docker for Linux still supports AUFS. Hint: if using a virtual machine,
  copy the image file over, rather than accessing it through "file sharing", to avoid errors.
* Downgrade Docker Desktop to version 18.06.1. Link: [Docker CE for
  Mac](https://docs.docker.com/docker-for-mac/release-notes/#docker-community-edition-18061-ce-mac73-2018-08-29)

We are working on replacing AUFS with overlay2 in balenaOS images of the affected device types.
