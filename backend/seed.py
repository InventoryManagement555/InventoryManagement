"""
Seed script: populates the database with demo-ready data.

Wipes the database and recreates tables to allow clean re-runs.
Creates:
- 2 users (1 admin, 1 staff) with known credentials
- 2 categories (furniture, grocery)
- 120 items (~35% furniture, ~65% grocery)
- ~11,000 days of stock ledger history per item using bulk inserts
- Computes initial forecasting recommendations
- Wipes the Redis cache

Usage:
    python seed.py
"""

import os
import sys
import random
from datetime import datetime, timedelta, timezone

# Add parent dir to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, SessionLocal, Base
from app.core.security import hash_password
from app.models.models import User, Category, Item, StockLedger, Forecast
from app.core.redis import redis_client

# Programmatic data generators
furniture_adjectives = ["Ergonomic", "Modern", "Classic", "Vintage", "Industrial", "Minimalist", "Rustic", "Luxury", "Nordic", "Solid"]
furniture_materials = ["Oak Wood", "Teak Wood", "Steel Frame", "Aluminum Accent", "Velvet Fabric", "Genuine Leather", "Pine Wood", "Tempered Glass", "Bamboo Frame", "MDF Board"]
furniture_types = [
    ("Office Chair", "pcs", 80, 180, 60, 60, 100),
    ("Dining Table", "pcs", 350, 750, 180, 90, 75),
    ("Office Desk", "pcs", 120, 399, 120, 60, 75),
    ("Velvet Sofa", "pcs", 450, 1100, 200, 95, 85),
    ("Platform Bed", "pcs", 250, 550, 200, 160, 40),
    ("Bookshelf", "pcs", 80, 220, 80, 30, 180),
    ("Console Cabinet", "pcs", 130, 320, 140, 40, 60),
    ("Wardrobe", "pcs", 380, 850, 150, 60, 200),
]

grocery_adjectives = ["Organic", "Premium", "Fresh", "Natural", "Sweet", "Salted", "Low-Fat", "Pure", "Traditional", "Gourmet"]
grocery_types = [
    ("Whole Milk 1L", "cartons", 1.99, 3.49, True, True),
    ("Greek Yogurt 500g", "tubs", 2.99, 4.99, True, True),
    ("Sliced Bread", "loaves", 1.99, 3.99, True, True),
    ("Basmati Rice 5kg", "bags", 10.99, 18.99, False, True),
    ("Penne Pasta 500g", "packs", 0.99, 2.49, False, True),
    ("Extra Virgin Olive Oil 1L", "bottles", 7.99, 14.99, False, True),
    ("Free Range Eggs (12 pack)", "packs", 3.49, 5.99, True, True),
    ("Chicken Breast 1kg", "packs", 8.99, 13.99, True, True),
    ("Bananas 1kg", "bunches", 1.49, 2.49, True, True),
    ("Gala Apples 1kg", "bags", 2.99, 4.49, True, True),
    ("Vine Tomatoes 500g", "packs", 1.99, 3.49, True, True),
    ("Cheddar Cheese 400g", "blocks", 4.99, 7.99, True, True),
    ("Coffee Beans 1kg", "bags", 9.99, 16.99, False, True),
    ("Breakfast Tea (80 bags)", "boxes", 3.49, 5.99, False, True),
    ("Orange Juice 1L", "bottles", 2.49, 4.49, True, True),
    ("Raw Honey 500g", "jars", 6.99, 12.99, False, True),
    ("Mixed Nuts 500g", "bags", 5.99, 9.99, False, True),
    ("Granola Cereal 750g", "boxes", 3.99, 6.99, False, True),
    ("Ground Turmeric 100g", "jars", 2.99, 4.99, False, True),
    ("Unsalted Butter 250g", "packs", 2.49, 4.49, True, True),
    ("All Purpose Flour 2kg", "bags", 1.99, 3.49, False, True),
    ("Cane Sugar 1kg", "bags", 2.29, 3.99, False, True),
    ("Himalayan Salt 500g", "jars", 3.49, 5.99, False, True),
    ("Spring Water 6-Pack 1.5L", "packs", 2.99, 4.99, False, False),
    ("Sparkling Soda 330ml (6)", "packs", 3.99, 5.99, False, False),
]

