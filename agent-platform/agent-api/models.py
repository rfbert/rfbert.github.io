"""Request/response schemas for agent-api (SPEC.txt Section 4.6).

Note what these models do NOT contain: no user id, no tid, no oid, no token,
no tenant. agent-workspace-api sends text and gets an analysis back; it is the
one that knows which local user the result belongs to and persists it against
that row (SPEC.txt Section 5.4, Section 8).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Body of POST /analyze."""

    text: str = Field(
        ...,
        description="Raw text to analyse. The only thing that crosses this boundary.",
        examples=["The new workspace integration is great and works well."],
    )


class AnalyzeResponse(BaseModel):
    """Deterministic mock analysis. Same text in, same JSON out, always."""

    summary: str = Field(
        ...,
        description="First 80 characters of the trimmed text, plus its word count.",
    )
    sentiment: str = Field(
        ...,
        description='One of "positive", "negative", "neutral" - simple keyword rule.',
    )
    tokens: int = Field(
        ...,
        description="Whitespace-separated token count of the input text.",
    )
