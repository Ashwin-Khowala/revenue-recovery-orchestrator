# PowerShell Launcher for Razorpay Revenue Recovery Orchestrator
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting Razorpay AI Revenue Recovery Orchestrator" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
$env:PYTHONPATH = $PSScriptRoot
python run_all.py
