import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize GROQ client
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


class MessageRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return FileResponse("index.html")


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
            model="openai/gpt-oss-20b",
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
