from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from services.detector import (
    search_knowledge,
    generate_answer,
    answer_document_qa,
)
from services.db import get_db_connection

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Scam Shield API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request models
class MessageRequest(BaseModel):
    message: str


class QARequest(BaseModel):
    question: str
    limit: int = 3


@app.get("/")
def home():
    return {
        "message": "AI Scam Shield API is running"
    }


@app.post("/check-scam")
def check_scam(request: MessageRequest):
    try:
        answer = generate_answer(request.message)
        return {
            "success": True,
            "analysis": answer
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "analysis": "Unable to analyze the message. Please try again."
        }


@app.post("/document-qa")
@app.post("/qa")
def document_qa(request: QARequest):
    try:
        qa_result = answer_document_qa(request.question, limit=request.limit)
        return {
            "success": True,
            "answer": qa_result["answer"],
            "sources": qa_result["sources"]
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "answer": "Unable to generate answer. Please try again."
        }