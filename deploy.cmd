@echo off

echo list current dir
dir

echo Changing dir!
cd %DEPLOYMENT_TARGET%\App_Data\jobs\continuous\pnwebjob

echo npm install!
npm install
