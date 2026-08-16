from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, StockLedger, Item
from app.schemas.schemas import StockAction, StockActionResponse
from app.services.stock_service import stock_in, stock_out, get_available_stock

router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("/my-activity")
def get_my_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the current user's own recent stock ledger entries (max 20).
    Scoped to created_by = current_user.id — no other user's data exposed.
    """
    entries = (
        db.query(StockLedger)
        .join(Item, StockLedger.item_id == Item.id)
        .filter(StockLedger.created_by == current_user.id)
        .order_by(StockLedger.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": str(e.id),
            "item_id": str(e.item_id),
            "item_name": e.item.name if e.item else "Unknown",
            "item_sku": e.item.sku if e.item else "N/A",
            "change_qty": e.change_qty,
            "type": e.type,
            "reference_note": e.reference_note or "",
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in entries
    ]


@router.post("/in", response_model=StockActionResponse)
def do_stock_in(
    payload: StockAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = stock_in(
        db=db,
        item_id=int(payload.item_id),
        qty=payload.qty,
        note=payload.note or "",
        user_id=current_user.id,
    )
    avail = get_available_stock(db, int(payload.item_id))
    return StockActionResponse(
        id=str(entry.id),
        item_id=str(entry.item_id),
        change_qty=entry.change_qty,
        type=entry.type,
        reference_note=entry.reference_note,
        available_stock=avail,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
    )


@router.post("/out", response_model=StockActionResponse)
def do_stock_out(
    payload: StockAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = stock_out(
        db=db,
        item_id=int(payload.item_id),
        qty=payload.qty,
        note=payload.note or "",
        user_id=current_user.id,
    )
    avail = get_available_stock(db, int(payload.item_id))
    return StockActionResponse(
        id=str(entry.id),
        item_id=str(entry.item_id),
        change_qty=entry.change_qty,
        type=entry.type,
        reference_note=entry.reference_note,
        available_stock=avail,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
    )
