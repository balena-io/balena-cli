# balena CLI Installation Instructions

The easiest and recommended way of installing the CLI on all platforms (Windows, Linux, macOS) is
to use the [Standalone Installation](#standalone-installation) described below. Some specific CLI
commands have a few extra installation steps: see section [Additional Dependencies](#additional-dependencies).

> **Windows users:** We now have a [YouTube video tutorial](https://www.youtube.com/watch?v=dzb2mvRf_Ag)
for installing and getting started with the balena CLI on Windows!

## Standalone Installation

1. Download the latest zip file for your OS from https://github.com/balena-io/balena-cli/releases.  
   (Note that "[Darwin](https://en.wikipedia.org/wiki/Darwin_(operating_system))" is the
   appropriate zip file for macOS.)
2. Extract the zip file contents to any folder you choose. The extracted contents will include a
   `balena-cli` folder.
3. Add the `balena-cli` folder to the system's `PATH` environment variable. See instructions for:
   [Windows](https://www.computerhope.com/issues/ch000549.htm) |
   [Linux](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix) |
   [macOS](https://www.architectryan.com/2012/10/02/add-to-the-path-on-mac-os-x-mountain-lion/#.Uydjga1dXDg)

Check that the installation was successful by opening or re-opening a command terminal window
(so that the PATH environment variable changes take effect), and running these commands:

* `balena` - should print the balena CLI help
* `balena version` - should print the installed CLI version

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
