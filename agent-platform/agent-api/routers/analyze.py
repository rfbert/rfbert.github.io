"""POST /analyze - the deterministic mock AI (SPEC.txt Section 4.6).

DETERMINISM IS THE POINT. This service exists so the scaffold can prove an
internal call boundary, not to be clever. The proof asserts on this output, so
the same input text must produce byte-identical JSON on every run, on every
machine, forever. No randomness, no clock, no model, no network.

The rules, in full:

  tokens     len(text.split())  - whitespace-separated token count.

  summary    The input trimmed of surrounding whitespace, cut to its first 80
             characters (with a literal "..." appended only if the trimmed text
             was longer than 80), then " (N words)" where N == tokens.

  sentiment  Each token is lowercased and stripped of leading/trailing ASCII
             punctuation, then looked up in the two frozen keyword sets below.
             More positive hits than negative -> "positive".
             More negative hits than positive -> "negative".
             Equal (including zero hits on both sides) -> "neutral".
"""

from __future__ import annotations

import string

from fastapi import APIRouter, Depends, status

from models import AnalyzeRequest, AnalyzeResponse
from security import require_internal_secret

#: Mounted with the secret dependency here AND app-wide in main.py.
router = APIRouter(
    tags=["analyze"],
    dependencies=[Depends(require_internal_secret)],
)

SUMMARY_MAX_CHARS = 80

POSITIVE_KEYWORDS = frozenset(
    {
        "good",
        "great",
        "excellent",
        "love",
        "happy",
        "wonderful",
        "amazing",
        "helpful",
        "success",
        "positive",
    }
)

NEGATIVE_KEYWORDS = frozenset(
    {
        "bad",
        "terrible",
        "awful",
        "hate",
        "sad",
        "broken",
        "failure",
        "angry",
        "useless",
        "negative",
    }
)


def _normalize(token: str) -> str:
    """Lowercase a token and strip surrounding ASCII punctuation.

    So "Great!" and "great" score the same, without pulling in a tokenizer.
    """
    return token.lower().strip(string.punctuation)


def analyze_text(text: str) -> AnalyzeResponse:
    """Pure function. Kept separate from the route so it is trivially testable."""
    tokens = text.split()
    token_count = len(tokens)

    trimmed = text.strip()
    head = trimmed[:SUMMARY_MAX_CHARS]
    if len(trimmed) > SUMMARY_MAX_CHARS:
        head += "..."
    summary = f"{head} ({token_count} words)"

    normalized = [_normalize(token) for token in tokens]
    positive_hits = sum(1 for token in normalized if token in POSITIVE_KEYWORDS)
    negative_hits = sum(1 for token in normalized if token in NEGATIVE_KEYWORDS)

    if positive_hits > negative_hits:
        sentiment = "positive"
    elif negative_hits > positive_hits:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return AnalyzeResponse(summary=summary, sentiment=sentiment, tokens=token_count)


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse a piece of text (deterministic mock)",
)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Called only by agent-workspace-api, only with X-Internal-Secret.

    No user identity is accepted here and none is needed: the caller already
    resolved the local user and will persist this result against that row.
    """
    return analyze_text(payload.text)
