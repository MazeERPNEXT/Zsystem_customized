import frappe

import frappe


def execute():
    """
    Run this once to fix all existing incorrect stock values.
    Calculates stock from Bin.actual_qty while excluding
    Non-Saleable Item - Z and all its child warehouses.
    """

    parent_warehouse = "Non-Saleable Item - Z"

    # Get parent warehouse + all child warehouses
    excluded_warehouses = [
        parent_warehouse,
        *frappe.db.get_descendants("Warehouse", parent_warehouse),
    ]

    placeholders = ", ".join(["%s"] * len(excluded_warehouses))

    # Get stock quantity for all items
    data = frappe.db.sql(
        f"""
        SELECT
            item_code,
            COALESCE(SUM(actual_qty), 0) AS total_qty
        FROM `tabBin`
        WHERE warehouse NOT IN ({placeholders})
        GROUP BY item_code
        """,
        tuple(excluded_warehouses),
        as_dict=True,
    )

    # Update Item.custom_stock_qty
    for row in data:
        frappe.db.set_value(
            "Item",
            row.item_code,
            "custom_stock_qty",
            row.total_qty or 0,
            update_modified=False
        )

    frappe.db.commit()

    print(f"Updated {len(data)} items successfully")