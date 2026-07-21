@echo off
cd /d "%~dp0"
echo ========================================
echo   RGS System - Database Setup
echo ========================================
echo.

echo [1/4] Resetting database with new schema...
call npx prisma db push --force-reset --accept-data-loss
if errorlevel 1 (
    echo.
    echo FAILED at step 1. Is PostgreSQL running?
    echo Check your .env DATABASE_URL is correct.
    pause
    exit /b 1
)

echo.
echo [2/4] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo FAILED at step 2.
    pause
    exit /b 1
)

echo.
echo [3/4] Seeding demo data...
call npm run db:seed
if errorlevel 1 (
    echo FAILED at step 3.
    pause
    exit /b 1
)

echo.
echo [4/4] Starting app...
echo.
echo ========================================
echo   Setup complete! Opening at:
echo   http://localhost:3000
echo.
echo   Login accounts:
echo   Admin:   admin@rgs.co.id / admin123
echo   Manager: manager@rgs.co.id / manager123
echo   Staff:   staff@rgs.co.id / staff123
echo ========================================
echo.
call npm run dev
pause
