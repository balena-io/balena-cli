# os download <id>

Use this command to download the device OS configured to a specific network.

Ethernet:
	You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
	You can setup the device OS to use wifi by setting the `--network` option to "wifi".
	If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

By default, this command saved the downloaded image into a resin specific directory.
You can save it to a custom location by specifying the `--output` option.

Examples:

	$ resin os download 91 --network ethernet
	$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123
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