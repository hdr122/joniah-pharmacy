#!/bin/bash

# Joniah Pharmacy - Railway Deployment Setup Script
# This script prepares your project for deployment to Railway.app

set -e

echo "🚀 Joniah Pharmacy - Railway Deployment Setup"
echo "=============================================="
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
    git config user.name "${GIT_USER_NAME:-Joniah Deployment}"
    git config user.email "${GIT_USER_EMAIL:-deployment@joniah.local}"
else
    echo "✅ Git repository already initialized"
fi

echo ""
echo "📝 Current git status:"
git status --short | head -10
echo ""

# Check for uncommitted changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Repository is clean"
else
    echo "⚠️  Uncommitted changes detected"
    read -p "Do you want to commit changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        read -p "Enter commit message: " commit_msg
        git commit -m "${commit_msg:-fix: deployment updates}"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create a GitHub repository at https://github.com/new"
echo "2. Run: git remote add origin https://github.com/yourusername/joniah-pharmacy.git"
echo "3. Run: git branch -M main && git push -u origin main"
echo "4. Go to https://railway.app and deploy from GitHub"
echo ""
echo "📖 For detailed instructions, see RAILWAY_DEPLOYMENT.md"