def seed():
    # 0. Flush Redis
    if redis_client:
        try:
            redis_client.flushdb()
            print("Flushed Redis cache successfully.")
        except Exception as e:
            print(f"Failed to flush Redis cache: {e}")

    # Drop and recreate tables for clean Postgres seeding
    print("Dropping existing PostgreSQL tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        print("=" * 60)
        print("  D-MART INVENTORY SYSTEM — DATABASE SEED (100+ ITEMS)")
        print("=" * 60)

        # ---- USERS ----
        admin = User(
            name="Admin Manager",
            email="admin@dmart.com",
            password_hash=hash_password("admin123"),
            role="admin",
            is_verified=True,
        )
        staff = User(
            name="Staff Operator",
            email="staff@dmart.com",
            password_hash=hash_password("staff123"),
            role="staff",
            is_verified=True,
        )
        db.add_all([admin, staff])
        db.commit()
        db.refresh(admin)
        db.refresh(staff)

        print("\n[USERS CREATED]")
        print("  Admin: admin@dmart.com / admin123  (role: admin)")
        print("  Staff: staff@dmart.com / staff123  (role: staff)")

        # ---- CATEGORIES ----
        cat_furniture = Category(name="Furniture", type="furniture")
        cat_grocery = Category(name="Grocery", type="grocery")
        db.add_all([cat_furniture, cat_grocery])
        db.commit()
        db.refresh(cat_furniture)
        db.refresh(cat_grocery)

        print("\n[CATEGORIES CREATED]: Furniture, Grocery")

        # ---- ITEMS PROGRAMMATIC GENERATION ----
        # Generate 42 Furniture (35%) and 78 Grocery (65%) = 120 Items
        print("\nGenerating 120 unique items...")
        generated_items = []
        
        # Seed generator to ensure deterministic names/SKUs
        random.seed(42)

        # Furniture (42 items)
        for i in range(1, 43):
            f_type, unit, min_p, max_p, w, d, h = random.choice(furniture_types)
            adj = random.choice(furniture_adjectives)
            mat = random.choice(furniture_materials)
            name = f"{adj} {mat} {f_type}"
            sku = f"FUR-{f_type[:3].upper()}-{i:03d}"
            price = round(random.uniform(min_p, max_p), 2)
            reorder_pt = random.choice([2, 3, 5, 8, 10])
            reorder_qy = reorder_pt * random.choice([2, 3, 4])
            
            # Select random velocity class
            # A: Fast, B: Medium, C: Slow, D: Zero Sales
            vel_class = random.choices(["A", "B", "C", "D"], weights=[0.20, 0.50, 0.20, 0.10])[0]

            item = Item(
                sku=sku,
                name=name,
                category_id=cat_furniture.id,
                unit=unit,
                unit_price=price,
                reorder_point=reorder_pt,
                reorder_qty=reorder_qy,
                dimensions=f"{w}x{d}x{h} cm",
                material=mat,
                warranty_months=random.choice([6, 12, 24, 36, 60]),
                perishable=False,
                expiry_tracked=False
            )
            db.add(item)
            generated_items.append((item, vel_class, "furniture", {}))

        # Grocery (78 items)
        for i in range(1, 79):
            g_name, unit, min_p, max_p, perishable, expiry_tracked = random.choice(grocery_types)
            adj = random.choice(grocery_adjectives)
            name = f"{adj} {g_name}"
            sku = f"GRO-{g_name[:3].upper()}-{i:03d}"
            price = round(random.uniform(min_p, max_p), 2)
            reorder_pt = random.choice([10, 15, 20, 25, 30, 40])
            reorder_qy = reorder_pt * random.choice([2, 3, 4])
            vel_class = random.choices(["A", "B", "C", "D"], weights=[0.20, 0.50, 0.20, 0.10])[0]

            item = Item(
                sku=sku,
                name=name,
                category_id=cat_grocery.id,
                unit=unit,
                unit_price=price,
                reorder_point=reorder_pt,
                reorder_qty=reorder_qy,
                perishable=perishable,
                expiry_tracked=expiry_tracked
            )
            db.add(item)
            generated_items.append((item, vel_class, "grocery", {
                "perishable": perishable,
                "expiry_tracked": expiry_tracked,
                "sku_prefix": g_name[:3].upper()
            }))

        db.commit()

        # Refresh all generated items to fetch database IDs
        all_items_with_ids = []
        for item, vel_class, cat, extra in generated_items:
            db.refresh(item)
            all_items_with_ids.append((item, vel_class, cat, extra))

        print(f"[ITEMS CREATED]: 120 total (42 furniture, 78 grocery)")

        # ---- STOCK LEDGER TRANSACTION HISTORY ----
        print("\n[LEDGER HISTORY] Generating 90 days of transactions (target 10k-14k rows)...")
        now = datetime.now(timezone.utc)
        
        ledger_mappings = []
        batch_counter = 0

        for item, vel_class, cat, extra in all_items_with_ids:
            running_stock = 0

            # 1. Bootstrap: create initial restock on Day 90
            bootstrap_date = now - timedelta(days=90)
            initial_qty = item.reorder_qty * random.choice([2, 3])
            
            batch_no = None
            expiry_date = None
            if cat == "grocery" and extra.get("expiry_tracked"):
                batch_counter += 1
                batch_no = f"B-{extra['sku_prefix']}-{batch_counter:05d}"
                if extra.get("perishable"):
                    expiry_date = bootstrap_date + timedelta(days=random.randint(5, 20))
                else:
                    expiry_date = bootstrap_date + timedelta(days=random.randint(60, 200))

            ledger_mappings.append({
                "item_id": item.id,
                "change_qty": initial_qty,
                "type": "IN",
                "reference_note": "Initial warehouse inventory loading",
                "batch_no": batch_no,
                "expiry_date": expiry_date,
                "created_by": admin.id,
                "created_at": bootstrap_date + timedelta(hours=random.randint(6, 12)),
            })
            running_stock += initial_qty

            # Determine sales transaction frequencies based on velocity class
            if vel_class == "A":  # Fast
                sales_loops = 3   # 3 transactions per day
                sale_prob = 0.85
                sale_qty_range = (2, 8)
            elif vel_class == "B":  # Medium
                sales_loops = 2   # 2 transactions per day
                sale_prob = 0.45
                sale_qty_range = (1, 4)
            elif vel_class == "C":  # Slow
                sales_loops = 1   # 1 transaction per day
                sale_prob = 0.10
                sale_qty_range = (1, 2)
            else:  # Zero sales
                sales_loops = 0
                sale_prob = 0.0
                sale_qty_range = (0, 0)

            # Generate ledger transactions for each day
            for day_offset in range(89, -1, -1):
                day = now - timedelta(days=day_offset)

                # Restock Check: if stock level hits reorder point, trigger restock entry
                if running_stock <= item.reorder_point:
                    in_qty = item.reorder_qty
                    batch_no = None
                    expiry_date = None
                    if cat == "grocery" and extra.get("expiry_tracked"):
                        batch_counter += 1
                        batch_no = f"B-{extra['sku_prefix']}-{batch_counter:05d}"
                        if extra.get("perishable"):
                            expiry_date = day + timedelta(days=random.randint(5, 20))
                        else:
                            expiry_date = day + timedelta(days=random.randint(60, 200))

                    ledger_mappings.append({
                        "item_id": item.id,
                        "change_qty": in_qty,
                        "type": "IN",
                        "reference_note": f"Automated restocking supply arrival (Day {90 - day_offset})",
                        "batch_no": batch_no,
                        "expiry_date": expiry_date,
                        "created_by": admin.id,
                        "created_at": day + timedelta(hours=random.randint(6, 9)),
                    })
                    running_stock += in_qty

                # Sales Transactions
                for _ in range(sales_loops):
                    if random.random() < sale_prob:
                        out_qty = random.randint(*sale_qty_range)
                        # Avoid negative stock outdraws in simulation
                        if out_qty > 0 and running_stock >= out_qty:
                            ledger_mappings.append({
                                "item_id": item.id,
                                "change_qty": -out_qty,
                                "type": "OUT",
                                "reference_note": f"Customer checkout sale (Day {90 - day_offset})",
                                "created_by": staff.id,
                                "created_at": day + timedelta(hours=random.randint(10, 22)),
                            })
                            running_stock -= out_qty

        # Bulk insert to hit 10k-14k records fast
        print(f"Executing bulk insertion of {len(ledger_mappings)} ledger records into PostgreSQL...")
        db.bulk_insert_mappings(StockLedger, ledger_mappings)
        db.commit()

        print(f"  Created {len(ledger_mappings)} ledger entries across 120 items successfully.")

        # ---- RUN INITIAL FORECAST ENGINE ----
        print("\n[FORECAST] Running initial demand forecast calculations...")
        from app.services.forecast_service import run_forecasts
        count = run_forecasts(db)
        print(f"  Calculated forecasts for {count} items.")

        print("\n" + "=" * 60)
        print("  SEED COMPLETE — PostgreSQL Database is seeded and demo-ready!")
        print("=" * 60)
        print("  Login credentials:")
        print("  +-----------------------------------------+")
        print("  | Admin: admin@dmart.com / admin123        |")
        print("  | Staff: staff@dmart.com / staff123        |")
        print("  +-----------------------------------------+")
        print()

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
