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

> **Windows users:** We now have a [YouTube video tutorial](https://www.youtube.com/watch?v=2LApclXFqsg)
for installing and getting started with the balena CLI on Windows!

## Executable Installer

_Please note: the executable installers are in **beta** status (recently introduced)._

1. Download the latest installer from the [releases page](https://github.com/balena-io/balena-cli/releases).
   Look for a file name that ends with "installer-BETA", for example:  
   `balena-cli-v10.13.6-windows-x64-installer-BETA.exe`  
   `balena-cli-v10.13.6-macOS-x64-installer-BETA.pkg`
2. Double click to run. Your system may raise a pop-up warning that the installer is from an
   "unknown publisher" or "unidentified developer". Check the following instructions for how
   to get through the warnings:
   [Windows](https://github.com/balena-io/balena-cli/issues/1250) or
   [macOS](https://github.com/balena-io/balena-cli/issues/1251).
   (We are looking at how to get the installers digitally signed to avoid the warnings.)

After the installation completes, close and re-open any open command terminal windows so that the
changes made by the installer to the PATH environment variable can take effect. Check that the
installation was successful by running these commands:

* `balena` - should print the balena CLI help
* `balena version` - should print the installed CLI version

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

* Node.js version 6 or above (**soon version 8 or above**)
* Python 2.7
* g++ compiler
* make
* git
* Under Windows, the `windows-build-tools` npm package should be installed too, running the
  following command in an administrator console (available as 'Command Prompt (Admin)' when
  pressing Windows+X in Windows 7+) :  
  `npm install -g --production windows-build-tools`

With those in place, the CLI installation command is:

```sh
$ npm install balena-cli -g --production --unsafe-perm
```

`--unsafe-perm` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

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

* The `balena sync` command (deprecated) currently requires `rsync` (>= 2.6.9) to be installed:
  * Linux: `apt-get install rsync`
  * macOS: [Xcode command-line tools](https://developer.apple.com/xcode/features/) or [homebrew](https://brew.sh/)
  * Windows: One option is to use the [MinGW](http://www.mingw.org) shell and install the
    `msys-rsync` package. Check the README file for other shell options under Windows.

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
