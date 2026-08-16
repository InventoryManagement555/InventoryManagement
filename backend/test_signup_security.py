"""
Security test: Verifies that POST /auth/signup with {"role": "admin"} in the body
still results in a 'staff' user being created.

Runs inside the backend container:
    python test_signup_security.py
"""
import sys
import os
import uuid
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import database session to fetch verification token
from app.core.database import SessionLocal
from app.models.models import User

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


def test_signup_ignores_role():
    """Attempt to signup with role=admin and verify the created user is staff."""
    unique_email = f"test_{uuid.uuid4().hex[:8]}@exploit.com"

    # 1. Signup with role=admin in the payload (the vulnerability we're testing)
    resp = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Privilege Escalation Test",
        "email": unique_email,
        "password": "testpass123",
        "role": "admin",  # This should be IGNORED by the server
    })
    assert resp.status_code == 200, f"Signup failed with status {resp.status_code}: {resp.text}"

    # 2. Query the user from DB to verify verification token is generated
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == unique_email).first()
        assert user is not None, "User record was not created in database"
        assert not user.is_verified, "User is verified immediately without email activation"
        
        token = user.verification_token
        assert token is not None, "Verification token was not generated"

        # 3. Call the verification route to activate the account
        verify_resp = requests.get(f"{BASE_URL}/auth/verify-email?token={token}")
        assert verify_resp.status_code == 200, f"Email verification failed: {verify_resp.text}"

        # 4. Now login to get the access token
        login_resp = requests.post(f"{BASE_URL}/auth/login", data={
            "username": unique_email,
            "password": "testpass123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        access_token = login_resp.json()["access_token"]

        # 5. Fetch profile and verify role is staff, NOT admin
        me_resp = requests.get(f"{BASE_URL}/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        assert me_resp.status_code == 200, f"GET /me failed: {me_resp.text}"
        user_data = me_resp.json()

        actual_role = user_data["role"]
        assert actual_role == "staff", (
            f"SECURITY FAILURE: User was created with role='{actual_role}' instead of 'staff'. "
            f"The privilege escalation vulnerability is still present!"
        )

        print("=" * 60)
        print("  SECURITY TEST PASSED")
        print("=" * 60)
        print(f"  Email:          {unique_email}")
        print(f"  Requested role: admin")
        print(f"  Actual role:    {actual_role}")
        print(f"  Result:         Client-supplied role was correctly IGNORED")
        print("=" * 60)
    finally:
        db.close()


if __name__ == "__main__":
    try:
        test_signup_ignores_role()
    except AssertionError as e:
        print(f"\n[FAIL] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)
