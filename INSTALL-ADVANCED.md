# balena CLI Advanced Installation Options

**These are alternative, advanced installation options. Most users would prefer the [recommended,
streamlined installation
instructions](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).**

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

## Executable Installer

This is the recommended installation option on macOS and Windows. Follow the specific OS
instructions:

* [Windows](./INSTALL-WINDOWS.md)
* [macOS](./INSTALL-MAC.md)

> Note regarding WSL ([Windows Subsystem for
> Linux](https://docs.microsoft.com/en-us/windows/wsl/about))  
> If you would like to use WSL, follow the [installations instructions for
> Linux](./INSTALL-LINUX.md) rather than Windows, as WSL consists of a Linux environment.

If you had previously installed the CLI using a standalone zip package, it may be a good idea to
check your system's `PATH` environment variable for duplicate entries, as the terminal will use the
entry that comes first. Check the [Standalone Zip Package](#standalone-zip-package) instructions
for how to modify the PATH variable.

By default, the CLI is installed to the following folders:

OS  | Folders
--- | ---
Windows: | `C:\Program Files\balena-cli\`
macOS:   | `/usr/local/src/balena-cli/` <br> `/usr/local/bin/balena`

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

> * If you are using macOS 10.15 or later (Catalina, Big Sur), [check this known issue and
>   workaround](https://github.com/balena-io/balena-cli/issues/2244).
> * **Linux Alpine** and **Busybox:** the standalone zip package is not currently compatible with
>   these "compact" Linux distributions, because of the alternative C libraries they ship with.
>   For these, consider the [NPM Installation](#npm-installation) option.
> * Note that moving the `balena` executable out of the extracted `balena-cli` folder on its own
>   (e.g. moving it to `/usr/local/bin/balena`) will **not** work, as it depends on the other
>   folders and files also present in the `balena-cli` folder.

To update the CLI to a new version, download a new release zip file and replace the previous
installation folder. To uninstall, simply delete the folder and edit the PATH environment variable
as described above.

## NPM Installation

If you are a Node.js developer, you may wish to install the balena CLI via [npm](https://www.npmjs.com).
The npm installation involves building native (platform-specific) binary modules, which require
some development tools to be installed first, as follows.

> **The balena CLI currently requires Node.js version ^20.6.0**
> **Versions 21 and later are not yet fully supported.**

### Install development tools

#### **Linux or WSL** (Windows Subsystem for Linux)

```sh
$ sudo apt-get update && sudo apt-get -y install curl python3 git make g++
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
$ . ~/.bashrc
$ nvm install 20
```

The `curl` command line above uses
[nvm](https://github.com/nvm-sh/nvm/blob/master/README.md#install--update-script) to install
Node.js, instead of using `apt-get`. Installing Node.js through `apt-get` is a common source of
problems from permission errors to conflict with other system packages, and therefore not
recommended.

#### **macOS**

* Download and install Apple's Command Line Tools from https://developer.apple.com/downloads/
* Install Node.js through [nvm](https://github.com/nvm-sh/nvm/blob/master/README.md#install--update-script):

```sh
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
$ . ~/.bashrc
$ nvm install 20
```

#### **Windows** (not WSL)

Install:

  * If you'd like the ability to switch between Node.js versions, install
- Node.js v20 from the [Nodejs.org releases page](https://nodejs.org/en/download/releases/).
    [nvm-windows](https://github.com/coreybutler/nvm-windows#node-version-manager-nvm-for-windows)
    instead.
* The [MSYS2 shell](https://www.msys2.org/), which provides `git`, `make`, `g++` and more:
  * `pacman -S git gcc make openssh p7zip`
  * [Set a Windows environment variable](https://www.onmsft.com/how-to/how-to-set-an-environment-variable-in-windows-10): `MSYS2_PATH_TYPE=inherit`
  * Note that a bug in the MSYS2 launch script (`msys2_shell.cmd`) makes text-based
    interactive CLI menus to misbehave. [Check this Github issue for a
    workaround](https://github.com/msys2/MINGW-packages/issues/1633#issuecomment-240583890).
* The Windows Driver Kit (WDK), which is needed to compile some native Node modules. It is **not**
  necessary to install Visual Studio, only the WDK, which is "step 2" in the following guides:
  * [WDK for Windows 10](https://docs.microsoft.com/en-us/windows-hardware/drivers/download-the-wdk#download-icon-step-2-install-refreshed-wdk-for-windows-10-version-2004)
  * [WDK for earlier versions of Windows](https://docs.microsoft.com/en-us/windows-hardware/drivers/other-wdk-downloads#step-2-install-the-wdk)
* The [windows-build-tools](https://www.npmjs.com/package/windows-build-tools) npm package,
  by running the following command on an [administrator
  console](https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/):  
  `npm install --global --production windows-build-tools`

### Install the balena CLI

After installing the development tools, install the balena CLI with:

```sh
$ npm install balena-cli --global --production --unsafe-perm
```

`--unsafe-perm` is needed when `npm install` is executed as the `root` user (e.g. in a Docker
container) in order to allow npm scripts like `postinstall` to be executed.

## Additional Dependencies

The `balena ssh`, `device detect`, `build`, `deploy` and `preload` commands may require
additional software to be installed. Check the Additional Dependencies sections for each operating
system:

* [Windows](./INSTALL-WINDOWS.md#additional-dependencies)
* [macOS](./INSTALL-MAC.md#additional-dependencies)
* [Linux](./INSTALL-LINUX.md#additional-dependencies)

Where Docker or balenaEngine are required, they may be installed on the local machine (where the
balena CLI is executed), on a remote server, or on a balenaOS device running a [balenaOS development
image](https://www.balena.io/docs/reference/OS/overview/2.x/#dev-vs-prod-images). Reasons why this
may be desirable include:

* To avoid having to install Docker on the development machine / laptop.
* To take advantage of a more powerful server (CPU, memory).
* To build or run images "natively" on an ARM device, avoiding the need for QEMU emulation.

To use a remote Docker Engine (daemon) or balenaEngine, specify the remote machine's IP address and
port number with the `--dockerHost` and `--dockerPort` command-line options. The `preload` command
has additional requirements because the bind mount feature is used. For more details, see
`balena help` for each command or the [online
reference](https://www.balena.io/docs/reference/cli/#cli-command-reference).
