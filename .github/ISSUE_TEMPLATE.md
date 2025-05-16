
# About this issue tracker

*The balena CLI (Command Line Interface) is a tool used to interact with the balena platform.
This GitHub issue tracker is used for bug reports and feature requests regarding the CLI
tool. General and troubleshooting questions (such as setting up your project to work with a
balenalib base image) are encouraged to be posted to the [balena
forums](https://forums.balena.io), which are monitored by balena's support team and where the
community can both contribute and benefit from the answers.*

*Please also check that this issue is not a duplicate. If there is another issue describing
the same problem or feature please add comments to the existing issue.*

*Thank you for your time and effort creating the issue report, and helping us improve
the balena CLI!*

---

# Expected Behavior

Please describe what you were expecting to happen. If applicable, please add links to
documentation you were following, or to projects that you were trying to push/build.

# Actual Behavior

Please describe what actually happened instead:
* Quoting logs and error message is useful. If possible, quote the **full** output of the
  CLI, not just the error message.
* Please quote the **full command line** too. Sometimes users report that they were
  "pushing" or "building" a project, but there are several ways to do so and several
  possible "targets" such as balenaCloud, openBalena, local balenaOS device, etc.
  Examples:

```
balena push myFleet
balena push 192.168.0.12
balena deploy myFleet
balena deploy myFleet --build
balena build . -f myFleet
balena build . -A armv7hf -d raspberrypi3
```

Each of the above command lines executes different code behind the scenes, so quoting the
full command line is very helpful.

Running the CLI in debug mode (`--debug` flag or `DEBUG=1` environment variable) may reveal
additional information. The `--logs` option reveals additional information for the commands:

```
balena build . --logs
balena deploy myFleet --build --logs
```

# Steps to Reproduce the Problem

This is the most important and helpful part of a bug report. If we cannot reproduce the
problem, it is difficult to tell what the fix should be, or whether code changes have
fixed it.

1.
1.
1.

# Specifications

- **balena CLI version:** e.g. 1.2.3 (output of the `"balena version -a"` command)
- **Cloud backend: openBalena or balenaCloud?** If unsure, it will be balenaCloud
- **Operating system version:** e.g. Windows 10, Ubuntu 18.04, macOS 10.14.5
- **32/64 bit OS and processor:** e.g. 32-bit Windows on 64-bit Intel processor
- **Install method:** npm or standalone package or executable installer
- **If npm install, Node.js and npm version:** e.g. Node v8.16.0 and npm v6.4.1

# Additional References

If applicable, please add additional links to GitHub projects, forums.balena.io threads,
gist.github.com, Google Drive attachments, etc.
