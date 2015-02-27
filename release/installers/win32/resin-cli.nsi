!addincludedir "Include"
!addplugindir "Plugins"

!include "MUI2.nsh"
!include "EnvVarUpdate.nsh"
!include "zipdll.nsh"

Name "Resin CLI"
OutFile "..\..\build\distrib\resin-cli-setup.exe"
BrandingText "Resin.io"

InstallDir "$PROGRAMFILES\Resin.io\resin-cli"

; MUI settings
!define MUI_ICON "logo.ico"
!define MUI_UNICON "logo.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "banner.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "banner.bmp"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "License.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "Install"
        SetOutPath $INSTDIR
        File "..\..\build\distrib\resin-cli-win32.zip"
        !insertmacro ZIPDLL_EXTRACT "$INSTDIR\resin-cli-win32.zip" "$INSTDIR" "<ALL>"
        Delete "$INSTDIR\resin-cli-win32.zip"
        ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR\bin"
        WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
        RMDir /r "$INSTDIR"
        ${un.EnvVarUpdate} $0 "PATH" "R" "HKLM" "$INSTDIR\bin"
SectionEnd
