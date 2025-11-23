#!/bin/bash

# Axiom Development Server Startup Script
# Builds frontend and starts the FastAPI backend server

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Axiom Development Server"
echo "============================"
echo ""

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Python virtual environment not found!"
    echo "   Creating virtual environment..."
    python -m venv venv
    echo "   Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
    pip install setuptools pyarrow
else
    echo "✅ Python virtual environment found"
    source venv/bin/activate
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
else
    echo "✅ Frontend dependencies installed"
fi

# Build frontend
echo ""
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

if [ -d "static" ]; then
    echo "✅ Frontend built successfully to ./static"
else
    echo "❌ Frontend build failed!"
    exit 1
fi

# Start backend server
echo ""
echo "🚀 Starting FastAPI server..."
echo "   Server will be available at:"
echo "   - API: http://localhost:8001"
echo "   - Docs: http://localhost:8001/docs"
echo "   - Frontend: http://localhost:8001/"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

python run.py
