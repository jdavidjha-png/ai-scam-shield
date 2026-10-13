
# pyrefly: disable
# type: ignore

from fastapi import FastAPI  # pyrefly: ignore [missing-import] # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # pyrefly: ignore [missing-import] # type: ignore
from fastapi.responses import FileResponse  # pyrefly: ignore [missing-import] # type: ignore
from pydantic import BaseModel  # pyrefly: ignore [missing-import] # type: ignore
from dotenv import load_dotenv  # pyrefly: ignore [missing-import] # type: ignore

from routes.rag import router as rag_router
from services.groq_client import DEFAULT_GROQ_MODEL, get_groq_client

load_dotenv()

app = FastAPI()
app.include_router(rag_router)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = get_groq_client()


class MessageRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return FileResponse("../web/components/ScamShieldAnalyzer.tsx")


@app.post("/check-scam")
def check_scam(request: MessageRequest):
    try:
        # Create a detailed prompt for scam detection
        prompt = f"""You are a scam detection expert. Analyze the following message and determine if it's a scam or legitimate.

Message to analyze:
"{request.message}"

Analyze this message for common scam indicators such as:
- Urgency or pressure tactics
- Requests for personal information, passwords, or financial details
- Too-good-to-be-true offers
- Poor grammar or spelling
- Suspicious links or phone numbers
- Impersonation of official entities
- Requests for money transfers or gift cards
- Threatening language

Provide your response in the following format:
1. Verdict: [SCAM/LEGITIMATE/SUSPICIOUS]
2. Confidence: [percentage]
3. Reasoning: [brief explanation]
4. Red Flags: [list key warning signs if any]
5. Recommendation: [what the user should do]

Be concise but thorough."""

        response = client.chat.completions.create(
            model=DEFAULT_GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at detecting scams, phishing attempts, and fraudulent messages. You provide clear, accurate assessments to help people stay safe."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3  # Lower temperature for more consistent analysis
        )

        return {
            "success": True,
            "analysis": response.choices[0].message.content
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "analysis": "Unable to analyze the message. Please try again."
        }
