from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Item, StockLedger, Forecast, Category
from app.services.stock_service import get_available_stock

# Default lead time for reorder calculations (days)
DEFAULT_LEAD_TIME_DAYS = 7
# Moving-average window (days)
MA_WINDOW_DAYS = 90
# Threshold for fast vs slow mover classification (units/day)
FAST_MOVER_THRESHOLD = 2.0


def run_forecasts(db: Session) -> int:
    """
    Demand forecasting via simple moving average over the last 90 days of OUT
    ledger entries. Writes/overwrites one Forecast row per item.
    Returns the number of items processed.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=MA_WINDOW_DAYS)

    all_items = db.query(Item).join(Category).all()
    items_processed = 0

    for item in all_items:
        # Sum of OUT quantities (stored as negative, so we abs())
        total_out = (
            db.query(func.coalesce(func.sum(func.abs(StockLedger.change_qty)), 0))
            .filter(
                StockLedger.item_id == item.id,
                StockLedger.type == "OUT",
                StockLedger.created_at >= window_start,
            )
            .scalar()
        )
        total_out = int(total_out)

        # Count distinct days with activity for a more accurate average
        active_days = (
            db.query(func.count(func.distinct(func.date(StockLedger.created_at))))
            .filter(
                StockLedger.item_id == item.id,
                StockLedger.type == "OUT",
                StockLedger.created_at >= window_start,
            )
            .scalar()
        )
        active_days = max(int(active_days or 0), 1)

        # Use the full window for averaging (not just active days) for realistic demand
        avg_daily_demand = total_out / MA_WINDOW_DAYS if total_out > 0 else 0.0

        # Available stock from ledger
        available = get_available_stock(db, item.id)

        # Days until stockout (guard divide-by-zero)
        if avg_daily_demand > 0:
            days_until_stockout = available / avg_daily_demand
        else:
            days_until_stockout = 999.0  # effectively infinite

        # Suggested reorder date
        safety_stock = avg_daily_demand * 3  # 3-day safety buffer
        reorder_trigger_stock = avg_daily_demand * DEFAULT_LEAD_TIME_DAYS + safety_stock

        if available <= reorder_trigger_stock and avg_daily_demand > 0:
            suggested_reorder_date = now.strftime("%Y-%m-%d") + " (TODAY)"
        elif avg_daily_demand > 0:
            days_to_reorder = max(0, (available - reorder_trigger_stock) / avg_daily_demand)
            reorder_date = now + timedelta(days=days_to_reorder)
            suggested_reorder_date = reorder_date.strftime("%Y-%m-%d")
        else:
            suggested_reorder_date = "N/A (no demand data)"

        # Suggested reorder quantity
        suggested_reorder_qty = max(
            item.reorder_qty,
            int(avg_daily_demand * (DEFAULT_LEAD_TIME_DAYS + 7))  # lead time + 1 week buffer
        )

        # Mover classification
        mover_class = "fast" if avg_daily_demand >= FAST_MOVER_THRESHOLD else "slow"

        # Upsert: delete existing forecast for this item, insert new
        db.query(Forecast).filter(Forecast.item_id == item.id).delete()
        forecast = Forecast(
            item_id=item.id,
            predicted_daily_demand=round(avg_daily_demand, 2),
            days_until_stockout=round(days_until_stockout, 2),
            suggested_reorder_date=suggested_reorder_date,
            suggested_reorder_qty=suggested_reorder_qty,
        )
        db.add(forecast)
        items_processed += 1

    db.commit()
    return items_processed


def get_all_forecasts(db: Session) -> list:
    """
    Return all forecast rows joined with item data, shaped for the frontend.
    """
    forecasts = db.query(Forecast).join(Item).join(Category).all()
    results = []
    for f in forecasts:
        item = f.item
        avg_daily = f.predicted_daily_demand
        mover_class = "fast" if avg_daily >= FAST_MOVER_THRESHOLD else "slow"

        results.append({
            "id": str(f.id),
            "sku": item.sku,
            "item_name": item.name,
            "category": item.category.type,
            "predicted_daily_demand": f.predicted_daily_demand,
            "days_until_stockout": f.days_until_stockout,
            "suggested_reorder_date": f.suggested_reorder_date or "N/A",
            "suggested_reorder_qty": f.suggested_reorder_qty,
            "mover_class": mover_class,
        })

    # Sort: most urgent (lowest days_until_stockout) first
    results.sort(key=lambda x: x["days_until_stockout"])
    return results
