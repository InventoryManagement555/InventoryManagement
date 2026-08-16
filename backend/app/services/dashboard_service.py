from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.models import Item, StockLedger, Category
from app.services.stock_service import get_available_stock
from app.schemas.schemas import (
    DashboardSummary, LowStockItem, ExpiringSoonItem, TopMover,
)


def get_dashboard_summary(db: Session) -> DashboardSummary:
    """Compute the full dashboard summary in a single service call."""

    # ---- Total items ----
    total_items = db.query(func.count(Item.id)).scalar() or 0

    # ---- Items by category ----
    cat_counts = (
        db.query(Category.type, func.count(Item.id))
        .join(Item, Item.category_id == Category.id)
        .group_by(Category.type)
        .all()
    )
    items_by_category = {"furniture": 0, "grocery": 0}
    for cat_type, count in cat_counts:
        items_by_category[cat_type] = count

    # ---- Compute available stock for all items ----
    items_with_stock = []
    all_items = db.query(Item).join(Category).all()
    total_stock_value = 0.0

    for item in all_items:
        avail = get_available_stock(db, item.id)
        total_stock_value += float(item.unit_price) * avail
        items_with_stock.append((item, avail))

    # ---- Low stock list (below reorder_point) ----
    low_stock_list: List[LowStockItem] = []
    for item, avail in items_with_stock:
        if avail <= item.reorder_point:
            low_stock_list.append(LowStockItem(
                id=str(item.id),
                sku=item.sku,
                name=item.name,
                category=item.category.type,
                available_stock=avail,
                reorder_point=item.reorder_point,
                unit=item.unit,
            ))

    # ---- Expiring soon (grocery items with ledger entries that have expiry_date within 14 days) ----
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=14)
    expiring_entries = (
        db.query(StockLedger)
        .join(Item)
        .join(Category)
        .filter(
            Category.type == "grocery",
            StockLedger.expiry_date.isnot(None),
            StockLedger.expiry_date <= cutoff,
            StockLedger.expiry_date >= now,
        )
        .order_by(StockLedger.expiry_date.asc())
        .all()
    )

    seen_items = set()
    expiring_soon_list: List[ExpiringSoonItem] = []
    for entry in expiring_entries:
        if entry.item_id in seen_items:
            continue
        seen_items.add(entry.item_id)
        item = entry.item
        avail = get_available_stock(db, item.id)
        expiring_soon_list.append(ExpiringSoonItem(
            id=str(item.id),
            sku=item.sku,
            name=item.name,
            batch_no=entry.batch_no or "N/A",
            expiry_date=entry.expiry_date.strftime("%Y-%m-%d") if entry.expiry_date else "N/A",
            available_stock=avail,
            unit=item.unit,
        ))

    # ---- Top movers (items with highest total OUT volume in last 90 days) ----
    ninety_days_ago = now - timedelta(days=90)
    top_movers_data = (
        db.query(
            Item.name,
            func.coalesce(func.sum(func.abs(StockLedger.change_qty)), 0).label("sales_qty"),
        )
        .join(StockLedger, StockLedger.item_id == Item.id)
        .filter(
            StockLedger.type == "OUT",
            StockLedger.created_at >= ninety_days_ago,
        )
        .group_by(Item.id, Item.name)
        .order_by(func.sum(func.abs(StockLedger.change_qty)).desc())
        .limit(10)
        .all()
    )

    top_movers: List[TopMover] = []
    for name, sales_qty in top_movers_data:
        # Get item's unit price for stock value
        item = db.query(Item).filter(Item.name == name).first()
        stock_value = float(item.unit_price) * int(sales_qty) if item else 0.0
        top_movers.append(TopMover(
            name=name,
            sales_qty=int(sales_qty),
            stock_value=round(stock_value, 2),
        ))

    return DashboardSummary(
        total_stock_value=round(total_stock_value, 2),
        total_items=total_items,
        items_by_category=items_by_category,
        low_stock_list=low_stock_list,
        expiring_soon_list=expiring_soon_list,
        top_movers=top_movers,
    )
