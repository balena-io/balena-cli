# Provisioning balena devices in automated (non-interactive) mode

This document describes how to run the `device init` command in non-interactive mode.

It requires collecting some preliminary information _once_.

The final command to provision the device looks like this:

```bash
balena device init --fleet FLEET_ID --os-version OS_VERSION --drive DRIVE --config CONFIG_FILE --yes

```

You can run this command as many times as you need, putting the new medium (SD card / USB stick) each time.

But before you can run it you need to collect the parameters and build the configuration file. Keep reading to figure out how to do it.


## Collect all the required parameters.

1. `DEVICE_TYPE`. Run
	```bash
	balena devices supported
	```
	and find the _slug_ for your target device type, like _raspberrypi3_.

1. `FLEET_ID`. Create a fleet (`balena fleet create FLEET_NAME --type DEVICE_TYPE`) or find an existing one (`balena fleets`) and notice its ID.

1. `OS_VERSION`. Run
	```bash
	balena os versions DEVICE_TYPE
	```
	and pick the version that you need, like _v2.0.6+rev1.prod_.
	_Note_ that even though we support _semver ranges_ it's recommended to use the exact version when doing the automated provisioning as it
	guarantees full compatibility between the steps.

1. `DRIVE`. Plug in your target medium (SD card or the USB stick, depending on your device type) and run
	```bash
	balena util available-drives
	```
	and get the drive name, like _/dev/sdb_ or _/dev/mmcblk0_.
	The balena CLI will not display the system drives to protect you,
	but still please check very carefully that you've picked the correct drive as it will be erased during the provisioning process.

Now we have all the parameters -- time to build the config file.

## Build the config file

Interactive device provisioning process often includes collecting some extra device configuration, like the networking mode and wifi credentials.

To skip this interactive step we need to buid this configuration once and save it to the JSON file for later reuse.

Let's say we will place it into the `CONFIG_FILE` path, like _./balena-os/raspberrypi3-config.json_.

We also need to put the OS image somewhere, let's call this path `OS_IMAGE_PATH`, it can be something like _./balena-os/raspberrypi3-v2.0.6+rev1.prod.img_.

1. First we need to download the OS image once. That's needed for building the config, and will speedup the subsequent operations as the downloaded OS image is placed into the local cache.

	Run:
	```bash
	balena os download DEVICE_TYPE --output OS_IMAGE_PATH --version OS_VERSION
	```

1. Now we're ready to build the config:

	```bash
	balena os build-config OS_IMAGE_PATH DEVICE_TYPE --output CONFIG_FILE
	```

	This will run you through the interactive configuration wizard and in the end save the generated config as `CONFIG_FILE`. You can then verify it's not empty:

	```bash
	cat CONFIG_FILE
	```

## Done

Now you're ready to run the command in the beginning of this guide.

Please note again that all of these steps only need to be done once (unless you need to change something), and once all the parameters are collected the main init command can be run unchanged.

But there are still some nuances to cover, please read below. 

## Nuances

### `sudo` password on *nix systems

In order to write the image to the raw device we need the root permissions, this is unavoidable.

To improve the security we only run the minimal subcommand with `sudo`.

This means that with the default setup you're interrupted closer to the end of the device init process to enter your sudo password for this subcommand to work.

There are several ways to eliminate it and make the process fully non-interactive.

#### Option 1: make passwordless sudo.

Obviously you shouldn't do that if the machine you're working on has access to any sensitive resources or information.

But if you're using a machine dedicated to balena provisioning this can be fine, and also the simplest thing to do.

#### Option 2: `NOPASSWD` directive

You can configure the `balena` CLI command to be sudo-runnable without the password. Check [this post](https://askubuntu.com/questions/159007/how-do-i-run-specific-sudo-commands-without-a-password) for an example.

### Extra initialization config

As of June 2017 all the supported devices should not require any other interactive configuration.

But by the design of our system it is _possible_ (though it doesn't look very likely it's going to happen any time soon) that some extra initialization options may be requested for the specific device types.

If that is the case please raise the issue in the balena CLI repository and the maintainers will add the necessary options to build the similar JSON config for this step.
