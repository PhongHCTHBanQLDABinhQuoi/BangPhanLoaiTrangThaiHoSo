@echo off
chcp 65001 >nul
title Dashboard Ho So Phap Ly - May chu noi bo (Base Workflow)
cd /d "%~dp0"
echo ================================================================
echo   DANG KHOI DONG MAY CHU DASHBOARD (lan dau co the mat vai giay)
echo ================================================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py server.py
  goto END
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto END
)
echo [LOI] May nay chua cai Python 3.
echo.
echo  1) Tai Python 3 tai: https://www.python.org/downloads/
echo  2) Khi cai NHO TICK vao o "Add Python to PATH"
echo  3) Cai xong, bam dup start.bat nay lai.
echo.
:END
echo.
echo May chu da dung. Bam phim bat ky de dong cua so nay...
pause >nul
