#!/bin/bash

# Script di test per il refresh della history
# Usage: ./test-refresh.sh [symbol] [days] [force]

SYMBOL=${1:-BTC}
DAYS=${2:-7}
FORCE=${3:-true}
BASE_URL=${BASE_URL:-http://localhost:3000}

echo "🧪 Testing history refresh for $SYMBOL"
echo "📅 Days: $DAYS"
echo "🔨 Force: $FORCE"
echo ""

# Test refresh
echo "📤 Sending refresh request..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/history/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"symbols\": [\"$SYMBOL\"],
    \"days\": $DAYS,
    \"force\": $FORCE
  }")

echo "📥 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check status
echo "📊 Checking status..."
sleep 2
STATUS=$(curl -s "$BASE_URL/api/admin/history/status")
echo "$STATUS" | jq ".statuses[] | select(.symbol == \"$SYMBOL\")" 2>/dev/null || echo "$STATUS"

