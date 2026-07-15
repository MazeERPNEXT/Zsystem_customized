# Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
    filters = filters or {}

    columns = get_columns(filters)
    data = get_data(filters)
    report_summary = get_report_summary(data)

    return columns, data, None, None, report_summary


def get_columns(filters):
    columns = [
        {
            "label": "Purchase Invoice",
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Purchase Invoice",
            "width": 180
        },
        {
            "label": "Supplier",
            "fieldname": "supplier",
            "fieldtype": "Link",
            "options": "Supplier",
            "width": 220
        },
        {
            "label": "Posting Date",
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Due Date",
            "fieldname": "due_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Bill No",
            "fieldname": "bill_no",
            "fieldtype": "Data",
            "width": 140
        },
        {
            "label": "Bill Date",
            "fieldname": "bill_date",
            "fieldtype": "Date",
            "width": 110
        },
        {
            "label": "Total",
            "fieldname": "rounded_total",
            "fieldtype": "Currency",
            "width": 120
        }
    ]

    # Dynamic column based on Payment Status
    if filters.get("payment_status") == "Paid":
        columns.append({
            "label": "Paid Amount",
            "fieldname": "paid_amount",
            "fieldtype": "Currency",
            "width": 180
        })

    elif filters.get("payment_status") == "Outstanding":
        columns.append({
            "label": "Outstanding Amount",
            "fieldname": "outstanding_amount",
            "fieldtype": "Currency",
            "width": 180
        })

    else:
        columns.extend([
            {
                "label": "Paid Amount",
                "fieldname": "paid_amount",
                "fieldtype": "Currency",
                "width": 140
            },
            {
                "label": "Outstanding Amount",
                "fieldname": "outstanding_amount",
                "fieldtype": "Currency",
                "width": 140
            }
        ])

    return columns


def get_data(filters):
    query = """
        SELECT
            name,
            supplier,
            posting_date,
            due_date,
            bill_no,
            bill_date,
            rounded_total,
            outstanding_amount,
            (rounded_total - outstanding_amount) AS paid_amount
        FROM `tabPurchase Invoice`
        WHERE docstatus = 1
          AND posting_date BETWEEN %(from_date)s AND %(to_date)s
    """

    if filters.get("supplier"):
        query += " AND supplier = %(supplier)s"

    # if filters.get("payment_status") == "Paid":
    #     query += " AND outstanding_amount = 0"

    # elif filters.get("payment_status") == "Outstanding":
    #     query += " AND outstanding_amount > 0"

    query += " ORDER BY posting_date DESC"

    return frappe.db.sql(query, filters, as_dict=True)


def get_report_summary(data):
    total_invoice = len(data)
    total_amount = 0
    total_paid = 0
    total_outstanding = 0

    for row in data:
        total_amount += row.get("rounded_total") or 0
        total_paid += row.get("paid_amount") or 0
        total_outstanding += row.get("outstanding_amount") or 0

    return [
        {
            "label": "Overall Invoice",
            "value": total_invoice,
            "indicator": "Blue",
            "datatype": "Int"
        },
        {
            "label": "Overall Amount",
            "value": total_amount,
            "indicator": "Green",
            "datatype": "Currency"
        },
        {
            "label": "Overall Paid",
            "value": total_paid,
            "indicator": "Green",
            "datatype": "Currency"
        },
        {
            "label": "Overall Outstanding",
            "value": total_outstanding,
            "indicator": "Red",
            "datatype": "Currency"
        }
    ]
