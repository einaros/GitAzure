cd /d "%~dp0"

echo npm LOG > npmlog.txt

if "%EMULATED%"=="true" exit /b 0

powershell -c "set-executionpolicy unrestricted"
powershell .\download.ps1 "http://npmjs.org/dist/npm-1.1.0-beta-7.zip"

7za x npm-1.1.0-beta-7.zip -y >> npmlog.txt
echo y| icacls .\ /grant "Network Service":f /t 1>> setup_git_log.txt 2>> setup_git_log_error.txt

cd ..
bin\npm install >> npmlog.txt

echo SUCCESS
exit /b 0

:error

echo FAILED
exit /b -1