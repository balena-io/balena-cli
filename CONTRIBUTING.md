# Contributing

The balena CLI is an open source project and your contribution is welcome!

* Install the dependencies listed in the [NPM Installation
  section](./INSTALL-ADVANCED.md#npm-installation) section of the installation instructions. Check
  the section [Additional Dependencies](./INSTALL-ADVANCED.md#additional-dependencies) too.
* Clone the `balena-cli` repository (or a [forked
  repo](https://docs.github.com/en/free-pro-team@latest/github/getting-started-with-github/fork-a-repo),
  if you are not in the balena team), `cd` to it and run `npm install`.
* Build the CLI with `npm run build` or `npm test`, and execute it with `./bin/balena`
  (on a Windows command prompt, you may need to run `node .\bin\balena`).

In order to ease development:

* `npm run build:fast` skips some of the build steps for interactive testing, or
* `npm run test:source` skips testing the standalone zip packages (which is rather slow)
* `./bin/balena-dev` uses `ts-node/register` to transpile on the fly.

Before opening a PR, test your changes with `npm test`. Keep compatibility in mind, as the CLI is
meant to run on Linux, macOS and Windows. balena CI will run test code on all three platforms, but
this will only help if you add some test cases for your new code!

## Semantic versioning, commit messages and the ChangeLog

When a pull request is merged, Balena's versionbot / Continuous Integration system takes care of
automatically creating a new CLI release on both the [npm
registry](https://www.npmjs.com/package/balena-cli) and the GitHub [releases
page](https://github.com/balena-io/balena-cli/releases). The release version numbering adheres to
the [Semantic Versioning's](http://semver.org/) concept of patch, minor and major releases.
Generally, bug fixes and documentation changes are classed as patch changes, while new features are
classed as minor changes. If a change breaks backwards compatibility, it is a major change.

A new version entry is also automatically added to the
[CHANGELOG.md](https://github.com/balena-io/balena-cli/blob/master/CHANGELOG.md) file when a pull
request is merged. Each pull request corresponds to a single version / release. Each commit in the
pull request becomes a bullet point entry in the Changelog. The Changelog file should not be
manually edited.

To support this automation, a commit message should be structured as follows:

```text
The first line becomes a bullet point in the CHANGELOG file

Optionally, a more detailed description in one or more paragraphs.
The detailed description can be seen with `git log`, but it is not copied
to the CHANGELOG file.

Change-type: patch|minor|major
```

Only the first line of the commit message is copied to the Changelog file. The `Change-type` footer
must be preceded by a blank line, and indicates the commit's semver change type. When a PR consists
of multiple commits, the commits may have different change type values. As a whole, the PR will
produce a release of the "highest" change type. For example, two commits mixing patch and minor
change types will produce a minor CLI release, while two commits mixing minor and major change
types will produce a major CLI release.

The commit message is parsed / checked by versionbot with the
[resin-commit-lint](https://github.com/balena-io-modules/resin-commit-lint#resin-commit-lint)
package.

Because of the way that the Changelog file is automatically updated from commit messages, which
become the source of "what's new" for CLI end users, we advocate "meaningful commits" and
user-focused commit messages. A meaningful commit is one that, in isolation, introduces a fix or
feature (or part of a fix or feature) that makes sense at the Changelog level, and which leaves the
CLI in a non-broken state. Sometimes, in the course of preparing a single pull request, a developer
creates several commits as a way of saving their "work in progress", which may even fail to build
(e.g. `npm run build` fails), and which is then fixed or undone by further commits in the same PR.
In this situation, the recommendation is to "squash" or "fixup" the work-in-progress commits into
fewer, meaningful commits. Interactive rebase is a good tool to achieve this:
[blog](https://thoughtbot.com/blog/git-interactive-rebase-squash-amend-rewriting-history),
[docs](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History).

Mixing multiple distinct features or bug fixes in a single commit is discouraged, because the
description will likely not fit in the single-line Changelog bullet point and also because it
makes it harder to review the pull request (especially a large one) and harder to isolate and
revert individual changes in case a bug is found later on. Create a separate commit for each
feature / bug fix, or even separate pull requests.

If you need to catch up with changes to the master branch while working on a pull request,
use rebase instead of merge: [docs](https://git-scm.com/book/en/v2/Git-Branching-Rebasing).

If `package.json` is updated for dependencies listed in the `repo.yml` file (like `balena-sdk`),
the commit message body should also include a line in the following format:
```
Update balena-sdk from 12.0.0 to 12.1.0
```

This allows versionbot to produce nested Changelog entries (with expandable arrows), pulling in
commit messages from the upstream repositories. The following npm script can be used to
automatically produce a commit with a suitable commit message:
```
npm run update balena-sdk ^12.1.0
```

The script will create a new branch (only if `master` is currently checked out), run `npm update`
with the given target version and commit the `package.json` and `npm-shrinkwrap.json` files. The
script by default will set the `Change-type` to `patch` or `minor`, depending on the semver change
of the updated dependency. A `major` change type can specified as an extra argument:
```
npm run update balena-sdk ^12.14.0 patch
npm run update balena-sdk ^13.0.0 major
```

## Editing documentation files (README, INSTALL, Reference website...)

The `docs/balena-cli.md` file is automatically generated by running `npm run build:doc` (which also
runs as part of `npm run build`). That file is then pulled by scripts in the
[balena-io/docs](https://github.com/balena-io/docs/) GitHub repo for publishing at the [CLI
Documentation page](https://www.balena.io/docs/reference/cli/).

The content sources for the auto generation of `docs/balena-cli.md` are:

* [Selected
  sections](https://github.com/balena-io/balena-cli/blob/v12.23.0/automation/capitanodoc/capitanodoc.ts#L199-L204)
  of the README file.
* The CLI's command documentation in source code (`lib/commands/` folder), for example:
  * `lib/commands/push.ts`
  * `lib/commands/env/add.ts`

The README file is manually edited, but subsections are automatically extracted for inclusion in
`docs/balena-cli.md` by the `getCapitanoDoc()` function in
[`automation/capitanodoc/capitanodoc.ts`](https://github.com/balena-io/balena-cli/blob/master/automation/capitanodoc/capitanodoc.ts).

**IMPORTANT**

The file [`capitanodoc.ts`](https://github.com/balena-io/balena-cli/blob/master/automation/capitanodoc/capitanodoc.ts) lists 
commands to generate documentation from. At the moment, it's manually updated and maintained alphabetically. 

To add a new command to be documented, 

1. Find the resource which it is part of or create a new one. 
2. List the location of the build file 
3. Make sure to add your files in alphabetical order
4. Resources with plural names needs to have 2 sections if they have commands like: "fleet, fleets" or "device, devices" or "tag, tags"

Once added, run the command `npm run build` to generate the documentation

The `INSTALL*.md` and `TROUBLESHOOTING.md` files are also manually edited.

## Patches folder

The `patches` folder contains patch files created with the
[patch-package](https://www.npmjs.com/package/patch-package) tool. Small code changes to
third-party modules can be made by directly editing Javascript files under the `node_modules`
folder and then running `patch-package` to create the patch files. The patch files are then
applied immediately after `npm install`, through the `postinstall` script defined in
`package.json`.

The subfolders of the `patches` folder are documented in the
[apply-patches.js](https://github.com/balena-io/balena-cli/blob/master/patches/apply-patches.js)
script.

To make changes to the patch files under the `patches` folder, **do not edit them directly,**
not even for a "single character change" because the hash values in the patch files also need
to be recomputed by `patch-packages`. Instead, edit the relevant files under `node_modules`
directly, and then run `patch-packages` with the `--patch-dir` option to specify the subfolder
where the patch should be saved. For example, edit `node_modules/exit-hook/index.js` and then
run:

```sh
$ npx patch-package --patch-dir patches/all exit-hook
```

That said, these kinds of patches should be avoided in favour of creating pull requests
upstream. Patch files create additional maintenance work over time as the patches need to be
updated when the dependencies are updated, and they prevent the compounding community benefit
that sharing fixes upstream have on open source projects like the balena CLI. The typical
scenario where these patches are used is when the upstream maintainers are unresponsive or
unwilling to merge the required fixes, the fixes are very small and specific to the balena CLI,
and creating a fork of the upstream repo is likely to be more long-term effort than maintaining
the patches.

## Windows

Besides the regular npm installation dependencies, the `npm run build:installer` script
that produces the `.exe` graphical installer on Windows also requires
[NSIS](https://sourceforge.net/projects/nsis/) and [MSYS2](https://www.msys2.org/) to be
installed. Be sure to add `C:\Program Files (x86)\NSIS` to the PATH, so that `makensis`
is available. MSYS2 is recommended when developing the balena CLI on Windows.

If changes are made to npm scripts in `package.json`, don't assume that a Unix shell like
bash is available. For example, some Windows shells don't have the `cp` and `rm` commands,
which is why you'll often find `ncp` and `rimraf` used in `package.json` scripts.

## Updating the 'npm-shrinkwrap.json' file

The `npm-shrinkwrap.json` file is used to control package dependencies, as documented at
https://docs.npmjs.com/files/shrinkwrap.json.

Changes to `npm-shrinkwrap.json` can be automatically merged by git during operations like
`rebase`, `pull` and `cherry-pick`, but in some cases this results in suboptimal dependency
resolution (the `node_modules` folder may end up larger than necessary, with consequences to CLI
load time too). For this reason, the recommended way to update `npm-shrinkwrap.json` is to run
`npm install`, possibly alongside `npm dedupe` as well. The following commands can be used to
fix shrinkwrap issues and optimize the dependencies:

```sh
git checkout master -- npm-shrinkwrap.json
rm -rf node_modules
npm install  # update npm-shrinkwrap.json to satisfy changes to package.json
npm dedupe   # deduplicate dependencies from npm-shrinkwrap.json
npm install  # re-add optional dependencies removed by dedupe
git add npm-shrinkwrap.json  # add it for committing (solve merge errors)
```

Note that `npm dedupe` should always be followed by `npm install`, as shown above, even if
`npm install` had already been executed before `npm dedupe`.

Optionally, these steps may be automated by installing the
[npm-merge-driver](https://www.npmjs.com/package/npm-merge-driver):

```sh
npx npm-merge-driver install -g
```

## `fast-boot` and `npm link` - modifying the `node_modules` folder

During development or debugging, it is sometimes useful to temporarily modify the `node_modules`
folder (with or without making the respective changes to the `npm-shrinkwrap.json` file),
replacing dependencies with different versions. This can be achieved with the `npm link`
command, or by manually editing or copying files to the `node_modules` folder.

Unexpected behavior may then be observed because of the CLI's use of the
[fast-boot2](https://www.npmjs.com/package/fast-boot2) package that caches module resolution.
`fast-boot2` is configured in `lib/fast-boot.ts` to automatically invalidate the cache if
changes are made to the `package.json` or `npm-shrinkwrap.json` files, but the cache won't
be automatically invalidated if `npm link` is used or if manual modifications are made to the
`node_modules` folder. In this situation:

* Manually delete the module cache file (typically `~/.balena/cli-module-cache.json`), or
* Use the `bin/balena-dev` entry point (instead of `bin/balena`) as it does not activate
  `fast-boot2`.

## TypeScript and oclif

The CLI currently contains a mix of plain JavaScript and
[TypeScript](https://www.typescriptlang.org/) code. The goal is to have all code written in
Typescript, in order to take advantage of static typing and formal programming interfaces.
The migration towards Typescript is taking place gradually, as part of maintenance work or
the implementation of new features.

Of historical interest, the CLI was originally written in [CoffeeScript](https://coffeescript.org)
and used the [Capitano](https://github.com/balena-io/capitano) framework. All CoffeeScript code was
migrated to either Javascript or Typescript, and Capitano was replaced with oclif. A few file or
variable names still refer to this legacy, for example `automation/capitanodoc/capitanodoc.ts`.

## Programming style

`npm run build` also runs [balena-lint](https://www.npmjs.com/package/@balena/lint), which automatically
reformats the code. Beyond that, we have a preference for Javascript promises over callbacks, and for
`async/await` over `.then()`.

## Common gotchas

One thing that most CLI bugs have in common is the absence of test cases exercising the broken
code, so writing some test code is a great idea. Having said that, there are also some common
gotchas to bear in mind:

* Forward slashes ('/') _vs._ backslashes ('\') in file paths. The Node.js
  [path.sep](https://nodejs.org/docs/latest-v12.x/api/path.html#path_path_sep) variable stores a
  platform-specific path separator character: the backslash on Windows and the forward slash on
  Linux and macOS. The
  [path.join](https://nodejs.org/docs/latest-v12.x/api/path.html#path_path_join_paths) function
  builds paths using such platform-specific path separator. However:
  * Note that Windows (kernel, cmd.exe, PowerShell, many applications) accepts ***both*** forward
    slashes and backslashes as path separators (including mixing them in a path string), so code
    like `mypath.split(path.sep)` may fail on Windows if `mypath` contains forward slashes. The
    [path.parse](https://nodejs.org/docs/latest-v12.x/api/path.html#path_path_parse_path) function
    understands both forward slashes and backslashes on Windows, and the
    [path.normalize](https://nodejs.org/docs/latest-v12.x/api/path.html#path_path_normalize_path)
    function will _replace_ forward slashes with backslashes.
  * In [tar](https://en.wikipedia.org/wiki/Tar_(computing)#File_format) streams sent to the Docker
    daemon and to balenaCloud, the forward slash is the only acceptable path separator, regardless
    of the OS where the CLI is running. Therefore, `path.sep` and `path.join` should never be used
    when handling paths in tar streams! `path.posix.join` may be used instead of `path.join`.

* Avoid using the system shell to execute external commands, for example:  
  `child_process.exec('ssh "arg1" "arg2"');`  
  `child_process.spawn('ssh "arg1" "arg2"', { shell: true });`  
  Besides the usual security concerns of unsanitized strings, another problem is to get argument
  escaping right because of the differences between the Windows 'cmd.exe' shell and the Unix
  '/bin/sh'. For example, 'cmd.exe' doesn't recognize single quotes like '/bin/sh', and uses the
  caret (^) instead of the backslash as the escape character. Bug territory! Most of the time,
  it is possible to avoid relying on the shell altogether by providing a Javascript array of
  arguments:  
  `spawn('ssh', ['arg1', 'arg2'], { shell: false});`  
  To allow for logging and debugging, the [which](https://www.npmjs.com/package/which) package may
  be used to get the full path of a command before executing it, without relying on any shell:  
  `const fullPath = await which('ssh');`  
  `console.log(fullPath);  # 'C:\WINDOWS\System32\OpenSSH\ssh.EXE'`  
  `spawn(fullPath, ['arg1', 'arg2'], { shell: false });`

* Avoid the `instanceof` operator when testing against classes/types from external packages
  (including base classes), because `npm install` may result in multiple versions of the same
  package being installed (to satisfy declared dependencies) and a false negative may result when
  comparing an object instance from one package version with a class of another package version
  (even if the implementations are identical in both packages). For example, once we fixed a bug
  where the test:  
  `error instanceof BalenaApplicationNotFound`  
  changed from true to false because `npm install` added an additional copy of the `balena-errors`
  package to satisfy a minor `balena-sdk` version update:  
  `$ find node_modules -name balena-errors`  
  `node_modules/balena-errors`  
  `node_modules/balena-sdk/node_modules/balena-errors`  
  In the case of subclasses of `TypedError`, a string comparison may be used instead:  
  `error.name === 'BalenaApplicationNotFound'`

## Further debugging notes

* If you need to selectively run specific tests, `it.only` will not work in cases when authorization is required as part of the test cycle.  In order to target specific tests, control execution via `.mocharc.js` instead.  Here is an example of targeting the `deploy` tests.

	replace: `spec: 'tests/**/*.spec.ts',`

	with: `spec: ['tests/auth/*.spec.ts', 'tests/**/deploy.spec.ts'],`
