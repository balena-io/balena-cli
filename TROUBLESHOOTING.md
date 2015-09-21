Troubleshooting
===============

This document contains common issues related to the Resin CLI, and how to fix them.

### After burning to an sdcard, my device doesn't boot

- The downloaded image is not complete (download was interrupted).

Please clean the cache (`%HOME/.resin/cache` or `C:\Users\<user>\_resin\cache`) and run the command again. In the future, the CLI will check that the image is not complete and clean the cache for you.

### I get a permission error when burning to an sdcard

- The SDCard is locked.
- The burning operation is not 100% reliable in Windows 10. We're working on it at the moment.
