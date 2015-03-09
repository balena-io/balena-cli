# os download <id>

Use this command to download the device OS configured to a specific network.

Ethernet:
	You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
	You can setup the device OS to use wifi by setting the `--network` option to "wifi".
	If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

Alternatively, you can omit all kind of network configuration options to configure interactively.

You have to specify an output location with the `--output` option.

Examples:

	$ resin os download 91 --output ~/MyResinOS.zip
	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip
	$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123 --output ~/MyResinOS.zip
	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip

## Options

### --network, -n <network>

network type

### --ssid, -s <ssid>

wifi ssid, if network is wifi

### --key, -k <key>

wifi key, if network is wifi

### --output, -o <output>

output file