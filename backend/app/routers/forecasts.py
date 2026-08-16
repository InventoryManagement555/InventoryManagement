from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import User, Alert, AuditLog, Item, Category
from app.schemas.schemas import ForecastRunResponse
from app.services.forecast_service import run_forecasts, get_all_forecasts
from app.services.stock_service import get_available_stock

router = APIRouter(tags=["forecasts"])


def generate_alerts(db: Session):
    """
    Scans inventory items to generate alerts for:
    - LOW_STOCK: available stock <= reorder point
    - EXPIRY_SOON: grocery items expiring within 14 days
    Prevents creating duplicate alerts if an unresolved one already exists.
    """
    items = db.query(Item).join(Category).all()
    now = datetime.now(timezone.utc)
    expiry_cutoff = now + timedelta(days=14)
    alerts_created = 0

    for item in items:
        # 1. Low Stock alert check
        avail = get_available_stock(db, item.id)
        if avail <= item.reorder_point:
            # Check if unresolved LOW_STOCK alert already exists
            existing_low = db.query(Alert).filter(
                Alert.item_id == item.id,
                Alert.type == "LOW_STOCK",
                Alert.resolved == False
            ).first()

            if not existing_low:
                new_alert = Alert(
                    item_id=item.id,
                    type="LOW_STOCK",
                    message=f"Stock running low for SKU {item.sku} ({item.name}). Available: {avail} {item.unit} (reorder point: {item.reorder_point})",
                    created_at=now
                )
                db.add(new_alert)
                alerts_created += 1

        # 2. Expiry check (grocery items only)
        if item.category.type == "grocery" and item.expiry_tracked:
            # Find closest expiring batch in stock_ledger
            from app.models.models import StockLedger
            soonest_expiring = (
                db.query(StockLedger)
                .filter(
                    StockLedger.item_id == item.id,
                    StockLedger.expiry_date.isnot(None),
                    StockLedger.expiry_date <= expiry_cutoff,
                    StockLedger.expiry_date >= now
                )
                .order_by(StockLedger.expiry_date.asc())
                .first()
            )

            if soonest_expiring:
                # Check if unresolved EXPIRY_SOON alert already exists
                existing_expiry = db.query(Alert).filter(
                    Alert.item_id == item.id,
                    Alert.type == "EXPIRY_SOON",
                    Alert.resolved == False
                ).first()

                if not existing_expiry:
                    days_left = (soonest_expiring.expiry_date.replace(tzinfo=timezone.utc) - now).days
                    new_alert = Alert(
                        item_id=item.id,
                        type="EXPIRY_SOON",
                        message=f"Grocery batch {soonest_expiring.batch_no or 'N/A'} for {item.name} is expiring on {soonest_expiring.expiry_date.strftime('%Y-%m-%d')} ({days_left} days remaining)",
                        created_at=now
                    )
                    db.add(new_alert)
                    alerts_created += 1

    db.commit()
    return alerts_created


@router.post("/forecasts/run", response_model=ForecastRunResponse)
def trigger_forecast_run(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    # Run the standard forecasts calculations
    count = run_forecasts(db)

    # Trigger persisted alert generation
    alerts_count = generate_alerts(db)

    # Log administrative action
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="FORECAST_RUN",
        entity_type="forecast",
        entity_id=None,
        detail=f"Triggered manual forecast run ({count} items processed) and generated {alerts_count} new alerts.",
    )
    db.add(audit_entry)
    db.commit()

    return ForecastRunResponse(status="completed", items_processed=count)


@router.get("/forecasts")
def list_forecasts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_forecasts(db)
