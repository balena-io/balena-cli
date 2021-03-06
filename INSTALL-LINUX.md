# balena CLI Installation Instructions for Linux

These instructions are for the recommended installation option. They are suitable for most Linux
distributions, except notably for **Linux Alpine** or **Busybox**. For these distros, see [advanced
installation options](./INSTALL-ADVANCED.md).

Selected operating system: **Linux**

1. Download the latest zip file from the [latest release
   page](https://github.com/balena-io/balena-cli/releases/latest). Look for a file name that ends
   with "-standalone.zip", for example:  
   `balena-cli-vX.Y.Z-linux-x64-standalone.zip`

2. Extract the zip file contents to any folder you choose. The extracted contents will include a
   `balena-cli` folder.

3. Add the full path to the `balena-cli` folder to the system's `PATH` environment variable. There are several
   ways of achieving this on Linux: See this [StackOverflow post](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix). Close and reopen the terminal window
   so that the changes to PATH can take effect.

4. Check that the installation was successful by running the following commands on a
   command terminal:  
   * `balena version` - should print the CLI's version
   * `balena help` - should print a list of available commands

No further steps are required to run most CLI commands. The `balena ssh`, `scan`, `build`,
`deploy` and `preload` commands may require additional software to be installed, as described
below.

To update the balena CLI to a new version, download a new release zip file and replace the previous
installation folder. To uninstall, simply delete the folder and edit the PATH environment variable
as described above.

## Additional Dependencies

### build, deploy

These commands require [Docker](https://docs.docker.com/install/overview/) or
[balenaEngine](https://www.balena.io/engine/) to be available (on a local or remote machine). Most
users will simply follow [Docker's installation
instructions](https://docs.docker.com/install/overview/) to install Docker on the same laptop (dev
machine) where the balena CLI is installed. The [advanced installation
options](./INSTALL-ADVANCED.md) document describes other possibilities.

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

`balena scan` needs to be run with sudo privileges, but in some cases this will return the message "sudo: balena: command not found". If this happens, you have to add the install location of `balena` to your sudoers file.

Open the sudoers file with `sudo visudo` and add the full path to the `balena-cli` folder to the `secure_path="..."` entry. There are already a couple of paths in this line, the new path needs to be separated from the others with a `:`. When you're done, save and close the file. 

For more information on this issue, have a look into [#2149](https://github.com/balena-io/balena-cli/issues/2149).

### balena preload

Like the `build` and `deploy` commands, the `preload` command requires Docker, with the additional
restriction that Docker must be installed on the local machine (because Docker's bind mounting
feature is used).
