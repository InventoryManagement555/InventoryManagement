from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    """Never includes password_hash."""
    id: str
    name: str
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_user(cls, user) -> "UserResponse":
        return cls(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
class ItemCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., pattern="^(furniture|grocery)$")
    unit: str = Field(..., min_length=1, max_length=50)
    unit_price: float = Field(..., gt=0)
    reorder_point: int = Field(default=0, ge=0)
    reorder_qty: int = Field(default=0, ge=0)
    # Furniture-specific
    dimensions: Optional[str] = None
    material: Optional[str] = None
    warranty: Optional[str] = None  # frontend sends "3 years", we'll parse or store
    # Grocery-specific
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    perishable: Optional[bool] = None


class ItemResponse(BaseModel):
    id: str
    sku: str
    name: str
    category: str  # "furniture" | "grocery" — flattened from category.type
    unit: str
    unit_price: float
    reorder_point: int
    reorder_qty: int
    available_stock: int  # computed from ledger
    # Furniture
    dimensions: Optional[str] = None
    material: Optional[str] = None
    warranty: Optional[str] = None
    # Grocery
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    perishable: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------
class StockAction(BaseModel):
    item_id: str = Field(...)
    qty: int = Field(..., gt=0)
    note: Optional[str] = None


class StockActionResponse(BaseModel):
    id: str
    item_id: str
    change_qty: int
    type: str
    reference_note: Optional[str] = None
    available_stock: int
    created_at: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class LowStockItem(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    available_stock: int
    reorder_point: int
    unit: str


class ExpiringSoonItem(BaseModel):
    id: str
    sku: str
    name: str
    batch_no: str
    expiry_date: str
    available_stock: int
    unit: str


class TopMover(BaseModel):
    name: str
    sales_qty: int
    stock_value: float


class DashboardSummary(BaseModel):
    total_stock_value: float
    total_items: int
    items_by_category: dict  # {"furniture": N, "grocery": N}
    low_stock_list: List[LowStockItem]
    expiring_soon_list: List[ExpiringSoonItem]
    top_movers: List[TopMover]


# ---------------------------------------------------------------------------
# Forecasts
# ---------------------------------------------------------------------------
class ForecastResponse(BaseModel):
    id: str
    sku: str
    item_name: str
    category: str
    predicted_daily_demand: float
    days_until_stockout: float
    suggested_reorder_date: str
    suggested_reorder_qty: int
    mover_class: str  # 'fast' | 'slow'

    model_config = ConfigDict(from_attributes=True)


class ForecastRunResponse(BaseModel):
    status: str
    items_processed: int


# ---------------------------------------------------------------------------
# Assistant
# ---------------------------------------------------------------------------
class AssistantAsk(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class AssistantResponse(BaseModel):
    answer: str


# ---------------------------------------------------------------------------
# OTP Verification
# ---------------------------------------------------------------------------
class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class ResendOTPRequest(BaseModel):
    email: EmailStr
