# balena CLI Installation Instructions for Windows

These instructions are for the recommended installation option. Advanced users may also be
interested in [advanced installation options](./INSTALL-ADVANCED.md).

Selected operating system: **Windows**

1. Download the installer from the [latest release
   page](https://github.com/balena-io/balena-cli/releases/latest).
   Look for a file name that ends with "-installer.exe":  
   `balena-cli-vX.Y.Z-windows-x64-installer.exe`  

2. Double click the downloaded file to run the installer. After the installation completes,
   close and re-open any open [command
   terminal](https://www.balena.io/docs/reference/cli/#choosing-a-shell-command-promptterminal)
   windows (so that the changes made by the installer to the PATH environment variable can take
   effect).

3. Check that the installation was successful by running the following commands on a
   command terminal:  
   * `balena version` - should print the CLI's version
   * `balena help` - should print a list of available commands

No further steps are required to run most CLI commands. The `balena ssh`, `scan`, `build`,
`deploy`, `preload` and `os configure` commands may require additional software to be installed, as
described below.

## Additional Dependencies

### build and deploy

These commands require [Docker](https://docs.docker.com/install/overview/) or
[balenaEngine](https://www.balena.io/engine/) to be available (on a local or remote
machine). Most users will follow [Docker's installation
instructions](https://docs.docker.com/install/overview/) to install Docker on the same
workstation (laptop) as the balena CLI. The [advanced installation
options](./INSTALL-ADVANCED.md) document describes other possibilities.

### balena ssh

The `balena ssh` command requires the `ssh` command-line tool to be available. Microsoft started
distributing an SSH client with Windows 10, which is automatically installed through Windows
Update. To check whether it is installed, run `ssh` on a Windows Command Prompt or PowerShell. It
can also be [manually
installed](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)
if needed. For older versions of Windows, there are several ssh/OpenSSH clients provided by 3rd
parties.

The `balena ssh` command also requires an SSH key to be added to your balena account: see [SSH
Access documentation](https://www.balena.io/docs/learn/manage/ssh-access/). The `balena key*`
command set can also be used to list and manage SSH keys: see `balena help -v`.

### balena scan

The `balena scan` command requires a multicast DNS (mDNS) service like Apple's Bonjour.
Many Windows machines will already have this service installed, as it is bundled in popular
applications such as Skype (Wikipedia lists [several others](https://en.wikipedia.org/wiki/Bonjour_(software))).
Otherwise, Bonjour for Windows can be downloaded and installed from: https://support.apple.com/kb/DL999

### balena preload

Like the `build` and `deploy` commands, the `preload` command requires Docker, with the additional
restriction that Docker must be installed on the local machine (because Docker's bind mounting
feature is used). Also, preloading balenaOS images for some older device types (like the Raspberry
Pi 3, but not the Raspberry 4) requires Docker to support the [AUFS storage
driver](https://docs.docker.com/storage/storagedriver/aufs-driver/). Unfortunately, Docker Desktop
for Windows or macOS dropped support for the AUFS filesystem in Docker CE versions greater than
18.06.1. The present workarounds are to either:

* Install the balena CLI on Linux (e.g. Ubuntu) with a virtual machine like VirtualBox.
  This works because Docker for Linux still supports AUFS. Hint: if using a virtual machine,
  copy the image file over, rather than accessing it through "file sharing", to avoid errors.
* Downgrade Docker Desktop to version 18.06.1. Link: [Docker CE for
  Windows](https://docs.docker.com/docker-for-windows/release-notes/#docker-community-edition-18061-ce-win73-2018-08-29)

The [balena CLI Docker images](./docker/DOCKER.md) also support the `balena preload` command,
but they do not avoid the requirement of using a Linux physical or virtual machine. This is
because the AUFS storage driver is not present in the Linux kernel used by the newer versions
of Docker Desktop for Windows or macOS.

We are working on replacing AUFS with overlay2 in balenaOS images of the affected device types.
