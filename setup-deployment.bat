@echo off
REM Joniah Pharmacy - Railway Deployment Setup Script
REM This script prepares your project for deployment to Railway.app

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo 🚀 Joniah Pharmacy - Railway Deployment Setup
echo ==============================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo 📦 Initializing git repository...
    git init
    git config user.name "Joniah Deployment"
    git config user.email "deployment@joniah.local"
) else (
    echo ✅ Git repository already initialized
)

echo.
echo 📝 Current git status:
git status --short | findstr /r ".*"

echo.
REM Check for uncommitted changes
for /f "delims=" %%i in ('git status --porcelain') do (
    set "has_changes=1"
    goto :check_done
)
:check_done

if not defined has_changes (
    echo ✅ Repository is clean
) else (
    echo ⚠️  Uncommitted changes detected
    set /p commit_choice="Do you want to commit changes? (y/n): "
    if /i "!commit_choice!"=="y" (
        git add .
        set /p commit_msg="Enter commit message: "
        if not defined commit_msg set "commit_msg=fix: deployment updates"
        git commit -m "!commit_msg!"
    )
)

echo.
echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo 1. Create a GitHub repository at https://github.com/new
echo 2. Run: git remote add origin https://github.com/yourusername/joniah-pharmacy.git
echo 3. Run: git branch -M main ^&^& git push -u origin main
echo 4. Go to https://railway.app and deploy from GitHub
echo.
echo 📖 For detailed instructions, see RAILWAY_DEPLOYMENT.md
echo.
