@echo off

node "%~dp0\..\src\graphcurl.js" %*
exit /b %errorlevel%
