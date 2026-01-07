# Modal Auto Hair - 部署腳本
# 使用方式: ./deploy.ps1

Write-Host "🚀 Modal Auto Hair Deployment Script" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Check if modal is installed
Write-Host "Checking Modal installation..." -ForegroundColor Yellow
try {
    $modalVersion = python -m modal --version 2>&1
    Write-Host "✅ Modal installed: $modalVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Modal not found. Installing..." -ForegroundColor Red
    pip install modal --upgrade
}

# Authenticate with Modal
Write-Host "`n🔐 Authenticating with Modal..." -ForegroundColor Yellow
Write-Host "Please complete authentication in browser...`n" -ForegroundColor Gray

python -m modal token new

# Deploy the app
Write-Host "`n📦 Deploying Auto Hair to Modal..." -ForegroundColor Yellow

python -m modal deploy auto_hair.py

# Show success message
Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Copy the webhook URL displayed above" -ForegroundColor White
Write-Host "2. Update js/modalHairEnhancement.js with your URL" -ForegroundColor White
Write-Host "3. Test the integration!" -ForegroundColor White

Write-Host "`n💡 To test locally:" -ForegroundColor Cyan
Write-Host "python -m modal run auto_hair.py --image-path test_image.jpg" -ForegroundColor Gray
