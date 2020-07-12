# balena CLI Installation Instructions

There are 3 options to choose from to install balena's CLI:

* [Executable Installer](#executable-installer): the easiest method on Windows and macOS, using the
  traditional graphical desktop application installers.
* [Standalone Zip Package](#standalone-zip-package): these are plain zip files with the balena CLI
  executable in them: extract and run. Available for all platforms: Linux, Windows, macOS.
  Recommended also for scripted installation in CI (continuous integration) environments.
* [NPM Installation](#npm-installation): recommended for Node.js developers who may be interested
  in integrating the balena CLI in their existing projects or workflow.

Some specific CLI commands have a few extra installation steps: see section [Additional
Dependencies](#additional-dependencies).

> **Windows users:**
> * There is a [YouTube video tutorial](https://www.youtube.com/watch?v=2LApclXFqsg) for installing
>   and getting started with the balena CLI on Windows. (The video uses the standalone zip package
>   option.)
> * If you are using Microsoft's [Windows Subsystem for
>   Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL), install a balena CLI release
>   for Linux rather than for Windows, like the standalone zip package for Linux. An installation
>   with the graphical executable installer for Windows will **not** work with WSL.

## Executable Installer

Recommended for Windows (but not Windows Subsystem for Linux) and macOS:

1. Download the latest installer from the [releases page](https://github.com/balena-io/balena-cli/releases).
   Look for a file name that ends with "-installer", for example:  
   `balena-cli-vX.Y.Z-windows-x64-installer.exe`  
   `balena-cli-vX.Y.Z-macOS-x64-installer.pkg`

2. Double click the downloaded file to run the installer.  
   _If you are using macOS Catalina (10.15), [check this known issue and
   workaround](https://github.com/balena-io/balena-cli/issues/1479)._

3. After the installation completes, close and re-open any open [command
   terminal](https://www.balena.io/docs/reference/cli/#choosing-a-shell-command-promptterminal)
   windows so that the changes made by the installer to the PATH environment variable can take
   effect. Check that the installation was successful by running the following commands on a
   command terminal:

* `balena version` - should print the installed CLI version
* `balena help` - should print the balena CLI help

> Note: If you had previously installed the CLI using a standalone zip package, it may be a good
> idea to check your system's `PATH` environment variable for duplicate entries, as the terminal
> will use the entry that comes first. Check the [Standalone Zip Package](#standalone-zip-package)
> instructions for how to modify the PATH variable.

By default, the CLI is installed to the following folders:

OS  | Folders
--- | ---
Windows: | `C:\Program Files\balena-cli\`
macOS:   | `/usr/local/lib/balena-cli/` <br> `/usr/local/bin/balena`

## Standalone Zip Package

1. Download the latest zip file from the [releases page](https://github.com/balena-io/balena-cli/releases).
   Look for a file name that ends with the word "standalone", for example:  
   `balena-cli-vX.Y.Z-linux-x64-standalone.zip`  ← _also for the Windows Subsystem for Linux_  
   `balena-cli-vX.Y.Z-macOS-x64-standalone.zip`  
   `balena-cli-vX.Y.Z-windows-x64-standalone.zip`

2. Extract the zip file contents to any folder you choose. The extracted contents will include a
   `balena-cli` folder.

3. Add the `balena-cli` folder to the system's `PATH` environment variable.  
   See instructions for:
   [Linux](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix) |
   [macOS](https://www.architectryan.com/2012/10/02/add-to-the-path-on-mac-os-x-mountain-lion/#.Uydjga1dXDg) |
   [Windows](https://www.computerhope.com/issues/ch000549.htm)

> * If you are using macOS Catalina (10.15), [check this known issue and
>   workaround](https://github.com/balena-io/balena-cli/issues/1479).
> * **Linux Alpine** and **Busybox:** the standalone zip package is not currently compatible with
>   these "compact" Linux distributions, because of the alternative C libraries they ship with.
>   It should however work with all "desktop" or "server" distributions, e.g. Ubuntu, Debian, Suse,
>   Fedora, Arch Linux and many more.
> * Note that moving the `balena` executable out of the extracted `balena-cli` folder on its own
>   (e.g. moving it to `/usr/local/bin/balena`) will **not** work, as it depends on the other
>   folders and files also present in the `balena-cli` folder.

To update the CLI to a new version, download a new release zip file and replace the previous
installation folder. To uninstall, simply delete the folder and edit the PATH environment variable
as described above.

## NPM Installation

If you are a Node.js developer, you may wish to install the balena CLI via [npm](https://www.npmjs.com).
The npm installation involves building native (platform-specific) binary modules, which require
some additional development tools to be installed first:

* [Node.js](https://nodejs.org/) version 10 (min **10.20.0**) or 12 (version 14 is not yet fully supported)
  * **Linux, macOS** and **Windows Subsystem for Linux (WSL):**  
    Installing Node via [nvm](https://github.com/nvm-sh/nvm/blob/master/README.md) is recommended.
    When the "system" or "default" Node.js and npm packages are installed with "apt-get" in Linux
    distributions like Ubuntu, users often report permission or compilation errors when running
    "npm install". This [sample
    Dockerfile](https://gist.github.com/pdcastro/5d4d96652181e7da685a32caf629dd44) shows the CLI
    installation steps on an Ubuntu 18.04 base image.
* [Python 2.7](https://www.python.org/), [git](https://git-scm.com/), [make](https://www.gnu.org/software/make/), [g++](https://gcc.gnu.org/)
  * **Linux** and **Windows Subsystem for Linux (WSL):**  
    `sudo apt-get install -y python git make g++`
  * **macOS:** install Apple's Command Line Tools by running on a Terminal window:  
    `xcode-select --install`

On **Windows (not WSL),** the dependencies above and additional ones can be met by installing:

* Node.js from the [Nodejs.org download page](https://nodejs.org/en/download/).
* The [MSYS2 shell](https://www.msys2.org/), which provides `git`, `make`, `g++`, `ssh`, `rsync`
  and more:
  * `pacman -S git openssh rsync gcc make`
  * [Set a Windows environment variable](https://www.onmsft.com/how-to/how-to-set-an-environment-variable-in-windows-10): `MSYS2_PATH_TYPE=inherit`
  * Note that a bug in the MSYS2 launch script (`msys2_shell.cmd`) makes text-based
    interactive CLI menus to misbehave. [Check this Github issue for a
    workaround](https://github.com/msys2/MINGW-packages/issues/1633#issuecomment-240583890).
* The Windows Driver Kit (WDK), which is needed to compile some native Node modules. It is **not**
  necessary to install Visual Studio, only the WDK, which is "step 2" in the following guides:
  * [WDK for Windows 10](https://docs.microsoft.com/en-us/windows-hardware/drivers/download-the-wdk#download-icon-step-2-install-wdk-for-windows-10-version-1903)
  * [WDK for earlier versions of Windows](https://docs.microsoft.com/en-us/windows-hardware/drivers/other-wdk-downloads#step-2-install-the-wdk)
* The [windows-build-tools](https://www.npmjs.com/package/windows-build-tools) npm package (which
  provides Python 2.7 and more), by running the following command on an [administrator
  console](https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/):
  
  `npm install -g --production windows-build-tools`

With these dependencies in place, the balena CLI installation command is:

```sh
$ npm install balena-cli -g --production --unsafe-perm
```

`--unsafe-perm` is required when `npm install` is executed as the root user, or on systems where
the global install directory is not user-writable. It allows npm install steps to download and save
prebuilt native binaries, and also allows the execution of npm scripts like `postinstall` that are
used to patch dependencies. It is usually possible to omit `--unsafe-perm` if installing under a
regular (non-root) user account, especially if using a user-managed node installation such as
[nvm](https://github.com/creationix/nvm).


## Additional Dependencies

* The `balena ssh` command requires a recent version of the `ssh` command-line tool to be available:
  * macOS and Linux usually already have it installed. Otherwise, search for the available packages
    on your specific Linux distribution, or for the Mac consider the [Xcode command-line
    tools](https://developer.apple.com/xcode/features/) or [homebrew](https://brew.sh/).

  * Microsoft started distributing an SSH client with Windows 10, which we understand is
    automatically installed through Windows Update, but can be manually installed too
    ([more information](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)).
    For other versions of Windows, there are several ssh/OpenSSH clients provided by 3rd parties.

  * The [`proxytunnel`](http://proxytunnel.sourceforge.net/) package (command-line tool) is needed
    for the `balena ssh` command to work behind a proxy. It is available for Linux distributions
    like Ubuntu/Debian (`apt install proxytunnel`), and for macOS through
    [Homebrew](https://brew.sh/). Windows support is limited to the Windows Subsystem for Linux
    (e.g., by installing Ubuntu through the Microsoft App Store). Check the
    [README](https://github.com/balena-io/balena-cli/blob/master/README.md) file for proxy
    configuration instructions.

* The `balena preload`, `balena build` and `balena deploy --build` commands require
  [Docker](https://docs.docker.com/install/overview/) or [balenaEngine](https://www.balena.io/engine/)
  to be available:
  * The `balena preload` command requires the Docker Engine to support the [AUFS storage
    driver](https://docs.docker.com/storage/storagedriver/aufs-driver/). Docker Desktop for Mac and
    Windows dropped support for the AUFS filesystem in Docker CE versions greater than 18.06.1, so
    the workaround is to downgrade to version 18.06.1 (links: [Docker CE for
    Windows](https://docs.docker.com/docker-for-windows/release-notes/#docker-community-edition-18061-ce-win73-2018-08-29)
    and [Docker CE for
    Mac](https://docs.docker.com/docker-for-mac/release-notes/#docker-community-edition-18061-ce-mac73-2018-08-29)).
    See more details in [CLI issue 1099](https://github.com/balena-io/balena-cli/issues/1099).
  * Commonly, Docker is installed on the same machine where the CLI is being used, but the
    `balena build` and `balena deploy` commands can also use a remote Docker Engine (daemon)
    or balenaEngine (which could be a remote device running a [balenaOS development
    image](https://www.balena.io/docs/reference/OS/overview/2.x/#dev-vs-prod-images)) by specifying
    its IP address and port number as command-line options. Check the documentation for each
    command, e.g. `balena help build`, or the [online
    reference](https://www.balena.io/docs/reference/cli/#cli-command-reference).
  * If you are using Microsoft's [Windows Subsystem for
    Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL) and Docker Desktop for
    Windows, check the [FAQ item "Docker seems to be
    unavailable"](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md#docker-seems-to-be-unavailable-error-when-using-windows-subsystem-for-linux-wsl).

* The `balena scan` command requires a multicast DNS (mDNS) service like Bonjour or Avahi:
  * On Windows, check if 'Bonjour' is installed (Control Panel > Programs and Features).
    If not, you can download Bonjour for Windows from https://support.apple.com/kb/DL999
  * Most 'desktop' Linux distributions ship with [Avahi](https://en.wikipedia.org/wiki/Avahi_(software)).
    Search for the installation command for your distribution. E.g. for Ubuntu:
    `sudo apt-get install avahi-daemon`
  * macOS comes with [Bonjour](https://en.wikipedia.org/wiki/Bonjour_(software)) built-in.
  
* The `balena os configure` command is currently not supported on Windows natively. Windows users are advised 
  to install the [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL) 
  with Ubuntu, and use the Linux release of the balena CLI.
  

## Configuring SSH keys

The `balena ssh` command requires an SSH key to be added to your balena account. If you had
already added a SSH key in order to [deploy with 'git push'](https://www.balena.io/docs/learn/getting-started/raspberrypi3/nodejs/#adding-an-ssh-key),
then you are probably done and may skip this section. You can check whether you already have
an SSH key in your balena account with the `balena keys` command, or by visiting the
[balena web dashboard](https://dashboard.balena-cloud.com/), clicking on your name -> Preferences
-> SSH Keys.

> Note: An "SSH key" actually consists of a public/private key pair. A typical name for the private
> key file is "id_rsa", and a typical name for the public key file is "id_rsa.pub". Both key files
> are saved to your computer (with the private key optionally protected by a password), but only
> the public key is saved to your balena account. This means that if you change computers or
> otherwise lose the private key, _you cannot recover the private key through your balena account._
> You can however add new keys, and delete the old ones.

If you don't have an SSH key in your balena account:

* If you have an existing SSH key in your computer that you would like to use, you can add it
  to your balena account through the balena web dashboard (Preferences -> SSH Keys), or through
  the CLI itself:

```bash
# Windows 10 (cmd.exe prompt) example:
$ balena key add MyKey %userprofile%\.ssh\id_rsa.pub
# Linux / macOS example:
$ balena key add MyKey ~/.ssh/id_rsa.pub
```

* To generate a new key, you can follow [GitHub's documentation](https://help.github.com/en/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent),
  skipping the step about adding the key to your GitHub account, and instead adding the key to
  your balena account as described above.
