@echo off
REM Runner for the Kinetic scan+sweep cron, invoked by Windows Task Scheduler.
REM Reads the prod DATABASE_URL from .env.kinetic.local (gitignored) so the
REM secret never lives in the task definition or the repo. Runs from this
REM (residential) machine's IP — the part gokinetic won't let a datacenter IP
REM do. Appends output to kinetic-cron.log.
cd /d "%~dp0.."
if not exist ".env.kinetic.local" (
  echo missing .env.kinetic.local >> kinetic-cron.log
  exit /b 1
)
for /f "usebackq delims=" %%i in (".env.kinetic.local") do set "DATABASE_URL=%%i"
set "KINETIC_CRON_BATCH=8"
echo. >> kinetic-cron.log
echo ===== %date% %time% ===== >> kinetic-cron.log
call npx tsx scripts/kinetic-cron.ts >> kinetic-cron.log 2>&1
