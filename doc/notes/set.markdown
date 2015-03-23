# note &#60;|note&#62;

Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from `stdin`.

To view the notes, use $ resin device <name>.

Examples:

	$ resin note "My useful note" --device MyDevice
	$ cat note.txt | resin note --device MyDevice

## Options

### --device, --d,dev, --d,dev &#60;device&#62;

device name