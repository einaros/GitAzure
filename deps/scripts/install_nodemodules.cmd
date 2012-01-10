cd /d "%~dp0"

IF EXIST npm.cmd exit /b 0

echo npm LOG > setup_npm_log.txt

if "%EMULATED%"=="true" exit /b 0

powershell -c "set-executionpolicy unrestricted"
powershell .\download.ps1 "http://npmjs.org/dist/npm-1.1.0-beta-7.zip"

7za x npm-1.1.0-beta-7.zip -y >> setup_npm_log.txt
REM echo y| icacls .\ /grant "Network Service":f /t 1>> setup_git_log.txt 2>> setup_git_log_error.txt
icacls .\ /grant "Network Service":(OI)(CI)W >> setup_npm_log.txt

cd ..
bin\npm install >> setup_npm_log.txt

echo SUCCESS
exit /b 0

:error

echo FAILED
exit /b -1