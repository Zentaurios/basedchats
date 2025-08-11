#!/bin/bash

# BasedChats Setup Script
echo "🔵 Setting up BasedChats..."
echo "Base is for [ everything ]"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if .env file exists and has required variables
echo "🔧 Checking environment configuration..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    exit 1
fi

# Check for required environment variables
required_vars=(
    "NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME"
    "NEYNAR_API_KEY"
    "REDIS_URL"
    "REDIS_TOKEN"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env || grep -q "^$var=$" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "✅ Environment variables configured"
else
    echo "⚠️  Missing or empty environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please update your .env file with the required values."
    echo "See README.md for details on obtaining these values."
fi

# Test the build
echo "🔨 Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. npm run dev          - Start development server"
echo "2. npm run manifest     - Set up Farcaster manifest (when ready to deploy)"
echo "3. npm run deploy       - Deploy to Vercel"
echo ""
echo "📖 Resources:"
echo "- README.md             - Complete setup guide"
echo "- Base Brand Kit        - https://base.org/brand-kit"
echo "- MiniKit Docs          - https://docs.base.org/builderkits/minikit"
echo ""
echo "🔵 Happy building on Base!"