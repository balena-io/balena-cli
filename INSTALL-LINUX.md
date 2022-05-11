# balena CLI Installation Instructions for Linux

These instructions are suitable for most Linux distributions on Intel x86, such as
Ubuntu, Debian, Fedora, Arch Linux and other glibc-based distributions.
For the ARM architecture and for Linux distributions not based on glibc, such as
Alpine Linux, follow the [NPM Installation](./INSTALL-ADVANCED.md#npm-installation)
method.

Selected operating system: **Linux**

1. Download the latest zip file from the [latest release
   page](https://github.com/balena-io/balena-cli/releases/latest). Look for a file name that ends
   with "-standalone.zip", for example:  
   `balena-cli-vX.Y.Z-linux-x64-standalone.zip`

2. Extract the zip file contents to any folder you choose, for example `/home/james`.
   The extracted contents will include a `balena-cli` folder.

3. Add that folder (e.g. `/home/james/balena-cli`) to the `PATH` environment variable.
   Check this [StackOverflow
   post](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix)
   for instructions. Close and reopen the terminal window so that the changes to `PATH`
   can take effect.

4. Check that the installation was successful by running the following commands on a
   terminal window:  
   * `balena version` - should print the CLI's version
   * `balena help` - should print a list of available commands

To update the balena CLI to a new version, download a new release zip file and replace the previous
installation folder. To uninstall, simply delete the folder and edit the PATH environment variable
as described above.

## sudo configuration

A few CLI commands require execution through sudo, e.g. `sudo balena scan`.  
If your Linux distribution has an `/etc/sudoers` file that defines a `secure_path`
setting, run `sudo visudo` to edit it and add the balena CLI's installation folder to
the ***pre-existing*** `secure_path` setting, for example:

```text
Defaults   secure_path="/home/james/balena-cli:<pre-existing entries go here>"
```

If an `/etc/sudoers` file does not exist, or if it does not contain a pre-existing
`secure_path` setting, do not change it.

If you also have Docker installed, ensure that it can be executed ***without*** `sudo`, so that
CLI commands like `balena build` and `balena preload` can also be executed without `sudo`.
Check Docker's [post-installation
steps](https://docs.docker.com/engine/install/linux-postinstall/) on how to achieve this.

## Additional Dependencies

### build, deploy

These commands require [Docker](https://docs.docker.com/install/overview/) or
[balenaEngine](https://www.balena.io/engine/) to be available on a local or remote
machine. Most users will follow [Docker's installation
instructions](https://docs.docker.com/install/overview/) to install Docker on the same
workstation as the balena CLI. The [advanced installation
options](./INSTALL-ADVANCED.md#additional-dependencies) document describes other possibilities.

### balena ssh

The `balena ssh` command requires the `ssh` command-line tool to be available. Most Linux
distributions will already have it installed. Otherwise, `sudo apt-get install openssh-client`
should do the trick on Debian or Ubuntu.

The `balena ssh` command also requires an SSH key to be added to your balena account: see [SSH
Access documentation](https://www.balena.io/docs/learn/manage/ssh-access/). The `balena key*`
command set can also be used to list and manage SSH keys: see `balena help -v`.

### balena scan

The `balena scan` command requires a multicast DNS (mDNS) service like
[Avahi](https://en.wikipedia.org/wiki/Avahi_(software)), which is installed by default on most
desktop Linux distributions. Otherwise, on Debian or Ubuntu, the installation command would be
`sudo apt-get install avahi-daemon`.

### balena preload

Like the `build` and `deploy` commands, the `preload` command requires Docker, with the additional
restriction that Docker must be installed on the local machine (because Docker's bind mounting
feature is used).
