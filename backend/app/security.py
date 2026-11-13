"""JWT authentication and Argon2 password verification."""
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User, RevokedToken, utcnow
from uuid import uuid4

password_hasher = PasswordHasher()
auth_scheme = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return password_hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return password_hasher.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError):
        return False


def issue_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.id, "role": user.role, "iat": now, "jti": str(uuid4()),
                       "exp": now + timedelta(minutes=settings.jwt_ttl_minutes)},
                      settings.jwt_secret, algorithm="HS256")


def verify_token(db: Session, token: str) -> User | None:
    """The user a valid, unexpired, unrevoked token belongs to, else None."""
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if claims.get("jti") and db.get(RevokedToken, claims["jti"]):
            return None
        return db.get(User, claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
                 db: Session = Depends(get_db)) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = verify_token(db, credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def revoke_token(db: Session, token: str) -> None:
    """Invalidate a token server-side (sign-out). Expired or malformed tokens are ignored."""
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return
    jti = claims.get("jti")
    if jti and not db.get(RevokedToken, jti):
        db.add(RevokedToken(jti=jti, expires_at=datetime.fromtimestamp(claims["exp"], timezone.utc)))
    db.query(RevokedToken).filter(RevokedToken.expires_at < utcnow()).delete()
