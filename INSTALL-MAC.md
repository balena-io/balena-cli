# balena CLI Installation Instructions for macOS

These instructions are for the recommended installation option. Advanced users may also be
interested in [advanced installation options](./INSTALL-ADVANCED.md).

Selected operating system: **macOS**

1. Download the installer from the [latest release
   page](https://github.com/balena-io/balena-cli/releases/latest).
   Look for a file name that ends with "-installer.pkg":  
   `balena-cli-vX.Y.Z-macOS-x64-installer.pkg`  

2. Double click the downloaded file to run the installer. After the installation completes,
   close and re-open any open [command
   terminal](https://www.balena.io/docs/reference/cli/#choosing-a-shell-command-promptterminal)
   windows (so that the changes made by the installer to the PATH environment variable can take
   effect).

3. Check that the installation was successful by running the following commands on a
   command terminal:  
   * `balena version` - should print the CLI's version
   * `balena help` - should print a list of available commands

No further steps are required to run most CLI commands. The `balena ssh`, `build`, `deploy`
and `preload` commands may require additional software to be installed, as described below.

## Additional Dependencies

### build and deploy

These commands require [Docker](https://docs.docker.com/install/overview/) or
[balenaEngine](https://www.balena.io/engine/) to be available (on a local or remote machine). Most
users will simply follow [Docker's installation
instructions](https://docs.docker.com/install/overview/) to install Docker on the same laptop (dev
machine) where the balena CLI is installed. The [advanced installation
options](./INSTALL-ADVANCED.md) document describes other possibilities.

### balena ssh

The `balena ssh` command requires the `ssh` command-line tool to be available. To check whether
it is already installed, run `ssh` on a Terminal window. If it is not yet installed, the options
include:

* Download the Xcode Command Line Tools from https://developer.apple.com/downloads
* Or, if you have Xcode installed, open Xcode, choose Preferences → General → Downloads →
  Components → Command Line Tools → Install.
* Or, install [Homebrew](https://brew.sh/), then `brew install openssh`

The `balena ssh` command also requires an SSH key to be added to your balena account: see [SSH
Access documentation](https://www.balena.io/docs/learn/manage/ssh-access/). The `balena key*`
command set can also be used to list and manage SSH keys: see `balena help -v`.

### balena preload

Like the `build` and `deploy` commands, the `preload` command requires Docker, with the additional
restriction that Docker must be installed on the local machine (because Docker's bind mounting
feature is used). Also, for some device types (such as the Raspberry Pi), the `preload` command
requires Docker to support the [AUFS storage
driver](https://docs.docker.com/storage/storagedriver/aufs-driver/). Unfortunately, Docker Desktop
for Windows dropped support for the AUFS filesystem in Docker CE versions greater than 18.06.1. The
present workaround is to either:

* Downgrade Docker Desktop to version 18.06.1. Link: [Docker CE for
  Mac](https://docs.docker.com/docker-for-mac/release-notes/#docker-community-edition-18061-ce-mac73-2018-08-29)
* Install the balena CLI on a Linux machine (as Docker for Linux still supports AUFS). A Linux
  Virtual Machine also works, but a Docker container is _not_ recommended.

Long term, we are working on replacing AUFS with overlay2 for the affected device types.
