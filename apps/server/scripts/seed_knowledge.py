import json
from urllib.request import Request, urlopen


API_URL = "http://localhost:8000/api/scam/knowledge"
MESSAGES = [
    {
        "text": "Your bank account will be blocked. Verify your KYC immediately.",
        "category": "PHISHING",
    },
    {
        "text": "You won a cash prize. Pay the processing fee to claim it.",
        "category": "LOTTERY",
    },
    {
        "text": "Microsoft support detected a virus. Call now and provide remote access.",
        "category": "TECH_SUPPORT",
    },
]


for message in MESSAGES:
    request = Request(
        API_URL,
        data=json.dumps(message).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request) as response:
        created = json.load(response)
        print(f"Created #{created['id']}: {created['category']}")
