"""
OTP Signup Verification test: Verifies registration, OTP generation, OTP verification,
and login flows.

Runs inside the backend container:
    python test_otp_signup.py
"""
import sys
import os
import uuid
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import database session to fetch verification OTP directly
from app.core.database import SessionLocal
from app.models.models import User

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


def test_otp_signup_flow():
    """Attempt registration, verify OTP database code, and log in."""
    unique_email = f"test_operator_{uuid.uuid4().hex[:6]}@dmart.com"

    # 1. Register a new user details (Step 1)
    resp = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "OTP Operator Test",
        "email": unique_email,
        "password": "testpassword123",
    })
    assert resp.status_code == 200, f"Signup failed with status {resp.status_code}: {resp.text}"
    assert "Verification OTP sent" in resp.json()["detail"], "Expected signup response detail about OTP"

    # 2. Query the user record to extract the generated 6-digit OTP
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == unique_email).first()
        assert user is not None, "User record was not created in database"
        assert not user.is_verified, "User is verified immediately without OTP activation"
        
        otp = user.verification_otp
        assert otp is not None, "Verification OTP was not generated"
        assert len(otp) == 6, f"Verification OTP is not 6 digits: {otp}"

        # 3. Call the verification endpoint to verify OTP (Step 2)
        verify_resp = requests.post(f"{BASE_URL}/auth/verify-otp", json={
            "email": unique_email,
            "otp": otp
        })
        assert verify_resp.status_code == 200, f"OTP verification failed: {verify_resp.text}"

        # 4. Attempt login to verify token delivery
        login_resp = requests.post(f"{BASE_URL}/auth/login", data={
            "username": unique_email,
            "password": "testpassword123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        access_token = login_resp.json()["access_token"]
        assert access_token is not None, "No access token returned on login"

        print("=" * 60)
        print("  OTP SIGNUP VERIFICATION TEST PASSED")
        print("=" * 60)
        print(f"  Email:          {unique_email}")
        print(f"  Generated OTP:  {otp}")
        print(f"  Result:         Account activated and logged in successfully")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    try:
        test_otp_signup_flow()
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)
