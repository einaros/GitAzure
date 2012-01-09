cd /d "%~dp0"

if "%EMULATED%"=="true" exit /b 0

echo LOG > setup_git_log.txt

REM remove trailing slash if any
IF %GITPATH:~-1%==\ SET GITPATH=%GITPATH:~0,-1%

echo GITPATH= %GITPATH% 1>> setup_git_log.txt

if "%EMULATED%"=="true" exit /b 0

powershell -c "set-executionpolicy unrestricted" 1>> setup_git_log.txt 2>> setup_git_log_error.txt
powershell .\download.ps1 "http://msysgit.googlecode.com/files/PortableGit-1.7.8-preview20111206.7z" 1>> setup_git_log.txt 2>> setup_git_log_error.txt
powershell .\appendPath.ps1 "%GITPATH%\bin" 1>> setup_git_log.txt 2>> setup_git_log_error.txt

7za x PortableGit-1.7.8-preview20111206.7z -y -o"%GITPATH%" 1>> setup_git_log.txt 2>> setup_git_log_error.txt
echo y| icacls "%GITPATH%" /grant "Network Service":f /t 1>> setup_git_log.txt 2>> setup_git_log_error.txt
echo y| icacls ..\ /grant "Network Service":f /t 1>> setup_git_log.txt 2>> setup_git_log_error.txt

IISRESET  1>> setup_git_log.txt 2>> setup_git_log_error.txt 
NET START W3SVC 1>> setup_git_log.txt 2>> setup_git_log_error.txt 

echo SUCCESS
exit /b 0

:error

echo FAILED
exit /b -1