#!/bin/bash
set -e

echo "🇸🇪 Fyndbot Quick Deploy Script"
echo "================================"
echo ""

if [ ! -f .env ]; then
	echo "⚠️  No .env file found. Creating from template..."
	cp .env.example .env
	echo ""
	echo "📝 Please edit .env with your TELEGRAM_BOT_TOKEN:"
	echo "   1. Message @BotFather on Telegram"
	echo "   2. Send /newbot and follow prompts"
	echo "   3. Copy your bot token to .env"
	echo ""
	read -p "Press Enter when .env is configured..."
fi

if ! grep -q "^TELEGRAM_BOT_TOKEN=.\+" .env; then
	echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
	echo "   Please edit .env and add your bot token."
	exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️  Building project..."
npm run build

echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "📁 Creating data directory..."
mkdir -p data

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the bot:"
echo "  npm start          # Production mode"
echo "  npm run dev        # Development mode (auto-reload)"
echo ""
echo "Useful commands:"
echo "  /start             # Register with bot"
echo "  /watch <url>       # Watch a Blocket search"
echo "  /list              # List your watches"
echo "  /inspect <url>     # Analyse a listing"
echo "  /help              # Show all commands"
echo ""
echo "Documentation:"
echo "  README.md          # Main guide"
echo "  QUICKSTART.md      # 5-minute setup"
echo "  TESTING.md         # Testing procedures"
echo ""
echo "Happy bargain hunting! 🎉"
