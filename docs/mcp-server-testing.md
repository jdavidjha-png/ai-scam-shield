# AI Scam Shield — MCP Server Testing Guide

This guide provides complete, step-by-step instructions for testing and validating the **AI Scam Shield Model Context Protocol (MCP) Server** (`apps/server/mcp_server.py`).

---

## Table of Contents
1. [Overview & Server Architecture](#1-overview--server-architecture)
2. [Prerequisites & Environment Setup](#2-prerequisites--environment-setup)
3. [Method 1: Automated Self-Test (Fastest — 10 Seconds)](#3-method-1-automated-self-test-fastest--10-seconds)
4. [Method 2: Interactive Web UI via Official MCP Inspector (Recommended)](#4-method-2-interactive-web-ui-via-official-mcp-inspector-recommended)
5. [Method 3: Testing HTTP SSE Transport](#5-method-3-testing-http-sse-transport)
6. [Method 4: Integrating with AI Clients (Cursor, Claude Desktop, Antigravity)](#6-method-4-integrating-with-ai-clients-cursor-claude-desktop-antigravity)
7. [Comprehensive Test Scenarios Matrix](#7-comprehensive-test-scenarios-matrix)
8. [Troubleshooting & FAQs](#8-troubleshooting--faqs)

---

## 1. Overview & Server Architecture

The **AI Scam Shield MCP Server** exposes specialized fraud detection and vector search tools to AI agents (like Claude Desktop, Cursor, and Antigravity) via the Model Context Protocol.

### Registered Tools

| Tool Name | Arguments | Description |
| :--- | :--- | :--- |
| `check_scam` | `message: str` | Analyzes SMS, emails, links, or alerts for scam indicators using pgvector RAG + Groq AI. Returns fraud likelihood, red flags, and safe next steps. |
| `search_scam_database` | `query: str`, `limit: int = 3` | Performs vector similarity search over the verified knowledge base chunks with similarity scores and sources. |
| `ask_scam_question` | `question: str`, `limit: int = 3` | Answers scam prevention and reporting questions grounded in curated lesson documents. |

### Server Transports

- **`stdio`** (Default): Standard input/output transport used by local desktop clients (Claude Desktop, Cursor, MCP Inspector).
- **`sse`**: HTTP Server-Sent Events transport used for network-accessible or remote MCP connections.

---

## 2. Prerequisites & Environment Setup

Before testing, verify that the database and Python environment are running and configured.

### Step 2.1: Start PostgreSQL with pgvector

The vector knowledge base requires a running PostgreSQL instance with the `pgvector` extension.

On macOS (Homebrew):
```bash
brew services start postgresql@17
```

To verify the database is active and populated:
```bash
psql -U macbook -d ai_scam_shield -c "SELECT COUNT(*) FROM knowledge_base;"
```
*(Should return count $\ge 1$. If empty, run `apps/server/.venv/bin/python apps/server/embed_data.py` to seed embeddings).*

### Step 2.2: Verify Environment Variables

Check `apps/server/.env` to ensure the required variables are set:
```ini
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_scam_shield
DB_USER=macbook
DB_PASSWORD=
```

### Step 2.3: Activate the Virtual Environment

From the repository root:
```bash
cd apps/server
source .venv/bin/activate
```

Verify dependencies:
```bash
python mcp_server.py --help
```

---

## 3. Method 1: Automated Self-Test (Fastest — 10 Seconds)

We provide an automated MCP test runner script located at `apps/server/test_mcp_client.py`. It boots the MCP server over standard I/O, performs the protocol handshake, enumerates tools, and tests each tool end-to-end.

### Run the Test

From the repository root:
```bash
apps/server/.venv/bin/python apps/server/test_mcp_client.py
```
*(or from `apps/server` with the virtual environment activated: `python test_mcp_client.py`)*

### Expected Output

```text
========================================
  AI Scam Shield - MCP Server Test Suite 
========================================

• Python executable: .../apps/server/.venv/bin/python
• Server script:     .../apps/server/mcp_server.py
• Working dir:       .../apps/server

▶ Step 1: Initializing MCP Session...
✓ Connected to server: ai-scam-shield (v1.0.0)
  Instructions: AI Scam Shield MCP Server helps users detect scams...

▶ Step 2: Listing Registered Tools...
✓ Found 3 registered tools:
  • check_scam: Analyze a message, email, SMS, link, or notification...
  • search_scam_database: Search the verified scam knowledge base...
  • ask_scam_question: Ask a question about scam identification...

▶ Step 3: Testing 'search_scam_database'...
  Query: "urgent electricity bill unpaid disconnection threat"
✓ Result received successfully:
  Preview: ### Result 1 (Source: reporting-scams.md | Similarity: 0.2717)...

▶ Step 4: Testing 'check_scam'...
  Analyzing message: "URGENT: Your bank account has been locked..."
✓ Scam assessment generated:
  Preview: **1. Does the message look like a scam?** Yes. The email is almost certainly a phishing attempt...

▶ Step 5: Testing 'ask_scam_question'...
  Question: "What should I do immediately if I clicked a phishing link and entered my OTP?"
✓ Q&A guidance generated:
  Preview: **If you’ve just clicked a phishing link and entered your OTP, act fast:**...

========================================
  ALL TESTS PASSED (5/5) ✓
========================================
```

---

## 4. Method 2: Interactive Web UI via Official MCP Inspector (Recommended)

The **MCP Inspector** (`@modelcontextprotocol/inspector`) is the official visual GUI tool provided by the Model Context Protocol developers. It lets you interactively test tools, provide custom parameters, and examine JSON-RPC traffic.

### Step 4.1: Launch the Inspector

Since this repository uses **pnpm** as its configured package manager (`devEngines` in `package.json`), use **`pnpm dlx`** (the pnpm equivalent of `npx`):

From the repository root, run:
```bash
pnpm dlx @modelcontextprotocol/inspector apps/server/.venv/bin/python apps/server/mcp_server.py
```

Or from inside `apps/server/`:
```bash
pnpm dlx @modelcontextprotocol/inspector .venv/bin/python mcp_server.py
```

> **Note**: If you run `npx` instead, npm may fail with `EBADDEVENGINES` because `package.json` enforces `pnpm`. Always use `pnpm dlx`.

### Step 4.2: Open the Web UI

1. Open your browser to the URL displayed in the terminal (typically `http://localhost:5173`).
2. Verify **Transport Type** is set to `stdio`.
3. Click **Connect**.

### Step 4.3: Test Server Information

- Confirm the server name displays **`ai-scam-shield`** with version **`1.0.0`**.
- Notice the instructions indicating scam detection and safety prioritization.

### Step 4.4: Test Individual Tools

Navigate to the **Tools** tab:

#### 1. Test `check_scam`
- Select `check_scam`.
- In the `message` input field, paste a test scam message:
  ```text
  URGENT: Your State Bank electricity bill is overdue by $124.50. Service will be disconnected at 9 PM tonight unless cleared immediately. Pay here: http://bit.ly/power-pay-bill
  ```
- Click **Run Tool**.
- **Expected Result**: A clear markdown response explaining:
  1. Whether it looks like a scam (Yes).
  2. Red flags (urgency tactic, suspicious shortened link, non-standard payment channel).
  3. Safe next steps (do not click, contact utility company directly through official website or bill).

#### 2. Test `search_scam_database`
- Select `search_scam_database`.
- Set parameters:
  - `query`: `lottery prize won claim fee advance payment`
  - `limit`: `2`
- Click **Run Tool**.
- **Expected Result**: Ranked knowledge base snippets displaying source files (e.g. `phishing-basics.md`), similarity scores (e.g. `0.25+`), and content text.

#### 3. Test `ask_scam_question`
- Select `ask_scam_question`.
- Set parameters:
  - `question`: `How can I tell if an incoming SMS is really from my bank?`
  - `limit`: `3`
- Click **Run Tool**.
- **Expected Result**: A comprehensive, cited answer giving practical rules (checking sender ID, looking for HTTPS URLs, knowing banks never ask for OTP or PIN).

---

## 5. Method 3: Testing HTTP SSE Transport

The MCP server also supports **Server-Sent Events (SSE)** for HTTP-based clients.

### Step 5.1: Start the SSE Server

From `apps/server/`:
```bash
python mcp_server.py --transport sse --host 0.0.0.0 --port 8001
```

You will see:
```text
INFO: Started server process
INFO: Waiting for application startup.
INFO: Application startup complete.
INFO: Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

### Step 5.2: Test via MCP Inspector over SSE

1. Run the inspector without command arguments:
   ```bash
   pnpm dlx @modelcontextprotocol/inspector
   ```
2. In the inspector UI, set **Transport Type** to `SSE`.
3. Set **URL** to:
   ```text
   http://localhost:8001/sse
   ```
4. Click **Connect**.
5. All three tools will be available for interactive testing just like in stdio mode.

### Step 5.3: Test with curl

In another terminal, test that the SSE endpoint is streaming events:
```bash
curl -i -N http://localhost:8001/sse
```
*You should see HTTP headers including `Content-Type: text/event-stream` and `Cache-Control: no-cache`.*

---

## 6. Method 4: Integrating with AI Clients (Cursor, Claude Desktop, Antigravity)

Once local testing passes, you can connect the MCP server directly to your AI IDE or assistant.

### A. Cursor IDE

1. Open **Cursor Settings** $\to$ **Features** $\to$ **MCP**.
2. Click **+ Add New MCP Server**.
3. Fill in the details:
   - **Name**: `ai-scam-shield`
   - **Type**: `command`
   - **Command**:
     ```text
     /Users/macbook/Desktop/ai_scam_shield/apps/server/.venv/bin/python /Users/macbook/Desktop/ai_scam_shield/apps/server/mcp_server.py --transport stdio
     ```
   *(Or add to your project's `.cursor/mcp.json`):*
   ```json
   {
     "mcpServers": {
       "ai-scam-shield": {
         "command": "/Users/macbook/Desktop/ai_scam_shield/apps/server/.venv/bin/python",
         "args": [
           "/Users/macbook/Desktop/ai_scam_shield/apps/server/mcp_server.py",
           "--transport",
           "stdio"
         ]
       }
     }
   }
   ```
4. Verify the green indicator appears next to `ai-scam-shield`.

### B. Claude Desktop

1. Open Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the server entry:
   ```json
   {
     "mcpServers": {
       "ai-scam-shield": {
         "command": "/Users/macbook/Desktop/ai_scam_shield/apps/server/.venv/bin/python",
         "args": [
           "/Users/macbook/Desktop/ai_scam_shield/apps/server/mcp_server.py",
           "--transport",
           "stdio"
         ]
       }
     }
   }
   ```
3. Restart Claude Desktop.
4. Click the 🔨 hammer icon in chat to verify `check_scam`, `search_scam_database`, and `ask_scam_question` are active.

---

## 7. Comprehensive Test Scenarios Matrix

Use these sample test cases to verify accuracy across different fraud tactics:

| Test Scenario | Tool | Sample Input | Expected Output Characteristics |
| :--- | :--- | :--- | :--- |
| **Banking KYC Scam** | `check_scam` | `"Dear SBI user, your net banking will be deactivated today. Visit http://sbi-kyc-update.xyz to submit Aadhaar and PAN immediately."` | Identifies phishing link domain (`.xyz`), high urgency tactic, instructs user not to visit link. |
| **Part-Time Job Scam** | `check_scam` | `"Earn $500/day by liking YouTube videos and rating hotels on Google Maps! No experience required. Telegram: @FastJobEarners"` | Flags advance fee / task scam patterns, high pay for low effort red flag, Telegram recruitment warning. |
| **Legitimate Message (False Positive Check)** | `check_scam` | `"Your verification code for Netflix is 482910. Do not share this code with anyone. Netflix will never call you to ask for this code."` | Distinguishes normal 2FA security alerts, notes warning message included by company, advises not sharing. |
| **Knowledge Base Retrieval** | `search_scam_database` | `query: "OTP fraud credit card skimming"` | Returns chunks from `reporting-scams.md` or `phishing-basics.md` with similarity metrics. |
| **Recovery Advice** | `ask_scam_question` | `"I gave my credit card number and CVV on a fake website 10 minutes ago. What should I do?"` | Immediate steps: freeze card via banking app, call bank fraud line, monitor unauthorized charges, report to authorities. |

---

## 8. Troubleshooting & FAQs

### Q: `npm error code EBADDEVENGINES: Invalid name "pnpm" does not match "npm"`
**Cause**: The repository's root `package.json` specifies `"devEngines": { "packageManager": { "name": "pnpm" } }`. When you run `npx`, npm detects this requirement and aborts execution to prevent tool mismatch.  
**Fix**: Use `pnpm dlx` instead of `npx`:
```bash
pnpm dlx @modelcontextprotocol/inspector apps/server/.venv/bin/python apps/server/mcp_server.py
```

### Q: `OperationalError: connection to server at "127.0.0.1", port 5432 failed: Connection refused`
**Cause**: PostgreSQL is not currently running.  
**Fix**: Start PostgreSQL:
```bash
brew services start postgresql@17
```

### Q: `groq.AuthenticationError: Error code: 401 - Invalid API Key`
**Cause**: `GROQ_API_KEY` is either missing or expired in `apps/server/.env`.  
**Fix**: Ensure a valid Groq API key is present in `apps/server/.env`:
```bash
cat apps/server/.env | grep GROQ_API_KEY
```

### Q: `AttributeError` or missing package when launching
**Cause**: The wrong Python interpreter was invoked (e.g. system Python instead of the virtualenv).  
**Fix**: Always use the virtual environment executable:
```bash
/Users/macbook/Desktop/ai_scam_shield/apps/server/.venv/bin/python apps/server/mcp_server.py
```

### Q: Does the MCP server interfere with standard stdio?
**Note**: The server uses standard I/O for JSON-RPC messages. In `apps/server/mcp_server.py`, all errors are safely caught and returned inside tool response strings rather than crashing the process, ensuring continuous connection stability for host clients.

