"""AI Scam Shield MCP Server.

Exposes scam detection and scam knowledge base search tools
via Model Context Protocol (MCP) using stdio or SSE transport.
"""

import argparse
import sys
from dotenv import load_dotenv
from mcp.server.mcpserver import MCPServer

from services.detector import (
    generate_answer,
    search_knowledge,
    answer_document_qa,
)

# Load environment variables
load_dotenv()

# Initialize MCP Server
mcp = MCPServer(
    name="ai-scam-shield",
    instructions="""AI Scam Shield MCP Server helps users detect scams, analyze suspicious messages, 
and search through verified scam-prevention knowledge. Always prioritize user safety and caution when analyzing suspected fraud.""",
    version="1.0.0",
)


@mcp.tool(
    name="check_scam",
    description="Analyze a message, email, SMS, link, or notification to determine whether it is a scam. Returns a clear assessment, reasons for suspicion, and safe next steps.",
)
def check_scam(message: str) -> str:
    """Analyze a suspicious message using AI Scam Shield vector knowledge base and Groq AI."""
    try:
        return generate_answer(message)
    except Exception as e:
        return f"Error analyzing message: {str(e)}"


@mcp.tool(
    name="search_scam_database",
    description="Search the verified scam knowledge base for patterns, fraud tactics, and case studies matching a specific query.",
)
def search_scam_database(query: str, limit: int = 3) -> str:
    """Search scam knowledge base using vector similarity search."""
    try:
        results = search_knowledge(query, limit=limit)
        if not results:
            return "No relevant scam information found for this query."

        output = []
        for idx, row in enumerate(results, 1):
            source = row[1]
            content = row[2]
            similarity = round(float(row[3]), 4)
            output.append(
                f"### Result {idx} (Source: {source} | Similarity: {similarity})\n{content}"
            )
        return "\n\n".join(output)
    except Exception as e:
        return f"Error searching knowledge base: {str(e)}"


@mcp.tool(
    name="ask_scam_question",
    description="Ask a question about scam identification, safety guidelines, bank fraud, and reporting steps grounded in official lessons.",
)
def ask_scam_question(question: str, limit: int = 3) -> str:
    """Answer general scam-safety questions using lesson knowledge chunks."""
    try:
        result = answer_document_qa(question, limit=limit)
        return result["answer"]
    except Exception as e:
        return f"Error generating answer: {str(e)}"


def main():
    parser = argparse.ArgumentParser(description="Run the AI Scam Shield MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport type: 'stdio' for local MCP clients (default), 'sse' for HTTP/SSE",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind for SSE transport (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to bind for SSE transport (default: 8001)",
    )
    args = parser.parse_args()

    if args.transport == "stdio":
        # Run standard I/O for Claude Desktop, Cursor, Antigravity, Inspector
        mcp.run(transport="stdio")
    elif args.transport == "sse":
        # Run Server-Sent Events server for remote clients
        mcp.run(transport="sse", host=args.host, port=args.port)


if __name__ == "__main__":
    main()

