from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User, Alert, AuditLog

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """View all unresolved alerts."""
    alerts = (
        db.query(Alert)
        .filter(Alert.resolved == False)
        .order_by(Alert.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(a.id),
            "item_id": str(a.item_id),
            "item_sku": a.item.sku if a.item else "N/A",
            "item_name": a.item.name if a.item else "Unknown",
            "type": a.type,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        }
        for a in alerts
    ]


@router.post("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Mark an alert resolved (admin only). Logs an audit entry."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    if alert.resolved:
         return {"detail": "Alert already resolved"}

    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)

    # Log administrative audit entry
    log_entry = AuditLog(
        user_id=current_user.id,
        action="ALERT_RESOLVED",
        entity_type="alert",
        entity_id=alert.id,
        detail=f"Resolved alert {alert.id} ({alert.type}) for item {alert.item.name if alert.item else alert.item_id}",
    )
    db.add(log_entry)
    db.commit()

    return {"detail": "Alert resolved successfully"}
