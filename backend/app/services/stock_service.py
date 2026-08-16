import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.models import StockLedger, Item
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


def invalidate_stock_cache(item_id: int):
    """Deletes the stock cache key for the given item."""
    if redis_client:
        try:
            cache_key = f"stock:{item_id}"
            redis_client.delete(cache_key)
            logger.debug(f"Invalidated Redis cache for key: {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to invalidate Redis cache for item {item_id}: {e}")


def get_available_stock(db: Session, item_id: int) -> int:
    """
    Core function: available stock is ALWAYS derived as SUM(change_qty) from
    the stock_ledger for this item. Never stored directly.
    Stock level is cached in Redis for fast lookups.
    """
    cache_key = f"stock:{item_id}"
    if redis_client:
        try:
            cached_val = redis_client.get(cache_key)
            if cached_val is not None:
                logger.debug(f"Cache hit: {cache_key} = {cached_val}")
                return int(cached_val)
        except Exception as e:
            logger.warning(f"Failed to fetch stock from Redis cache: {e}")

    # Fallback to database query
    result = db.query(func.coalesce(func.sum(StockLedger.change_qty), 0)).filter(
        StockLedger.item_id == item_id
    ).scalar()
    val = int(result)

    # Save to cache
    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, str(val))  # cache for 1 hour
            logger.debug(f"Cached stock value: {cache_key} = {val}")
        except Exception as e:
            logger.warning(f"Failed to save stock to Redis cache: {e}")

    return val


def stock_in(db: Session, item_id: int, qty: int, note: str, user_id: int) -> StockLedger:
    """Insert a positive stock-in ledger entry."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    entry = StockLedger(
        item_id=item_id,
        change_qty=abs(qty),  # always positive for IN
        type="IN",
        reference_note=note or "",
        created_by=user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # Invalidate cache on write
    invalidate_stock_cache(item_id)
    
    return entry


def stock_out(db: Session, item_id: int, qty: int, note: str, user_id: int) -> StockLedger:
    """
    Insert a negative stock-out ledger entry.
    MUST validate that qty <= current available stock.
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    available = get_available_stock(db, item_id)
    if qty > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {available}, requested: {qty}",
        )

    entry = StockLedger(
        item_id=item_id,
        change_qty=-abs(qty),  # always negative for OUT
        type="OUT",
        reference_note=note or "",
        created_by=user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    # Invalidate cache on write
    invalidate_stock_cache(item_id)
    
    return entry
