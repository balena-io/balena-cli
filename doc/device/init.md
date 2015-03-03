# device init [device]

Use this command to download the OS image of a certain application and write it to an SD Card.

Note that this command requires admin privileges.

If `device` is omitted, you will be prompted to select a device interactively.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

You can quiet the progress bar by passing the `--quiet` boolean option.

You may have to unmount the device before attempting this operation.

You need to configure the network type and other settings:

Ethernet:
  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
  You can setup the device OS to use wifi by setting the `--network` option to "wifi".
  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

Examples:

	$ resin device init --application 91 --network ethernet
	$ resin device init /dev/disk2 --application 91 --network wifi --ssid MyNetwork --key secret

## Options

### --application, --a,app, --a,app <application>

application id

### --network, -n <network>

network type

### --ssid, -s <ssid>

wifi ssid, if network is wifi

### --key, -k <key>

wifi key, if network is wifi