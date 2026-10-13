from pydantic import BaseModel, Field, field_validator


class RagQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=20_000)

    @field_validator("question")
    @classmethod
    def question_must_have_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Question must not be empty")
        return value


class RagSource(BaseModel):
    document_name: str
    chunk_index: int
    snippet: str
    distance: float


class RagAskResponse(BaseModel):
    success: bool
    question: str
    answer: str
    sources: list[RagSource]
