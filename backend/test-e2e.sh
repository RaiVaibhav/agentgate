#!/bin/bash
#
# End-to-end test for the Agent Permission Gateway
#
# Prerequisites:
#   - Postgres running with the saas DB
#   - All migrations applied (pnpm db:migrate && pnpm proxy:migrate && pnpm dummy:migrate)
#   - User seeded (test@test.com / admin123 with id=1)
#   - Services running:
#       pnpm proxy:dev    (port 3001)
#       pnpm gateway:dev  (port 3003)
#       pnpm dev          (port 3000)
#
# Run: bash backend/test-e2e.sh
#

set -e

PROXY="http://localhost:3001"
GATEWAY="http://localhost:3003"
NEXTJS="http://localhost:3000"
USER_ID="1"  # seeded test user

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; exit 1; }
info() { echo -e "${YELLOW}→${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Agent Permission Gateway — End-to-End Test"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── Step 1: Health checks ────────────────────────────────────────────────────
info "Checking services are running..."

curl -sf "$PROXY/health" > /dev/null || fail "Proxy not running on :3001"
curl -sf "$GATEWAY/health" > /dev/null || fail "Gateway not running on :3003"
pass "All services healthy"

# ─── Step 2: Create an agent ──────────────────────────────────────────────────
info "Creating agent 'Test Bot'..."

AGENT=$(curl -sf -X POST "$PROXY/agents" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d '{"name":"Test Bot","description":"E2E test agent"}')

AGENT_ID=$(echo "$AGENT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$AGENT_ID" ]; then
  fail "Could not create agent. Response: $AGENT"
fi
pass "Agent created: $AGENT_ID"

# ─── Step 3: Add a service with tool permissions ──────────────────────────────
info "Adding filesystem service with permissions..."

SERVICE=$(curl -sf -X POST "$PROXY/services" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"name\": \"Filesystem\",
    \"command\": \"npx\",
    \"args\": [\"-y\", \"@modelcontextprotocol/server-filesystem\", \"/Users/vaibhav/saas-starter\"],
    \"env\": {},
    \"tools\": [{\"name\":\"read_file\"},{\"name\":\"write_file\"},{\"name\":\"delete_file\"},{\"name\":\"list_directory\"}],
    \"permissions\": [
      {\"toolName\":\"read_file\",   \"effect\":\"allow\", \"priority\": 1},
      {\"toolName\":\"read_file\",   \"effect\":\"deny\",  \"pathArg\":\"path\", \"pathPattern\":\"**/.env*\", \"priority\": 10},
      {\"toolName\":\"list_directory\", \"effect\":\"allow\", \"priority\": 1},
      {\"toolName\":\"write_file\",  \"effect\":\"deny\",  \"priority\": 1},
      {\"toolName\":\"delete_file\", \"effect\":\"deny\",  \"priority\": 1}
    ]
  }")

SERVICE_ID=$(echo "$SERVICE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SERVICE_ID" ]; then
  fail "Could not create service. Response: $SERVICE"
fi
pass "Service created: $SERVICE_ID"

# ─── Step 4: Create a session ─────────────────────────────────────────────────
info "Creating session (60 min)..."

SESSION=$(curl -sf -X POST "$PROXY/sessions" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $USER_ID" \
  -d "{\"agentId\":\"$AGENT_ID\",\"durationMinutes\":60}")

TOKEN=$(echo "$SESSION" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
GATEWAY_URL=$(echo "$SESSION" | grep -o '"gatewayUrl":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  fail "Could not create session. Response: $SESSION"
fi
pass "Session created. Gateway URL: $GATEWAY_URL"

# ─── Step 5: Test the gateway — permission checks ────────────────────────────
echo ""
echo "─── Permission Tests ───────────────────────────────"
echo ""

# Test 5a: ALLOWED — read_file with a normal path
info "Test: read_file on package.json (should be ALLOWED)..."

RESULT=$(curl -sf -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/call",
    "params":{"name":"read_file","arguments":{"path":"/Users/vaibhav/saas-starter/package.json"}}
  }')

if echo "$RESULT" | grep -q "Permission denied"; then
  fail "read_file package.json was denied. Response: $RESULT"
fi
pass "read_file package.json → ALLOWED"

# Test 5b: DENIED — read_file on .env
info "Test: read_file on .env (should be DENIED)..."

RESULT=$(curl -sf -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{"name":"read_file","arguments":{"path":"/Users/vaibhav/saas-starter/.env"}}
  }')

if echo "$RESULT" | grep -q "Permission denied"; then
  pass "read_file .env → DENIED ✓"
else
  fail "read_file .env was NOT denied. Response: $RESULT"
fi

# Test 5c: DENIED — write_file
info "Test: write_file (should be DENIED)..."

RESULT=$(curl -sf -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{"name":"write_file","arguments":{"path":"/tmp/test.txt","content":"hello"}}
  }')

if echo "$RESULT" | grep -q "Permission denied"; then
  pass "write_file → DENIED ✓"
else
  fail "write_file was NOT denied. Response: $RESULT"
fi

# Test 5d: DENIED — delete_file
info "Test: delete_file (should be DENIED)..."

RESULT=$(curl -sf -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"tools/call",
    "params":{"name":"delete_file","arguments":{"path":"/Users/vaibhav/saas-starter/README.md"}}
  }')

if echo "$RESULT" | grep -q "Permission denied"; then
  pass "delete_file → DENIED ✓"
else
  fail "delete_file was NOT denied. Response: $RESULT"
fi

# Test 5e: DENIED — unknown tool (fail-closed)
info "Test: unknown_tool (should be DENIED by default)..."

RESULT=$(curl -sf -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":5,
    "method":"tools/call",
    "params":{"name":"execute_shell","arguments":{"command":"rm -rf /"}}
  }')

if echo "$RESULT" | grep -q "Permission denied"; then
  pass "unknown_tool → DENIED (fail-closed) ✓"
else
  fail "unknown_tool was NOT denied. Response: $RESULT"
fi

# ─── Step 6: Verify audit log ─────────────────────────────────────────────────
echo ""
echo "─── Audit Log ────────────────────────────────────────"
echo ""
info "Fetching audit log..."

AUDIT=$(curl -sf "$PROXY/audit?agentId=$AGENT_ID" \
  -H "X-User-Id: $USER_ID")

TOTAL=$(echo "$AUDIT" | grep -o '"id"' | wc -l | tr -d ' ')
DENIED_COUNT=$(echo "$AUDIT" | grep -o '"denied"' | wc -l | tr -d ' ')
ALLOWED_COUNT=$(echo "$AUDIT" | grep -o '"allowed"' | wc -l | tr -d ' ')

info "Total entries: $TOTAL | Allowed: $ALLOWED_COUNT | Denied: $DENIED_COUNT"

if [ "$DENIED_COUNT" -ge 4 ]; then
  pass "Audit log recorded 4+ denied attempts"
else
  fail "Expected at least 4 denied entries, got $DENIED_COUNT"
fi

# ─── Step 7: Test session revocation ──────────────────────────────────────────
echo ""
echo "─── Session Revocation ─────────────────────────────────"
echo ""
info "Revoking session..."

SESSION_ID=$(echo "$SESSION" | grep -o '"sessionId":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -sf -X POST "$PROXY/sessions/$SESSION_ID/revoke" -H "X-User-Id: $USER_ID" > /dev/null

info "Attempting tool call with revoked session..."

RESULT=$(curl -s -X POST "$GATEWAY/mcp/$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":99,
    "method":"tools/call",
    "params":{"name":"read_file","arguments":{"path":"/Users/vaibhav/saas-starter/package.json"}}
  }')

if echo "$RESULT" | grep -qi "revoked\|expired\|invalid\|unauthorized\|401"; then
  pass "Revoked session → rejected ✓"
else
  fail "Revoked session was NOT rejected. Response: $RESULT"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}ALL TESTS PASSED${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  ✅ Agent created"
echo "  ✅ Service + permissions configured"
echo "  ✅ Session created with gateway URL"
echo "  ✅ read_file on allowed path → forwarded"
echo "  ✅ read_file on .env → blocked (path pattern)"
echo "  ✅ write_file → blocked (tool-level deny)"
echo "  ✅ delete_file → blocked (tool-level deny)"
echo "  ✅ Unknown tool → blocked (fail-closed)"
echo "  ✅ Audit log recorded all decisions"
echo "  ✅ Revoked session → access rejected"
echo ""
