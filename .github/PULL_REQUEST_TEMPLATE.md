<!-- You can remove tags that do not apply. -->
Resolves: # <!-- Refer an issue of this repository that this PR fixes -->  
Change-type: major|minor|patch <!-- See https://semver.org/ -->  
Depends-on: <url> <!-- This change depends on a PR to get merged/deployed first -->  
See: <url> <!-- Refer to any external resource, like a PR, document or discussion -->  

---
Please check the CONTRIBUTING.md file for relevant information and some
guidance. Keep in mind that the CLI is a cross-platform application that runs
on Windows, macOS and Linux. Tests will be automatically run by balena CI on
all three operating systems, but this will only help if you have added test
code that exercises the modified or added feature code.

Note that each commit's message (currently only the first line) will be
automatically copied to the CHANGELOG.md file, so try writing it in a way
that describes the feature or fix for CLI users.

If there isn't a linked issue or if the linked issue doesn't quite match the
PR, please add a description to explain the PR's motivation and the features
that it adds. Adding comments to blocks of code that aren't self explanatory
usually helps with the review process.

If he PR introduces security considerations or affects the development, build
or release process, please be sure to add a description and highlight this.
