from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScamCategory(str, Enum):
    PHISHING = "PHISHING"
    BANKING = "BANKING"
    INVESTMENT = "INVESTMENT"
    LOTTERY = "LOTTERY"
    ROMANCE = "ROMANCE"
    IMPERSONATION = "IMPERSONATION"
    TECH_SUPPORT = "TECH_SUPPORT"
    JOB = "JOB"
    OTHER = "OTHER"


class MessageInput(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)

    @field_validator("message")
    @classmethod
    def message_must_have_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message must not be empty")
        return value


class KnowledgeCreate(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    category: ScamCategory

    @field_validator("text")
    @classmethod
    def text_must_have_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text must not be empty")
        return value


class ScamMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    category: ScamCategory
    created_at: datetime


class SearchResult(ScamMessageResponse):
    distance: float
