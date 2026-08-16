import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.models import User, Item, Category
from app.services.dashboard_service import get_dashboard_summary
from app.services.forecast_service import get_all_forecasts

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/dashboard")
def export_dashboard_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Generates a CSV report containing low-stock and expiring-soon alerts."""
    summary = get_dashboard_summary(db)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Section 1: Low Stock
    writer.writerow(["--- SECTION: LOW STOCK ITEMS ---"])
    writer.writerow(["SKU", "Name", "Category", "Available Stock", "Reorder Point", "Unit"])
    for x in summary.low_stock_list:
        writer.writerow([x.sku, x.name, x.category, x.available_stock, x.reorder_point, x.unit])
    
    writer.writerow([])
    
    # Section 2: Expiring Soon
    writer.writerow(["--- SECTION: EXPIRING SOON GROCERY BATCHES ---"])
    writer.writerow(["SKU", "Name", "Batch No", "Expiry Date", "Available Stock", "Unit"])
    for x in summary.expiring_soon_list:
        writer.writerow([x.sku, x.name, x.batch_no, x.expiry_date, x.available_stock, x.unit])
        
    response = StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=dmart_dashboard_report.csv"
    return response


@router.get("/forecasts")
def export_forecasts_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """Generates a CSV report containing all computed reorder forecasts."""
    forecasts = get_all_forecasts(db)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["SKU", "Name", "Category", "Predicted Daily Demand", "Days Until Stockout", "Suggested Reorder Date", "Suggested Reorder Qty", "Mover Class"])
    for f in forecasts:
        writer.writerow([
            f.sku,
            f.item_name,
            f.category,
            round(f.predicted_daily_demand, 2),
            round(f.days_until_stockout, 2),
            f.suggested_reorder_date,
            f.suggested_reorder_qty,
            f.mover_class
        ])
        
    response = StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=dmart_reorders_report.csv"
    return response
