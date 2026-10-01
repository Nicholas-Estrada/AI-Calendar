from typing import Any

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from google.auth.credentials import AnonymousCredentials

from app.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


def _firebase_app(project_id: str) -> firebase_admin.App:
    try:
        return firebase_admin.get_app(project_id)
    except ValueError:
        return firebase_admin.initialize_app(
            options={"projectId": project_id},
            name=project_id,
        )


def _firebase_verifier_app(project_id: str) -> firebase_admin.App:
    """Verify signed Firebase tokens without requiring server write credentials."""
    name = f"{project_id}-verifier"
    try:
        return firebase_admin.get_app(name)
    except ValueError:
        return firebase_admin.initialize_app(
            credential=AnonymousCredentials(),
            options={"projectId": project_id},
            name=name,
        )


def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if not settings.firebase_auth_required:
        return {"uid": "local-development"}

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in before using the AI Calendar API.",
        )

    try:
        decoded_token = auth.verify_id_token(
            credentials.credentials,
            app=_firebase_verifier_app(settings.firebase_project_id),
        )
    except (FirebaseError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your sign-in session is invalid or has expired.",
        ) from error

    return decoded_token
