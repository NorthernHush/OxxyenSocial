#!/bin/bash

# OXXYEN SOCIAL Startup Script

echo "🚀 Starting OXXYEN SOCIAL..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 20+"
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB не найден. Установка локального экземпляра..."
    # For Arch Linux
    if command -v pacman &> /dev/null; then
        sudo pacman -S mongodb --noconfirm
    else
        echo "❌ Установите MongoDB вручную"
        exit 1
    fi
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "⚠️  ngrok не найден. Скачивание..."
    wget -qO- https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar xvz -C /usr/local/bin
fi

# Create necessary directories
mkdir -p uploads logs

# Start MongoDB if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📊 Starting MongoDB..."
    mkdir -p /tmp/mongodb
    mongod --dbpath /tmp/mongodb --fork --logpath logs/mongodb.log
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Go back to backend
cd ../backend

# Start backend server
echo "🖥️  Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start ngrok
echo "🌐 Starting ngrok..."
ngrok http 3000 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

echo ""
echo "✅ OXXYEN SOCIAL запущен!"
echo "🌐 Доступен по адресу: $NGROK_URL"
echo "📱 Откройте этот URL в браузере"
echo ""
echo "🧪 Тестовый аккаунт:"
echo "   Email: test@oxxyen.social"
echo "   Пароль: password123"
echo ""
echo "⚠️  Нажмите Ctrl+C для остановки"

# Wait for processes
wait $BACKEND_PID $NGROK_PID
