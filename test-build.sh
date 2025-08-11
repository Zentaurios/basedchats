#!/bin/bash

echo "🔧 Testing build after fixing import issues..."

cd /Users/Ryan/builds/base-welcome

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    exit 1
fi

echo "📦 Running build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Ready to deploy!"
    echo "Next steps:"
    echo "1. npm run deploy      - Deploy to Vercel"
    echo "2. npm run manifest    - Set up Farcaster manifest"
    echo "3. Test in Base App    - Use manifest tool"
else
    echo "❌ Build failed - check the error above"
    exit 1
fi