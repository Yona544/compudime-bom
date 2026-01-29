@echo off
echo Deploying BOM API to Fly.io...
fly deploy --ha=false
echo.
echo Deployment complete!
echo API: https://bom-api.fly.dev
echo Docs: https://bom-api.fly.dev/docs
