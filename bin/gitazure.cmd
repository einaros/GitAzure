@echo off

powershell -c "set-executionpolicy unrestricted"
powershell -File "%~dp0\setup.ps1" "%~dp0\"