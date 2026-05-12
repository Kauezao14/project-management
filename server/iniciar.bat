@echo off
chcp 65001 >nul
title Gantt - Servidor Local

echo Verificando dependencias...
if not exist node_modules (
    echo Instalando dependencias pela primeira vez...
    npm install
    echo.
)

echo Iniciando servidor...
node server.js
pause
