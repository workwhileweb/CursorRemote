@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM npm scripts use Unix tools (rm, cp, mkdir -p). Use Git Bash on Windows.
set "GIT_BASH="
if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "GIT_BASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if not defined GIT_BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "GIT_BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GIT_BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "GIT_BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"

REM npm on Windows runs script steps via cmd.exe unless --script-shell is set (rm/cp/mkdir -p need bash).
if defined GIT_BASH (
  "%GIT_BASH%" -lc "npm run package --script-shell \"%GIT_BASH%\""
  exit /b %ERRORLEVEL%
)

where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
  bash -lc "npm run package --script-shell \"$BASH\""
  exit /b %ERRORLEVEL%
)

echo.
echo ERROR: Git Bash was not found. This project's npm build uses rm/cp/mkdir -p.
echo Install Git for Windows: https://git-scm.com/download/win
echo Then run this script again, or from Git Bash: npm run package
echo.
exit /b 1
