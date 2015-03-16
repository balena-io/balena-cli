# os install &#60;image&#62; [device]

Use this command to write an operating system image to a device.

Note that this command requires admin privileges.

If `device` is omitted, you will be prompted to select a device interactively.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

You can quiet the progress bar by passing the `--quiet` boolean option.

You may have to unmount the device before attempting this operation.

See the `drives` command to get a list of all connected devices to your machine and their respective ids.

In Mac OS X:

	$ sudo diskutil unmountDisk /dev/xxx

In GNU/Linux:

	$ sudo umount /dev/xxx

Examples:

	$ resin os install rpi.iso /dev/disk2

## Options

### --yes, -y

confirm non interactively