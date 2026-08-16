from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.models import User, AuditLog

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("")
def get_audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Retrieve paginated admin audit logs (admin only)."""
    logs = (
        db.query(AuditLog)
        .join(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    total = db.query(AuditLog).count()

    return {
        "total": total,
        "logs": [
            {
                "id": str(log.id),
                "operator_name": log.user.name if log.user else "System",
                "operator_email": log.user.email if log.user else "system@dmart.com",
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else "",
                "detail": log.detail or "",
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
            for log in logs
        ]
    }
