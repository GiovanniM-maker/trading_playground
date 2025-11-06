# Setup Instructions

## Prerequisites

You need Node.js (v18 or higher) and npm installed.

### Install Node.js (macOS)

**Option 1: Using Homebrew (Recommended)**
```bash
brew install node
```

**Option 2: Using nvm (Node Version Manager)**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run:
source ~/.zshrc

# Install Node.js
nvm install 18
nvm use 18
```

**Option 3: Download from nodejs.org**
Visit https://nodejs.org/ and download the LTS version for macOS.

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to http://localhost:3000

## Troubleshooting

If you encounter any issues:

1. **Verify Node.js is installed:**
   ```bash
   node --version
   npm --version
   ```

2. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check for port conflicts:**
   If port 3000 is in use, Next.js will automatically use the next available port.

