#!/bin/bash

# BasedChats - Deployment Script
echo "🚀 Deploying BasedChats Mini App..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Deploy to Vercel
echo "☁️ Deploying to Vercel..."
npx vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Vercel dashboard:"
echo "   - NEXT_PUBLIC_ONCHAINKIT_API_KEY"
echo "   - NEXT_PUBLIC_URL (your deployed URL)"
echo "   - NEYNAR_API_KEY (already set in .env)"
echo "   - REDIS_URL (already set in .env)"
echo "   - REDIS_TOKEN (already set in .env)"
echo ""
echo "2. Create manifest:"
echo "   npx create-onchain --manifest"
echo ""
echo "3. Add manifest values to Vercel:"
echo "   - FARCASTER_HEADER"
echo "   - FARCASTER_PAYLOAD"
echo "   - FARCASTER_SIGNATURE"
echo ""
echo "4. Test in Base App:"
echo "   https://farcaster.xyz/~/developers/mini-apps/manifest"
echo ""
echo "🎉 Base is for [ everything ]!"
