cd /d "%~dp0"

if "%EMULATED%"=="true" exit /b 0

REM remove trailing slash if any
IF %GITPATH:~-1%==\ SET GITPATH=%GITPATH:~0,-1%
IF %GITHOME:~-1%==\ SET GITHOME=%GITHOME:~0,-1%

IF EXIST %GITPATH%\bin exit /b 0

echo LOG > setup_git_log.txt
echo GITPATH= %GITPATH% 1>> setup_git_log.txt
echo GITHOME= %GITHOME% 1>> setup_git_log.txt

powershell -c "set-executionpolicy unrestricted" >> setup_git_log.txt
powershell .\download.ps1 "http://msysgit.googlecode.com/files/PortableGit-1.7.8-preview20111206.7z" >> setup_git_log.txt
powershell .\appendPath.ps1 "%GITPATH%\bin" >> setup_git_log.txt
powershell .\addEnvVariable.ps1 GITHOME "%GITHOME%" >> setup_git_log.txt

7za x PortableGit-1.7.8-preview20111206.7z -y -o"%GITPATH%" >> setup_git_log.txt
icacls "%GITPATH%" /grant "Network Service":(OI)(CI)F >> setup_git_log.txt

mkdir "%GITHOME%"\.ssh >> setup_git_log.txt
xcopy /s /Y .ssh\* "%GITHOME%"\.ssh\ >> setup_git_log.txt
echo y | rmdir /s .ssh >> setup_git_log.txt
icacls "%GITHOME%" /grant "Network Service":(OI)(CI)F >> setup_git_log.txt

icacls ..\ /grant "Network Service":(OI)(CI)F >> setup_git_log.txt

IISRESET  >> setup_git_log.txt 
NET START W3SVC >> setup_git_log.txt 

echo SUCCESS
exit /b 0

:error

echo FAILED
exit /b -1
