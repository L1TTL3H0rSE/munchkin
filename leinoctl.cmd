@echo off
setlocal
node "%~dp0tools\leinoctl\bin\leinoctl.mjs" %*
exit /b %ERRORLEVEL%
