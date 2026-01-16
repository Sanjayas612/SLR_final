@echo off
cls
color 0A

echo ========================================
echo    MessMate - Mess Management System
echo         Installation Script
echo ========================================
echo.

:: Check for Node.js
echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%
echo.

:: Check for npm
echo Checking for npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm found: %NPM_VERSION%
echo.

:: Install dependencies
echo Installing dependencies...
echo This may take a few minutes...
echo.
call npm install

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully!
echo.

:: Check for .env file
if exist ".env" (
    echo [OK] .env file found
) else (
    echo [WARNING] .env file not found
    echo Creating .env from template...
    
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] .env file created from .env.example
        echo.
        echo [IMPORTANT] Please edit .env and add your credentials:
        echo    - MongoDB URI
        echo    - Cloudinary credentials
        echo.
        
        set /p OPEN_ENV="Would you like to open .env now? (Y/N): "
        if /i "%OPEN_ENV%"=="Y" (
            if exist "%WINDIR%\system32\notepad.exe" (
                start notepad .env
            ) else (
                echo Please open .env in your text editor
            )
        )
    ) else (
        echo [ERROR] .env.example not found!
        echo Please create .env manually with the following variables:
        echo MONGODB_URI=your_mongodb_connection_string
        echo CLOUDINARY_CLOUD_NAME=your_cloud_name
        echo CLOUDINARY_API_KEY=your_api_key
        echo CLOUDINARY_API_SECRET=your_api_secret
        echo PORT=3000
        echo NODE_ENV=development
    )
)
echo.

:: Create .gitignore if it doesn't exist
if not exist ".gitignore" (
    echo Creating .gitignore...
    (
        echo .env
        echo .env.local
        echo .env.*.local
        echo node_modules/
        echo npm-debug.log*
        echo yarn-debug.log*
        echo yarn-error.log*
        echo .DS_Store
        echo Thumbs.db
        echo .vscode/
        echo .idea/
        echo *.swp
        echo *.swo
        echo *~
        echo logs/
        echo *.log
        echo dist/
        echo build/
        echo tmp/
        echo temp/
        echo uploads/
    ) > .gitignore
    echo [OK] .gitignore created
)
echo.

:: Installation complete
echo ========================================
echo      Installation Complete! 
echo ========================================
echo.
echo Next Steps:
echo 1. Configure your .env file with:
echo    - MongoDB Atlas connection string
echo    - Cloudinary credentials
echo.
echo 2. Start the development server:
echo    npm run dev
echo.
echo 3. Start the production server:
echo    npm start
echo.
echo 4. Open your browser at:
echo    http://localhost:3000
echo.
echo For detailed setup instructions, see:
echo - QUICKSTART.md
echo - README.md
echo.
echo Need help?
echo - Check MongoDB Atlas: https://www.mongodb.com/cloud/atlas
echo - Check Cloudinary: https://cloudinary.com
echo.
pause