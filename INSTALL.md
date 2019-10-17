# balena CLI Installation Instructions

There are 3 options to choose from to install balena's CLI:

* [Executable Installer](#executable-installer): the easiest method, using the traditional
  graphical desktop application installers for Windows and macOS (coming soon for Linux users too).
* [Standalone Zip Package](#standalone-zip-package): these are plain zip files with the balena CLI
  executable in them. Recommended for scripted installation in CI (continuous integration)
  environments.
* [NPM Installation](#npm-installation): recommended for developers who may be interested in
  integrating the balena CLI in their existing Node.js projects or workflow.

Some specific CLI commands have a few extra installation steps: see section [Additional
Dependencies](#additional-dependencies).

> **Windows users:**
> * There is a [YouTube video tutorial](https://www.youtube.com/watch?v=2LApclXFqsg) for installing
>   and getting started with the balena CLI on Windows. (The video uses the standalone zip package
>   option.)
> * If you are using Microsoft's [Windows Subsystem for
>   Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL), the recommendation is to
>   install a balena CLI release for Linux rather than Windows, like the Linux standalone zip
>   package. An installation with the graphical executable installer for Windows will not run on
>   WSL. See also [FAQ](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md) for
>   using balena CLI with WSL and Docker Desktop for Windows.

## Executable Installer

1. Download the latest installer from the [releases page](https://github.com/balena-io/balena-cli/releases).
   Look for a file name that ends with "-installer", for example:  
   `balena-cli-v11.6.0-windows-x64-installer.exe`  
   `balena-cli-v11.6.0-macOS-x64-installer.pkg`
2. Double click the downloaded file to run the installer.
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
   `balena-cli-v10.13.6-linux-x64-standalone.zip`  
   `balena-cli-v10.13.6-macOS-x64-standalone.zip`  
   `balena-cli-v10.13.6-windows-x64-standalone.zip`
2. Extract the zip file contents to any folder you choose. The extracted contents will include a
   `balena-cli` folder.
3. Add the `balena-cli` folder to the system's `PATH` environment variable.  
   See instructions for:
   [Linux](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix) |
   [macOS](https://www.architectryan.com/2012/10/02/add-to-the-path-on-mac-os-x-mountain-lion/#.Uydjga1dXDg) |
   [Windows](https://www.computerhope.com/issues/ch000549.htm)

To update the CLI to a new version, download a new release zip file and replace the previous
installation folder. To uninstall, simply delete the folder and edit the PATH environment variable
as described above.

## NPM Installation

If you are a Node.js developer, you may wish to install the balena CLI via [npm](https://www.npmjs.com).
The npm installation involves building native (platform-specific) binary modules, which require
some additional development tools to be installed first:

* Node.js version 8, 10 or 12 (on Linux/Mac, [nvm](https://github.com/nvm-sh/nvm/blob/master/README.md)
  is recommended)
* npm version 6.9.0 or later
* Python 2.7
* g++ compiler
* make
* git

On Windows, the dependencies above and additional ones can be met with:

* The [MSYS2 shell](https://www.msys2.org/) may be used to provide `git`, `ssh`, `rsync`, `make`
  and `g++`:
  * `pacman -S git openssh rsync gcc make`
  * [Set a Windows environment variable](https://www.onmsft.com/how-to/how-to-set-an-environment-variable-in-windows-10): `MSYS2_PATH_TYPE=inherit`
  * Note that a bug in the MSYS2 launch script (`msys2_shell.cmd`) makes text-based
    interactive CLI menus to misbehave. [Check this Github issue for a
    workaround](https://github.com/msys2/MINGW-packages/issues/1633#issuecomment-240583890).
* Install the Windows Driver Kit (WDK) which is needed to compile some native Node modules:
  * [WDK for Windows 10](https://docs.microsoft.com/en-us/windows-hardware/drivers/download-the-wdk)
  * [WDK for earlier versions of Windows](https://docs.microsoft.com/en-us/windows-hardware/drivers/other-wdk-downloads)
* Install Node from the [Nodejs website](https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/)
* Install the `windows-build-tools` npm package (which provides Python 2.7 and more), running the following command in an [administrator
  console](https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/):  
  `npm install -g --production windows-build-tools`

With these dependencies in place, the balena CLI installation command is:

```sh
$ npm install balena-cli -g --production --unsafe-perm
```

`--unsafe-perm` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

On some Linux distributions like Ubuntu, users often report permission or otherwise mysterious
errors when using the system Node / npm packages installed via "apt-get". We suggest using
[nvm](https://github.com/creationix/nvm) instead. Check this sample Dockerfile for installing the
CLI on an Ubuntu Docker image: https://gist.github.com/pdcastro/5d4d96652181e7da685a32caf629dd44

## Additional Dependencies

* The `balena ssh` command requires a recent version of the `ssh` command-line tool to be available:
  * macOS and Linux usually already have it installed. Otherwise, search for the available packages
    on your specific Linux distribution, or for the Mac consider the [Xcode command-line
    tools](https://developer.apple.com/xcode/features/) or [homebrew](https://brew.sh/).

  * Microsoft started distributing an SSH client with Windows 10, which we understand is
    automatically installed through Windows Update, but can be manually installed too
    ([more information](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)).
    For other versions of Windows, there are several ssh/OpenSSH clients provided by 3rd parties.

  * If you need SSH to work behind a proxy, you will also need to install
    [`proxytunnel`](http://proxytunnel.sourceforge.net/) (available as a `proxytunnel` package
    for Ubuntu, for example).
    Check the [README](https://github.com/balena-io/balena-cli/blob/master/README.md) file
    for proxy configuration instructions.

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
