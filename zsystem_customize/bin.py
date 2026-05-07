import frappe

def bulk_sync_all_items():
    """
    Run this once to fix all existing incorrect stock values
    """

    data = frappe.db.sql("""
        SELECT item_code, SUM(actual_qty) as total_qty
        FROM `tabBin`
        GROUP BY item_code
    """, as_dict=True)

    for row in data:
        frappe.db.set_value(
            "Item",
            row.item_code,
            "custom_stock_qty",
            row.total_qty or 0,
            update_modified=False
        )

    frappe.db.commit()

    print(f"✅ Updated {len(data)} items successfully")