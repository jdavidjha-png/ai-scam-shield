"""Automated test runner for AI Scam Shield MCP Server.

Connects to `mcp_server.py` via stdio transport, initializes the session,
inspects registered tools, and tests each tool with sample inputs.
"""

import asyncio
import os
import sys
from mcp import StdioServerParameters
from mcp.client.session import ClientSession
from mcp.client.stdio import stdio_client

# ANSI colors for readable terminal output
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


async def run_tests():
    server_dir = os.path.dirname(os.path.abspath(__file__))
    server_script = os.path.join(server_dir, "mcp_server.py")
    python_bin = sys.executable

    print(f"\n{BOLD}{BLUE}========================================{RESET}")
    print(f"{BOLD}{BLUE}  AI Scam Shield - MCP Server Test Suite {RESET}")
    print(f"{BOLD}{BLUE}========================================{RESET}\n")

    print(f"• Python executable: {python_bin}")
    print(f"• Server script:     {server_script}")
    print(f"• Working dir:       {server_dir}\n")

    server_params = StdioServerParameters(
        command=python_bin,
        args=[server_script, "--transport", "stdio"],
        env=dict(os.environ),
        cwd=server_dir,
    )

    passed = 0
    total = 0

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                # 1. Initialize
                print(f"{YELLOW}▶ Step 1: Initializing MCP Session...{RESET}")
                init_result = await session.initialize()
                print(
                    f"{GREEN}✓ Connected to server:{RESET} {init_result.server_info.name} (v{init_result.server_info.version})"
                )
                print(f"  Instructions: {init_result.instructions}\n")
                passed += 1
                total += 1

                # 2. List Tools
                print(f"{YELLOW}▶ Step 2: Listing Registered Tools...{RESET}")
                tools_result = await session.list_tools()
                tools = tools_result.tools
                print(f"{GREEN}✓ Found {len(tools)} registered tools:{RESET}")
                for tool in tools:
                    print(f"  • {BOLD}{tool.name}{RESET}: {tool.description}")
                print()
                passed += 1
                total += 1

                # 3. Test search_scam_database
                total += 1
                print(f"{YELLOW}▶ Step 3: Testing 'search_scam_database'...{RESET}")
                query = "urgent electricity bill unpaid disconnection threat"
                print(f"  Query: \"{query}\"")
                search_res = await session.call_tool(
                    "search_scam_database",
                    arguments={"query": query, "limit": 2},
                )
                text_content = "".join(
                    c.text for c in search_res.content if hasattr(c, "text")
                )
                if search_res.is_error:
                    print(f"{RED}✗ Tool returned error:{RESET} {text_content}")
                else:
                    passed += 1
                    preview = text_content.strip().split("\n")[0]
                    print(f"{GREEN}✓ Result received successfully:{RESET}")
                    print(f"  Preview: {preview[:120]}...\n")

                # 4. Test check_scam
                total += 1
                print(f"{YELLOW}▶ Step 4: Testing 'check_scam'...{RESET}")
                scam_msg = (
                    "URGENT: Your bank account has been locked due to pending KYC verification. "
                    "Update immediately at http://bit.ly/bank-secure-update or your funds will be seized within 2 hours."
                )
                print(f"  Analyzing message: \"{scam_msg[:70]}...\"")
                check_res = await session.call_tool(
                    "check_scam",
                    arguments={"message": scam_msg},
                )
                check_text = "".join(
                    c.text for c in check_res.content if hasattr(c, "text")
                )
                if check_res.is_error or "Error analyzing message" in check_text:
                    print(f"{RED}✗ Error or failure:{RESET} {check_text}")
                else:
                    passed += 1
                    preview = (
                        check_text.strip().replace("\n", " ")[:120] + "..."
                    )
                    print(f"{GREEN}✓ Scam assessment generated:{RESET}")
                    print(f"  Preview: {preview}\n")

                # 5. Test ask_scam_question
                total += 1
                print(f"{YELLOW}▶ Step 5: Testing 'ask_scam_question'...{RESET}")
                question = "What should I do immediately if I clicked a phishing link and entered my OTP?"
                print(f"  Question: \"{question}\"")
                qa_res = await session.call_tool(
                    "ask_scam_question",
                    arguments={"question": question, "limit": 2},
                )
                qa_text = "".join(
                    c.text for c in qa_res.content if hasattr(c, "text")
                )
                if qa_res.is_error or "Error generating answer" in qa_text:
                    print(f"{RED}✗ Error or failure:{RESET} {qa_text}")
                else:
                    passed += 1
                    preview = qa_text.strip().replace("\n", " ")[:120] + "..."
                    print(f"{GREEN}✓ Q&A guidance generated:{RESET}")
                    print(f"  Preview: {preview}\n")

    except Exception as e:
        print(f"\n{RED}✗ Unexpected exception during test execution: {e}{RESET}")
        import traceback

        traceback.print_exc()

    print(f"{BOLD}{BLUE}========================================{RESET}")
    if passed == total:
        print(
            f"{BOLD}{GREEN}  ALL TESTS PASSED ({passed}/{total}) ✓{RESET}"
        )
    else:
        print(
            f"{BOLD}{YELLOW}  TESTS COMPLETED: {passed}/{total} Passed{RESET}"
        )
    print(f"{BOLD}{BLUE}========================================{RESET}\n")


if __name__ == "__main__":
    asyncio.run(run_tests())
