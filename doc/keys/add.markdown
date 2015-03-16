# key add &#60;name&#62; [path]

Use this command to associate a new SSH key with your account.

If `path` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ resin key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | resin key add Main
