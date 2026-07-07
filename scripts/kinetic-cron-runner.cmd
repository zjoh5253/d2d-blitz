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
REM Load KEY=VALUE lines (DATABASE_URL, KINETIC_PROXY_URL, KINETIC_CRON_BATCH).
REM Skip blank lines and # comments. Quotes keep & in the DB URL safe.
for /f "usebackq eol=# tokens=1* delims==" %%a in (".env.kinetic.local") do set "%%a=%%b"
echo. >> kinetic-cron.log
echo ===== %date% %time% ===== >> kinetic-cron.log
call npx tsx scripts/kinetic-cron.ts >> kinetic-cron.log 2>&1
