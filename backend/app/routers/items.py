from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.models import Item, Category, User, AuditLog
from app.schemas.schemas import ItemCreate, ItemResponse
from app.services.stock_service import get_available_stock

router = APIRouter(tags=["items"])


def _item_to_response(item: Item, db: Session) -> ItemResponse:
    """Convert an Item ORM object to the flat response the frontend expects."""
    avail = get_available_stock(db, item.id)
    cat_type = item.category.type if item.category else "unknown"

    # Warranty: stored as months int, returned as string like "3 years"
    warranty_str = None
    if item.warranty_months:
        if item.warranty_months >= 12:
            years = item.warranty_months // 12
            warranty_str = f"{years} year{'s' if years > 1 else ''}"
        else:
            warranty_str = f"{item.warranty_months} months"

    # Batch/expiry: pull the latest ledger entry with batch info
    batch_no = None
    expiry_date = None
    if cat_type == "grocery":
        from app.models.models import StockLedger
        latest = (
            db.query(StockLedger)
            .filter(
                StockLedger.item_id == item.id,
                StockLedger.batch_no.isnot(None),
            )
            .order_by(StockLedger.created_at.desc())
            .first()
        )
        if latest:
            batch_no = latest.batch_no
            expiry_date = latest.expiry_date.strftime("%Y-%m-%d") if latest.expiry_date else None

    return ItemResponse(
        id=str(item.id),
        sku=item.sku,
        name=item.name,
        category=cat_type,
        unit=item.unit,
        unit_price=float(item.unit_price),
        reorder_point=item.reorder_point,
        reorder_qty=item.reorder_qty,
        available_stock=avail,
        dimensions=item.dimensions,
        material=item.material,
        warranty=warranty_str,
        batch_no=batch_no,
        expiry_date=expiry_date,
        perishable=item.perishable,
    )


@router.get("/items", response_model=list[ItemResponse])
def list_items(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Item).join(Category)

    if category and category in ("furniture", "grocery"):
        query = query.filter(Category.type == category)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Item.name.ilike(search_term)) | (Item.sku.ilike(search_term))
        )

    items = query.order_by(Item.name).all()
    return [_item_to_response(item, db) for item in items]


@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return _item_to_response(item, db)


@router.post("/items", response_model=ItemResponse)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    # Check SKU uniqueness
    existing = db.query(Item).filter(Item.sku == payload.sku).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SKU '{payload.sku}' already exists",
        )

    # Resolve category by type string
    category = db.query(Category).filter(Category.type == payload.category).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category type: {payload.category}",
        )

    # Parse warranty string to months
    warranty_months = None
    if payload.warranty:
        import re
        match = re.search(r"(\d+)", payload.warranty)
        if match:
            num = int(match.group(1))
            if "year" in payload.warranty.lower():
                warranty_months = num * 12
            else:
                warranty_months = num

    item = Item(
        sku=payload.sku,
        name=payload.name,
        category_id=category.id,
        unit=payload.unit,
        unit_price=payload.unit_price,
        reorder_point=payload.reorder_point,
        reorder_qty=payload.reorder_qty,
        dimensions=payload.dimensions,
        material=payload.material,
        warranty_months=warranty_months,
        perishable=payload.perishable,
        expiry_tracked=payload.perishable or False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # If grocery with batch/expiry, create initial ledger entry
    if payload.category == "grocery" and payload.batch_no:
        from app.models.models import StockLedger
        from datetime import datetime
        expiry_dt = None
        if payload.expiry_date:
            try:
                expiry_dt = datetime.strptime(payload.expiry_date, "%Y-%m-%d")
            except ValueError:
                pass
        entry = StockLedger(
            item_id=item.id,
            change_qty=0,
            type="ADJUST",
            reference_note=f"Initial batch registration: {payload.batch_no}",
            batch_no=payload.batch_no,
            expiry_date=expiry_dt,
            created_by=current_user.id,
        )
        db.add(entry)
        db.commit()

    # Log administrative action
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="ITEM_CREATED",
        entity_type="item",
        entity_id=item.id,
        detail=f"Created new item {item.name} ({item.sku}) in category {payload.category}.",
    )
    db.add(audit_entry)
    db.commit()

    return _item_to_response(item, db)


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    category = db.query(Category).filter(Category.type == payload.category).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown category type: {payload.category}",
        )

    # Parse warranty string to months
    warranty_months = None
    if payload.warranty:
        import re
        match = re.search(r"(\d+)", payload.warranty)
        if match:
            num = int(match.group(1))
            if "year" in payload.warranty.lower():
                warranty_months = num * 12
            else:
                warranty_months = num

    item.sku = payload.sku
    item.name = payload.name
    item.category_id = category.id
    item.unit = payload.unit
    item.unit_price = payload.unit_price
    item.reorder_point = payload.reorder_point
    item.reorder_qty = payload.reorder_qty
    item.dimensions = payload.dimensions
    item.material = payload.material
    item.warranty_months = warranty_months
    item.perishable = payload.perishable
    item.expiry_tracked = payload.perishable or False

    db.commit()

    # Log administrative action
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="ITEM_UPDATED",
        entity_type="item",
        entity_id=item.id,
        detail=f"Updated item {item.name} ({item.sku}).",
    )
    db.add(audit_entry)
    db.commit()

    return _item_to_response(item, db)
