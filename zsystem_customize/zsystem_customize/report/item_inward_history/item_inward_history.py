# Copyright (c) 2026, Mazeworks Solutions Pvt Ltd and contributors
# For license information, please see license.txt

import frappe

def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)

    return columns, data


def get_columns(filters=None):
    return [
        {
            "label": "Fiscal Year",
            "fieldname": "fiscal_year",
            "fieldtype": "data",
            "width": 280,
        },
        
        {
            "label": "Item Code",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 280,
        },
        {
            "label": "Qty",
            "fieldname": "actual_qty",
            "fieldtype": "Float",
            "width": 300,
        },
        {
            "label": "Rate (Avg)",
            "fieldname": "valuation_rate",
            "fieldtype": "Currency",
            "width": 300,
        },
    ]


def get_data(filters=None):
    filters = filters or {}

    conditions = ""
    values = {}

    if filters.get("item_code"):
        conditions += " AND sle.item_code LIKE %(item_code)s"
        values["item_code"] = f"%{filters.get('item_code')}%"

    if filters.get("fiscal_year"):
        conditions += " AND sle.fiscal_year = %(fiscal_year)s"
        values["fiscal_year"] = filters.get("fiscal_year")


    return frappe.db.sql(
        f"""
        SELECT
            sle.item_code,
            SUM(sle.actual_qty) AS actual_qty,
            ROUND(SUM(sle.valuation_rate) / COUNT(*), 2) AS valuation_rate,
            sle.fiscal_year
        FROM `tabStock Ledger Entry` sle
        WHERE
            sle.is_cancelled = 0
            AND sle.voucher_type IN ('Purchase Receipt', 'Purchase Invoice')
            {conditions}
        GROUP BY
            sle.item_code
        ORDER BY
            sle.item_code
        """,
        values=values,
        as_dict=True,
    )