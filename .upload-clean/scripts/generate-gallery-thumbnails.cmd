@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0generate-gallery-thumbnails.ps1" %*
