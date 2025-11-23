# Axiom Startup Guide

## Quick Start

To build the frontend and start the Axiom server with one command:

```bash
./start.sh
```

This script will:
1. ✅ Check/create Python virtual environment
2. ✅ Install Python dependencies (if needed)
3. ✅ Install frontend dependencies (if needed)
4. 🏗️  Build the Svelte frontend to `./static`
5. 🚀 Start the FastAPI server on port 8000

## Accessing the Application

Once started, you can access:

- **Frontend UI**: http://localhost:8000/
- **API Documentation**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## Manual Steps (Alternative)

If you prefer to run steps manually:

### 1. Backend Only

```bash
# Activate virtual environment
source venv/bin/activate

# Start server
python run.py
# OR
uvicorn app.main:app --reload
```

### 2. Frontend Development

For frontend development with hot reload:

```bash
cd frontend
npm run dev
```

This starts the Vite dev server on http://localhost:5174 with:
- Hot module replacement
- API proxy to backend on port 8000

### 3. Frontend Build Only

```bash
cd frontend
npm run build
```

Builds to `../static` directory.

## Requirements

- Python 3.13 (or compatible version)
- Node.js and npm
- Git (for cloning)

## Troubleshooting

### Port 8000 already in use

Kill the existing process or change the port in `.env`:

```bash
PORT=8001
```

### Frontend build fails

Make sure you have npm dependencies installed:

```bash
cd frontend
npm install
```

### Missing Python dependencies

Reinstall dependencies:

```bash
source venv/bin/activate
pip install -r requirements.txt
pip install setuptools pyarrow
```
