## Migrating to balena CLI v22

This guide outlines the changes introduced in balena CLI v22 and provides instructions for when and how to migrate.

---

### For Installer Users (Windows .exe, macOS .pkg)

If you are using the Windows executable (.exe) or macOS package (.pkg) installers, **no changes** are required for this update. You can continue to use the installers as before.

---

### For npm Installation Users

If you installed balena CLI via npm, **no changes** are required for this update. Your existing installation and update process remains the same.

---

### For Standalone Installation Users

Users of the standalone balena CLI will need to make the following adjustments:

1.  **Archive Format Change**: The distribution archive format has changed from `.zip` to `.tar.gz`. You will need to use the `tar` command instead of `unzip` to extract the CLI.

    * **Previous command (v21.x.x and older):**
        ```bash
        unzip balena-cli-v21.1.12-linux-x64-standalone.zip
        ```
    * **New command (v22.0.0 and newer):**
        ```bash
        tar -xzf balena-cli-v22.0.0-linux-x64-standalone.tar.gz
        ```

2.  **Executable Path Change**: The path to the balena CLI executable within the extracted folder has been updated.

    * **Previous path (v21.x.x and older):**
        ```
        balena-cli/balena
        ```
    * **New path (v22.0.0 and newer):**
        ```
        balena/bin/balena
        ```

Please update your scripts and any aliases to reflect these changes if you are using the standalone version.
