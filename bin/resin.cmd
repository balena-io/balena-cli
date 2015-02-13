@echo off

:: http://stackoverflow.com/questions/12322308/batch-file-to-check-64bit-or-32bit-os
reg Query "HKLM\Hardware\Description\System\CentralProcessor\0" | find /i "x86" > NUL && set ARCH=x86 || set ARCH=x64

set NODE_PATH="%~dp0\node\node-v0.12.0-win32-%ARCH%.exe"

@IF NOT EXIST %NODE_PATH% (
	set NODE_PATH="node.exe"
)

%NODE_PATH% "%~dp0\..\lib\resin.js" %*
