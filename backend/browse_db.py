import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from app.core.config import settings

def display_table(title, headers, rows):
    print("=" * 80)
    print(f"  {title}")
    print("=" * 80)
    if not rows:
        print("(No rows found)")
        print("\n")
        return
    # format strings based on header lengths
    fmt = " | ".join([f"{{:<{max(len(h), 15)}}}" for h in headers])
    print(fmt.format(*headers))
    print("-" * 80)
    for row in rows:
        # Convert all columns to strings and truncate to 20 chars max for neat display
        str_row = [str(col)[:20] for col in row]
        # Pad row to match headers count if shorter
        if len(str_row) < len(headers):
            str_row += [""] * (len(headers) - len(str_row))
        print(fmt.format(*str_row[:len(headers)]))
    print("\n")

def browse():
    try:
        print(f"Connecting to PostgreSQL database at: {settings.DATABASE_URL}")
        conn = psycopg2.connect(settings.DATABASE_URL)
        cursor = conn.cursor()

        # 1. Users
        cursor.execute("SELECT id, name, email, role FROM users")
        display_table("TABLE: users", ["ID", "Name", "Email", "Role"], cursor.fetchall())

        # 2. Categories
        cursor.execute("SELECT id, name, type FROM categories")
        display_table("TABLE: categories", ["ID", "Name", "Type"], cursor.fetchall())

        # 3. Items (First 5)
        cursor.execute("""
            SELECT items.id, items.sku, items.name, categories.name, items.unit, items.unit_price 
            FROM items 
            JOIN categories ON items.category_id = categories.id 
            LIMIT 5
        """)
        display_table("TABLE: items (First 5 Rows)", ["ID", "SKU", "Name", "Category", "Unit", "Price"], cursor.fetchall())

        # 4. Stock Ledger (First 5)
        cursor.execute("""
            SELECT stock_ledger.id, items.sku, stock_ledger.change_qty, stock_ledger.type, stock_ledger.reference_note, stock_ledger.created_at
            FROM stock_ledger
            JOIN items ON stock_ledger.item_id = items.id
            LIMIT 5
        """)
        display_table("TABLE: stock_ledger (First 5 Transaction Logs)", ["ID", "Item SKU", "Qty Change", "Type", "Note", "Timestamp"], cursor.fetchall())

        # 5. Forecasts (First 5)
        cursor.execute("""
            SELECT forecasts.id, items.sku, forecasts.predicted_daily_demand, forecasts.days_until_stockout, forecasts.suggested_reorder_date, forecasts.suggested_reorder_qty
            FROM forecasts
            JOIN items ON forecasts.item_id = items.id
            LIMIT 5
        """)
        display_table("TABLE: forecasts (First 5 Calculated Projections)", ["ID", "Item SKU", "Daily Demand", "Stockout Days", "Reorder Date", "Reorder Qty"], cursor.fetchall())

        conn.close()
    except Exception as e:
        print(f"Database connection error: {e}")

if __name__ == "__main__":
    browse()
