"""Routers for agent-api.

Every router in this package must be mounted with the require_internal_secret
dependency. main.py also declares it app-wide, so the two layers agree even if
a future router forgets it.
"""

from . import analyze

__all__ = ["analyze"]
