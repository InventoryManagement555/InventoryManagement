from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Index, Numeric
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="staff")  # 'admin' | 'staff'
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Email verification fields
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_otp = Column(String(10), nullable=True)
    verification_otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Password reset fields
    reset_token = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    audit_logs = relationship("AuditLog", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False)  # 'furniture' | 'grocery'

    items = relationship("Item", back_populates="category")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    unit = Column(String(50), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    reorder_point = Column(Integer, nullable=False, default=0)
    reorder_qty = Column(Integer, nullable=False, default=0)

    # Furniture-specific (nullable)
    dimensions = Column(String(100), nullable=True)
    material = Column(String(100), nullable=True)
    warranty_months = Column(Integer, nullable=True)

    # Grocery-specific (nullable)
    expiry_tracked = Column(Boolean, nullable=True, default=False)
    perishable = Column(Boolean, nullable=True, default=False)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    category = relationship("Category", back_populates="items")
    ledger_entries = relationship("StockLedger", back_populates="item")
    forecasts = relationship("Forecast", back_populates="item")
    alerts = relationship("Alert", back_populates="item")


class StockLedger(Base):
    __tablename__ = "stock_ledger"
    __table_args__ = (
        Index("ix_stock_ledger_item_created", "item_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    change_qty = Column(Integer, nullable=False)  # positive for IN, negative for OUT
    type = Column(String(10), nullable=False)  # 'IN' | 'OUT' | 'ADJUST'
    reference_note = Column(Text, nullable=True)
    batch_no = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    item = relationship("Item", back_populates="ledger_entries")
    user = relationship("User")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    items = relationship("SaleItem", back_populates="sale")
    user = relationship("User")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    qty = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    item = relationship("Item")


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    predicted_daily_demand = Column(Float, nullable=False, default=0.0)
    days_until_stockout = Column(Float, nullable=False, default=0.0)
    suggested_reorder_date = Column(String(50), nullable=True)
    suggested_reorder_qty = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    item = relationship("Item", back_populates="forecasts")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # 'LOW_STOCK' | 'EXPIRY_SOON'
    message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    item = relationship("Item", back_populates="alerts")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'ITEM_CREATED' | 'ITEM_UPDATED' | 'FORECAST_RUN' | 'ALERT_RESOLVED'
    entity_type = Column(String(50), nullable=False)  # 'item' | 'forecast' | 'alert'
    entity_id = Column(Integer, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="audit_logs")
