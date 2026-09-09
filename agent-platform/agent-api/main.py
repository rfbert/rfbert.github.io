"""agent-api - internal AI mock (SPEC.txt Section 4.6), port 8000.

    uvicorn main:app --reload --port 8000

THIS SERVICE IS UNREACHABLE FROM A BROWSER, BY CONSTRUCTION. That is an
architectural claim the scaffold exists to prove, so three things are true of
this file and must stay true:

  1. THERE IS NO CORS MIDDLEWARE. Not a permissive one, not a restrictive one,
     none at all. Without an Access-Control-Allow-Origin header no browser
     will hand a cross-origin response back to page JavaScript.

  2. EVERY ROUTE requires X-Internal-Secret. The dependency is declared
     app-wide here and again on the router, and /health is covered by it too -
     there is no unauthenticated corner of this service to probe.

  3. THE INTERACTIVE DOCS ARE OFF (openapi_url/docs_url/redoc_url = None).
     FastAPI mounts /docs, /redoc and /openapi.json as plain Starlette routes
     that bypass app-level dependencies, so leaving them on would have left
     exactly one thing here that a browser CAN render. See routers/analyze.py
     and models.py for the schema instead.

And the fourth, enforced by what is absent rather than present: no JWT is
validated here because none is ever sent (SPEC.txt Section 5.4, Section 8 -
"Do not forward the user JWT to agent-api"). The only caller is
agent-workspace-api, over the internal boundary, with text and nothing else.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

from routers import analyze as analyze_router
from security import INTERNAL_SECRET_HEADER, require_internal_secret

BANNER = f"""
================================================================================
  agent-api  -  FastAPI  -  http://localhost:8000
--------------------------------------------------------------------------------
  INTERNAL ONLY. Not reachable from a browser, on purpose.
    * no CORS middleware is installed (no route will ever answer a browser)
    * every route, /health included, requires {INTERNAL_SECRET_HEADER}
    * missing or wrong header -> 403, compared in constant time
    * interactive docs disabled - the only browser-renderable route is gone
    * no user JWT is accepted here; no user identity crosses this boundary
  Sole legitimate caller: agent-workspace-api (:4001)
================================================================================
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Print the internal-only banner on startup."""
    print(BANNER, flush=True)
    yield


app = FastAPI(
    title="agent-api",
    description=(
        "Internal AI mock for the agent-platform scaffold. Internal only: "
        "requires X-Internal-Secret on every route, has no CORS middleware, "
        "and never receives a user JWT."
    ),
    version="0.0.0",
    lifespan=lifespan,
    # App-wide enforcement. Belt and braces with the router's own dependency:
    # a future router that forgets to declare it is still protected.
    dependencies=[Depends(require_internal_secret)],
    # See the module docstring, point 3.
    openapi_url=None,
    docs_url=None,
    redoc_url=None,
)

# NOTE: no app.add_middleware(CORSMiddleware, ...) here. Deliberate. Do not add
# one "just in case" - its absence is what the acceptance test relies on.

app.include_router(analyze_router.router)


@app.get("/health", summary="Liveness probe (also secret-protected)")
async def health() -> dict:
    """Health check.

    Secret-protected like everything else: an unauthenticated health endpoint
    would be a route a browser could reach, which is precisely the thing this
    service claims not to have.
    """
    return {
        "status": "ok",
        "service": "agent-api",
        "internal_only": True,
    }
