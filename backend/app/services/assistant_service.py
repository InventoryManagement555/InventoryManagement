"""
NL Report Assistant — safe-query-template pattern with fuzzy matching.

SECURITY:
- The LLM NEVER sees raw table data, credentials, or generates SQL.
- Questions are matched to a FIXED set of parameterized query templates.
- Fuzzy matching only decides WHICH template to run — it never influences SQL.
- Only small aggregated results are sent to Claude for phrasing.
- Unmatched questions get a graceful decline, never a fallback query.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Optional, Tuple, List

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Item, StockLedger, Category
from app.services.stock_service import get_available_stock
from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain-specific typo/synonym correction dictionary
# ---------------------------------------------------------------------------
TYPO_CORRECTIONS = {
    # Common typos
    "stok": "stock", "sotck": "stock", "stck": "stock", "sock": "stock",
    "invetory": "inventory", "inventry": "inventory", "inventroy": "inventory",
    "iventory": "inventory", "inventori": "inventory",
    "furnitur": "furniture", "furnture": "furniture", "furnitue": "furniture",
    "funitur": "furniture", "furnit": "furniture",
    "grocry": "grocery", "grocey": "grocery", "grocer": "grocery",
    "grocerie": "grocery", "grosery": "grocery",
    "sel": "sell", "sels": "sells", "seling": "selling", "selled": "sold",
    "saler": "seller", "salers": "sellers", "saler": "seller",
    "expir": "expiry", "expring": "expiring", "expirng": "expiring",
    "expirey": "expiry", "expriy": "expiry",
    "reoder": "reorder", "reordr": "reorder", "reorde": "reorder",
    "forcast": "forecast", "forcast": "forecast", "forecst": "forecast",
    "demad": "demand", "deman": "demand",
    "valu": "value", "vlue": "value", "vale": "value",
    "itms": "items", "itmes": "items", "ietms": "items",
    "produts": "products", "prodcts": "products", "producs": "products",
    "quantiy": "quantity", "quantty": "quantity", "qty": "quantity",
    "avilable": "available", "availble": "available", "avaiable": "available",
    "movment": "movement", "movemnt": "movement",
    "transacton": "transaction", "transation": "transaction",
    "activty": "activity", "actvity": "activity",
    "perihsable": "perishable", "perisable": "perishable",
    "categry": "category", "categori": "category",
    "wht": "what", "whats": "what's", "wat": "what",
    "hw": "how", "hwo": "how",
    "shw": "show", "shwo": "show",
    "lst": "list", "lis": "list",
    "lvl": "level", "levl": "level",
    "belw": "below", "belo": "below",
    "ttal": "total", "totl": "total",
    "wrth": "worth",
}


def _normalize_input(question: str) -> str:
    """
    Normalize user input: lowercase, strip whitespace, correct domain-specific typos.
    """
    q = question.lower().strip()
    # Remove extra whitespace
    q = re.sub(r'\s+', ' ', q)
    # Remove common punctuation that doesn't affect meaning
    q = re.sub(r'[?!.,;:]+$', '', q)
    # Apply typo corrections word-by-word
    words = q.split()
    corrected = []
    for word in words:
        corrected.append(TYPO_CORRECTIONS.get(word, word))
    return ' '.join(corrected)


# ---------------------------------------------------------------------------
# Query templates — each has (keywords_list, executor_fn)
# Keywords are expanded with natural phrasings for fuzzy matching
# ---------------------------------------------------------------------------

TEMPLATE_KEYWORDS = {
    "total_stock_value": [
        "total stock value", "total value", "stock value", "inventory value",
        "total grocery stock value", "total furniture stock value",
        "what's my stock worth", "how much inventory do i have",
        "value of my stock", "value of all stock", "what is everything worth",
        "how much is my inventory worth", "total worth of stock",
        "stock valuation", "inventory valuation", "value of inventory",
        "what's the value of my inventory", "how much stock value",
        "total value of items", "worth of my inventory",
        "grocery value", "furniture value", "grocery stock value", "furniture stock value",
    ],
    "no_sales": [
        "no sales", "no movement", "zero sales", "no transaction", "no activity",
        "items that didn't sell", "items not sold", "items with no sales",
        "items without sales", "dead stock", "not moving items",
        "which items didn't sell", "what hasn't sold", "unsold items",
        "items with zero movement", "stagnant items", "no sale items",
        "items not selling", "zero movement", "slow moving items",
        "which products have no sales", "what items have no activity",
    ],
    "low_stock": [
        "low stock", "below reorder", "reorder point", "need to restock",
        "items running low", "out of stock", "stock running out",
        "items below threshold", "need reorder", "low inventory",
        "what needs restocking", "which items are low", "running out of stock",
        "stock alert", "low stock alert", "items to reorder",
        "what should i reorder", "critical stock", "stock shortage",
        "which items need restocking", "what's running low",
    ],
    "top_sellers": [
        "top seller", "top 5", "top 10", "best seller", "most sold", "highest sales",
        "best selling items", "top selling products", "most popular items",
        "what sells the most", "highest selling", "top performers",
        "best performing items", "most demanded items", "fast movers",
        "what are my top sellers", "which items sell most",
        "top products", "bestsellers", "best sellers",
        "most sold items", "popular products",
    ],
    "expiring": [
        "expiring", "expiry", "near expiry", "about to expire", "perishable",
        "expiring soon", "items expiring", "expiry date",
        "what's about to expire", "items near expiry", "perishable items",
        "grocery expiry", "expiration date", "items going bad",
        "which items expire soon", "shelf life", "use by date",
        "expiring grocery", "soon to expire", "close to expiry",
        "what groceries are expiring", "perishables expiring",
    ],
    "item_count": [
        "how many items", "item count", "total items", "number of items",
        "how many products", "count of items", "inventory count",
        "how many do we have", "total inventory count", "item total",
        "number of products", "how much inventory", "count inventory",
        "how many items are there", "total number of items",
        "how many skus", "sku count", "catalog size",
    ],
    "stock_level": [
        "stock level", "stock of", "how much", "available stock", "quantity of",
        "how many in stock", "check stock", "stock check",
        "what's the stock for", "current stock", "inventory level",
        "stock status", "how many do we have of", "stock on hand",
        "available quantity", "units in stock", "units available",
        "what's available", "do we have", "is in stock",
    ],
}


# ---------------------------------------------------------------------------
# Fuzzy matching engine
# ---------------------------------------------------------------------------

def _fuzzy_score(query: str, keyword: str) -> float:
    """Compute similarity between query and a keyword phrase using SequenceMatcher."""
    return SequenceMatcher(None, query, keyword).ratio()


def _find_best_template(question: str) -> Optional[str]:
    """
    Match a user question to one of the fixed templates.
    1. First tries exact substring matching (fast path)
    2. Falls back to fuzzy scoring with a 0.72 threshold
    Returns the template key or None.
    """
    q = _normalize_input(question)

    # Fast path: exact substring match
    for template_key, keywords in TEMPLATE_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                return template_key

    # Slow path: fuzzy matching
    best_key = None
    best_score = 0.0
    threshold = 0.72

    for template_key, keywords in TEMPLATE_KEYWORDS.items():
        for kw in keywords:
            score = _fuzzy_score(q, kw)
            if score > best_score:
                best_score = score
                best_key = template_key

    if best_score >= threshold and best_key is not None:
        logger.info(f"Fuzzy match: '{question}' → template '{best_key}' (score: {best_score:.3f})")
        return best_key

    logger.info(f"No template match for: '{question}' (best score: {best_score:.3f})")
    return None


# ---------------------------------------------------------------------------
# Template executors — parameterized queries, no user input in SQL
# ---------------------------------------------------------------------------

def _exec_total_stock_value(db: Session, question: str) -> str:
    cat_filter = None
    q_lower = question.lower()
    if "grocery" in q_lower:
        cat_filter = "grocery"
    elif "furniture" in q_lower:
        cat_filter = "furniture"

    query = db.query(Item).join(Category)
    if cat_filter:
        query = query.filter(Category.type == cat_filter)

    items = query.all()
    total_value = 0.0
    item_count = 0
    for item in items:
        avail = get_available_stock(db, item.id)
        total_value += float(item.unit_price) * avail
        item_count += 1

    cat_label = cat_filter or "all"
    return f"Category: {cat_label}. Total items: {item_count}. Total stock value: ${total_value:,.2f}."


def _exec_no_sales(db: Session, question: str) -> str:
    days = 30
    match = re.search(r"(\d+)\s*days?", question)
    if match:
        days = int(match.group(1))

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    active_items = (
        db.query(StockLedger.item_id)
        .filter(StockLedger.type == "OUT", StockLedger.created_at >= cutoff)
        .distinct()
        .subquery()
    )
    inactive_items = (
        db.query(Item.sku, Item.name)
        .filter(~Item.id.in_(db.query(active_items.c.item_id)))
        .all()
    )
    if not inactive_items:
        return f"All items had at least one sale in the last {days} days."

    item_list = "; ".join([f"{sku} - {name}" for sku, name in inactive_items[:15]])
    return f"Items with zero sales in the last {days} days ({len(inactive_items)} total): {item_list}"


def _exec_low_stock(db: Session, question: str) -> str:
    items = db.query(Item).join(Category).all()
    low = []
    for item in items:
        avail = get_available_stock(db, item.id)
        if avail <= item.reorder_point:
            low.append(f"{item.sku} ({item.name}): {avail} {item.unit} (reorder at {item.reorder_point})")
    if not low:
        return "No items are currently below their reorder point."
    return f"{len(low)} items below reorder point: " + "; ".join(low[:10])


def _exec_top_sellers(db: Session, question: str) -> str:
    limit = 5
    match = re.search(r"top\s*(\d+)", question)
    if match:
        limit = min(int(match.group(1)), 20)

    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    top = (
        db.query(
            Item.sku, Item.name,
            func.coalesce(func.sum(func.abs(StockLedger.change_qty)), 0).label("qty"),
        )
        .join(StockLedger, StockLedger.item_id == Item.id)
        .filter(StockLedger.type == "OUT", StockLedger.created_at >= ninety_days_ago)
        .group_by(Item.id, Item.sku, Item.name)
        .order_by(func.sum(func.abs(StockLedger.change_qty)).desc())
        .limit(limit)
        .all()
    )
    if not top:
        return "No sales data found in the last 90 days."
    lines = [f"{i+1}. {sku} ({name}): {int(qty)} units sold" for i, (sku, name, qty) in enumerate(top)]
    return f"Top {limit} sellers (last 90 days): " + "; ".join(lines)


def _exec_expiring(db: Session, question: str) -> str:
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=14)
    entries = (
        db.query(StockLedger)
        .join(Item).join(Category)
        .filter(
            Category.type == "grocery",
            StockLedger.expiry_date.isnot(None),
            StockLedger.expiry_date <= cutoff,
            StockLedger.expiry_date >= now,
        )
        .order_by(StockLedger.expiry_date.asc())
        .all()
    )
    seen = set()
    results = []
    for e in entries:
        if e.item_id in seen:
            continue
        seen.add(e.item_id)
        days_left = (e.expiry_date - now).days
        results.append(f"{e.item.name} (batch: {e.batch_no or 'N/A'}): expires {e.expiry_date.strftime('%Y-%m-%d')} ({days_left} days)")

    if not results:
        return "No grocery items are expiring within the next 14 days."
    return f"{len(results)} items expiring soon: " + "; ".join(results[:10])


def _exec_item_count(db: Session, question: str) -> str:
    total = db.query(func.count(Item.id)).scalar() or 0
    by_cat = (
        db.query(Category.type, func.count(Item.id))
        .join(Item)
        .group_by(Category.type)
        .all()
    )
    cats = {t: c for t, c in by_cat}
    return f"Total items: {total}. Furniture: {cats.get('furniture', 0)}. Grocery: {cats.get('grocery', 0)}."


def _exec_stock_level(db: Session, question: str) -> str:
    items = db.query(Item).all()
    q_lower = question.lower()
    found = None
    for item in items:
        if item.name.lower() in q_lower or item.sku.lower() in q_lower:
            found = item
            break
    if found:
        avail = get_available_stock(db, found.id)
        return f"{found.name} (SKU: {found.sku}): {avail} {found.unit} available. Unit price: ${float(found.unit_price):.2f}. Reorder point: {found.reorder_point}."
    # Generic: list top items by stock
    result_items = []
    for item in items[:10]:
        avail = get_available_stock(db, item.id)
        result_items.append(f"{item.name}: {avail} {item.unit}")
    return "Stock levels: " + "; ".join(result_items)


# Executor registry mapping template keys to executor functions
EXECUTORS = {
    "total_stock_value": _exec_total_stock_value,
    "no_sales": _exec_no_sales,
    "low_stock": _exec_low_stock,
    "top_sellers": _exec_top_sellers,
    "expiring": _exec_expiring,
    "item_count": _exec_item_count,
    "stock_level": _exec_stock_level,
}


# ---------------------------------------------------------------------------
# LLM phrasing layer
# ---------------------------------------------------------------------------

async def _phrase_with_llm(question: str, data_result: str) -> str:
    """
    Send the small aggregated result to Claude for natural-language phrasing.
    The LLM only sees the question + a small summary string, never raw DB contents.
    """
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY.startswith("sk-ant-api03-XX"):
        # No valid API key — return the raw data result directly
        return data_result

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": (
                    f"You are a helpful inventory management assistant. "
                    f"Phrase the following data as a clear, friendly answer to the user's question. "
                    f"Do not add any data that isn't in the provided result. "
                    f"Keep it concise (1-2 paragraphs max).\n\n"
                    f"User's question: {question}\n"
                    f"Data result: {data_result}"
                ),
            }],
        )
        return message.content[0].text
    except Exception as e:
        logger.warning(f"Claude API call failed, returning raw result: {e}")
        return data_result


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def ask_assistant(db: Session, question: str) -> str:
    """
    Main entry point for the NL assistant.
    1. Normalize and fuzzy-match question to a template
    2. Execute parameterized query
    3. Phrase result with LLM
    """
    template_key = _find_best_template(question)
    if template_key is None:
        return (
            "I can help with questions about stock levels, stock values, top sellers, "
            "low stock items, expiring grocery items, and item counts. "
            "Try asking something like 'What's my total stock value?' or 'Show me my top 5 sellers'."
        )

    executor = EXECUTORS[template_key]
    data_result = executor(db, question)

    # Phrase with LLM (falls back to raw result if API key is missing)
    answer = await _phrase_with_llm(question, data_result)
    return answer
