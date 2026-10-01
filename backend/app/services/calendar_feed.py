import hashlib
import re
import secrets

from firebase_admin import firestore

from app.auth import _firebase_app

TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def _client(project_id: str):
    return firestore.client(app=_firebase_app(project_id))


def ensure_subscription_token(uid: str, project_id: str) -> str:
    database = _client(project_id)
    private_ref = (
        database.collection("users").document(uid).collection("private").document("calendarFeed")
    )
    private = private_ref.get()
    if private.exists:
        token = (private.to_dict() or {}).get("token")
        if isinstance(token, str) and TOKEN_PATTERN.fullmatch(token):
            return token

    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    batch = database.batch()
    batch.set(private_ref, {"token": token})
    batch.set(database.collection("calendarFeeds").document(digest), {"uid": uid})
    batch.commit()
    return token


def events_for_subscription(token: str, project_id: str) -> tuple[list[dict], str] | None:
    if not TOKEN_PATTERN.fullmatch(token):
        return None
    database = _client(project_id)
    digest = hashlib.sha256(token.encode()).hexdigest()
    mapping = database.collection("calendarFeeds").document(digest).get()
    if not mapping.exists:
        return None
    uid = (mapping.to_dict() or {}).get("uid")
    if not isinstance(uid, str) or not uid:
        return None
    events = [
        {"id": document.id, **document.to_dict()}
        for document in database.collection("users").document(uid).collection("events").stream()
    ]
    profile = database.collection("users").document(uid).get()
    timezone = (profile.to_dict() or {}).get("timezone") if profile.exists else None
    return events, timezone if isinstance(timezone, str) else "UTC"


def reset_subscription_token(uid: str, project_id: str) -> str:
    database = _client(project_id)
    private_ref = (
        database.collection("users").document(uid).collection("private").document("calendarFeed")
    )
    previous = private_ref.get()
    old_token = (previous.to_dict() or {}).get("token") if previous.exists else None
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode()).hexdigest()
    batch = database.batch()
    if isinstance(old_token, str) and TOKEN_PATTERN.fullmatch(old_token):
        old_digest = hashlib.sha256(old_token.encode()).hexdigest()
        batch.delete(database.collection("calendarFeeds").document(old_digest))
    batch.set(private_ref, {"token": token})
    batch.set(database.collection("calendarFeeds").document(digest), {"uid": uid})
    batch.commit()
    return token
