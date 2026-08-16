import os
import secrets
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr, Field

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    hash_password, verify_password, create_access_token, get_current_user,
)
from app.models.models import User
from app.schemas.schemas import UserSignup, UserResponse, TokenResponse, VerifyOTPRequest, ResendOTPRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


# Pydantic schemas for verification/recovery requests
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)


import queue
import threading

# Global thread-safe queue for background email tasks
email_queue = queue.Queue()


def _send_email_fallback(to_email: str, subject: str, body: str):
    """
    Tries to send a real email using SMTP settings.
    Falls back to writing the email details to a local text log file if SMTP is not configured.
    """
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEText(body, "html")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            # Add a strict 10-second timeout to prevent socket hangs
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Successfully sent email to {to_email}")
            return
        except Exception as e:
            logger.error(f"Failed to send SMTP email to {to_email}: {e}")

    # Fallback: Write email details to a local log file inside workspace for easy verification
    fallback_dir = "/app/scratch" if os.path.exists("/app") else "./scratch"
    os.makedirs(fallback_dir, exist_ok=True)
    fallback_file = os.path.join(fallback_dir, "sent_emails.log")
    
    with open(fallback_file, "a") as f:
        f.write("=" * 80 + "\n")
        f.write(f"TIMESTAMP: {datetime.now(timezone.utc).isoformat()}\n")
        f.write(f"TO:        {to_email}\n")
        f.write(f"SUBJECT:   {subject}\n")
        f.write(f"BODY:\n{body}\n")
        f.write("=" * 80 + "\n\n")
    logger.warning(f"SMTP is not configured. Logged email verification/recovery details to: {fallback_file}")


def _email_worker():
    """Continuous loop running in a single persistent thread, processing email queue tasks."""
    logger.info("Starting background email worker thread...")
    while True:
        try:
            to_email, subject, body = email_queue.get()
            _send_email_fallback(to_email, subject, body)
            email_queue.task_done()
        except Exception as e:
            logger.error(f"Error in background email worker: {e}")


# Start the persistent background thread immediately at module load
_worker_thread = threading.Thread(target=_email_worker)
_worker_thread.daemon = True
_worker_thread.start()


def _send_email_async(to_email: str, subject: str, body: str):
    """Pushes the email task to the global queue, returning instantly in < 1ms."""
    email_queue.put((to_email, subject, body))


@router.post("/signup")
@limiter.limit("10/minute")
def signup(request: Request, payload: UserSignup, db: Session = Depends(get_db)):
    email_lower = payload.email.strip().lower()
    # Check for existing user
    existing = db.query(User).filter(User.email == email_lower).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Generate verification OTP (6-digit number) expiring in 15 minutes
    otp = f"{secrets.randbelow(900000) + 100000}"
    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)

    user = User(
        name=payload.name,
        email=email_lower,
        password_hash=hash_password(payload.password),
        role="staff",  # SECURITY: Always staff. Admin accounts are seed/manual-DB only.
        is_verified=False,
        verification_otp=otp,
        verification_otp_expires_at=expiry,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email
    email_body = (
        f"<p>Hello {user.name},</p>"
        f"<p>Your 6-digit D-Mart Console Verification OTP is:</p>"
        f"<h2 style='letter-spacing: 5px; color: #0d9488;'>{otp}</h2>"
        f"<p>This OTP will expire in 15 minutes.</p>"
    )
    _send_email_async(user.email, "D-Mart Console: Verification OTP", email_body)

    return {"detail": "Verification OTP sent. Please check your email to complete registration."}


@router.post("/verify-otp")
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    email_lower = payload.email.strip().lower()
    user = db.query(User).filter(
        User.email == email_lower,
        User.is_verified == False
    ).first()

    if not user or user.verification_otp != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification OTP",
        )

    now = datetime.now(timezone.utc)
    if user.verification_otp_expires_at and user.verification_otp_expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification OTP has expired",
        )

    user.is_verified = True
    user.verification_otp = None
    user.verification_otp_expires_at = None
    db.commit()

    return {"detail": "Email verified successfully. You can now log in."}


@router.post("/resend-otp")
def resend_otp(payload: ResendOTPRequest, db: Session = Depends(get_db)):
    email_lower = payload.email.strip().lower()
    user = db.query(User).filter(
        User.email == email_lower,
        User.is_verified == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or already verified",
        )

    otp = f"{secrets.randbelow(900000) + 100000}"
    expiry = datetime.now(timezone.utc) + timedelta(minutes=15)

    user.verification_otp = otp
    user.verification_otp_expires_at = expiry
    db.commit()

    # Send verification email
    email_body = (
        f"<p>Hello {user.name},</p>"
        f"<p>Your new 6-digit D-Mart Console Verification OTP is:</p>"
        f"<h2 style='letter-spacing: 5px; color: #0d9488;'>{otp}</h2>"
        f"<p>This OTP will expire in 15 minutes.</p>"
    )
    _send_email_async(user.email, "D-Mart Console: Verification OTP", email_body)

    return {"detail": "Verification OTP has been resent."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("15/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 password flow: accepts form-urlencoded username + password.
    The frontend sends the user's email as the 'username' field.
    """
    email_lower = form_data.username.strip().lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # SECURITY Policy (a): Block login if email is not verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email address before logging in.",
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Anti-enumeration recovery: always returns the same success message
    regardless of whether the email address exists in the database.
    """
    email_lower = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_lower).first()
    if user:
        token = secrets.token_urlsafe(32)
        expiry = datetime.now(timezone.utc) + timedelta(hours=1)

        user.reset_token = token
        user.reset_token_expires_at = expiry
        db.commit()

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        email_body = (
            f"<p>Hello {user.name},</p>"
            f"<p>A password reset request has been received. Click the link below to recover your access key:</p>"
            f"<p><a href='{reset_link}'>{reset_link}</a></p>"
            f"<p>This link will expire in 1 hour. If you did not make this request, please ignore this email.</p>"
        )
        _send_email_async(user.email, "D-Mart Console: Reset Access Key", email_body)

    return {"detail": "If the account exists, a password reset link has been dispatched to the email."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    now = datetime.now(timezone.utc)
    if user.reset_token_expires_at and user.reset_token_expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired",
        )

    # Invalidate token and update password
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()

    return {"detail": "Password has been successfully updated. You can now log in."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_orm_user(current_user)
