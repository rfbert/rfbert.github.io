"""Internal-secret enforcement for agent-api (SPEC.txt Section 4.6, 5.4, 8).

This module is the whole security surface of the service. agent-api is
INTERNAL ONLY: the only legitimate caller is agent-workspace-api, which sends

    X-Internal-Secret: <INTERNAL_SECRET>

and nothing else identifying. There is no JWT validation here, and there must
never be one - SPEC.txt Section 8: "Do not forward the user JWT to agent-api."
No user identity crosses this boundary, so agent-api cannot leak, log or
mis-scope a user identity it never receives.
"""

from __future__ import annotations

import os
import secrets
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException, status

load_dotenv()

#: Name of the header carrying the shared secret (SPEC.txt Section 5.4).
INTERNAL_SECRET_HEADER = "X-Internal-Secret"

#: The expected value. Must be byte-identical to agent-workspace-api's.
INTERNAL_SECRET: str = os.getenv("INTERNAL_SECRET", "dev-secret")

_EXPECTED: bytes = INTERNAL_SECRET.encode("utf-8")

_FORBIDDEN_DETAIL = (
    "Forbidden. agent-api is an internal service: every route requires a valid "
    f"{INTERNAL_SECRET_HEADER} header. It is not reachable from a browser."
)


async def require_internal_secret(
    x_internal_secret: Optional[str] = Header(
        default=None,
        alias=INTERNAL_SECRET_HEADER,
        description="Shared internal secret. Sent by agent-workspace-api only.",
    ),
) -> None:
    """FastAPI dependency: 403 unless the header matches INTERNAL_SECRET.

    Declared with ``default=None`` on purpose. A required Header would make
    FastAPI answer a missing header with 422 Unprocessable Entity; the spec
    asks for 403 whether the header is missing OR wrong, and answering both
    cases identically also avoids telling a prober which of the two it got.

    The comparison is ``secrets.compare_digest`` on the UTF-8 bytes, so it runs
    in time independent of how many leading characters a guess got right, and
    it cannot raise on a non-ASCII header value the way the str overload can.
    """
    if x_internal_secret is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_DETAIL
        )

    if not secrets.compare_digest(x_internal_secret.encode("utf-8"), _EXPECTED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN_DETAIL
        )
