# Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt

def execute(filters=None):
    filters = filters or {}

    report_summary = []

    if filters.get("category") == "Customer":
        columns = get_customer_columns()
        data = get_customer_data(filters)

        report_summary = [
            {
                "label": "Total New Customers",
                "value": len(data),
                "indicator": "Green",
                "datatype": "Int",
            }
        ]
    else:
        columns = get_order_columns()
        data = get_order_data(filters)
        total_amount = sum(flt(row.get("total", 0)) for row in data)
        draft = sum(1 for d in data if d.get("status") == "Draft")
        inprogress = sum(1 for d in data if d.get("status") == "In Progress")
        to_bill = sum(1 for d in data if d.get("status") == "To Bill")
        partically_deliver = sum(1 for d in data if d.get("status") == "Partially Deliver")
        completed = sum(1 for d in data if d.get("status") == "Completed")
        report_summary = [
        {
            "label": "Total Orders",
            "value": len(data),
            "indicator": "Blue",
            "datatype": "Int",
        },
        {
			"label": "Total Amount",
			"value": total_amount,
			"indicator": "Green",
			"datatype": "Currency",
			"currency": "INR",   # or frappe.defaults.get_global_default("currency")
		},
        {
            "label": "Draft",
            "value": draft,
            "indicator": "Red",
            "datatype": "Int",
        },
        {
            "label": "In Progress",
            "value": inprogress,
            "indicator": "Green",
            "datatype": "Int",
        },
        {
            "label": "To Bill",
            "value": to_bill,
            "indicator": "Blue",
            "datatype": "Int",
        },
        {
            "label": "Partially Delivered",
            "value": partically_deliver,
            "indicator": "Red",
            "datatype": "Int",
        },
        {
            "label": "Completed",
            "value": completed,
            "indicator": "Green",
            "datatype": "Int",
        },
    ]

    chart = None
    message = None
    skip_total_rows = 0

    return (
        columns,
        data,
        message,
        chart,
        report_summary,
        skip_total_rows,
    )

# ---------------------------------------------------------
# Sales Order
# ---------------------------------------------------------

def get_order_columns():
    return [
        {
            "label": "ID",
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Sales Order",
            "width": 190,
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 200,
        },
        {
            "label": "Date",
            "fieldname": "transaction_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": "Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Tax Amount",
            "fieldname": "total_taxes_and_charges",
            "fieldtype": "Currency",
            "width": 140,
        },
        {
            "label": "Grand Total",
            "fieldname": "total",
            "fieldtype": "Currency",
            "width": 140,
        },
        {
            "label": "Sales Person",
            "fieldname": "custom_sales_person",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "Customer PO",
            "fieldname": "po_no",
            "fieldtype": "Data",
            "width": 180,
        },
    ]


def get_order_data(filters):
    conditions = ""

    if filters.get("customer"):
        conditions += " AND customer = %(customer)s"

    if filters.get("from_date"):
        conditions += " AND transaction_date >= %(from_date)s"

    if filters.get("to_date"):
        conditions += " AND transaction_date <= %(to_date)s"

    return frappe.db.sql(
        f"""
        SELECT
            name,
            customer,
            transaction_date,
            status,
            total_taxes_and_charges,
            CASE
                WHEN disable_rounded_total = 1 THEN grand_total
                ELSE rounded_total
            END AS total,
            custom_sales_person,
            po_no
        FROM `tabSales Order`
        WHERE docstatus < 2
        {conditions}
        ORDER BY transaction_date DESC
        """,
        filters,
        as_dict=True,
    )


# ---------------------------------------------------------
# Customer
# ---------------------------------------------------------

def get_customer_columns():
    return [
        {
            "label": "Customer",
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 180,
        },
        {
            "label": "Zsystem Sales Person",
            "fieldname": "custom_sales_person",
            "fieldtype": "Link",
            "options": "Sales Person",
            "width": 180,
        },
        {
            "label": "Enquiry Source",
            "fieldname": "custom_enquiry_source",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "Onboard Date",
            "fieldname": "custom_onboard_date",
            "fieldtype": "Date",
            "width": 150,
        },
        {
            "label": "GST No",
            "fieldname": "gstin",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "GST Category",
            "fieldname": "gst_category",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "PAN",
            "fieldname": "pan",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Created On",
            "fieldname": "creation",
            "fieldtype": "Datetime",
            "width": 180,
            "hidden":1
        },
    ]


def get_customer_data(filters):
    conditions = ""

    if filters.get("customer"):
        conditions += " AND name = %(customer)s"

    if filters.get("from_date"):
        conditions += " AND DATE(creation) >= %(from_date)s"

    if filters.get("to_date"):
        conditions += " AND DATE(creation) <= %(to_date)s"

    return frappe.db.sql(
        f"""
        SELECT
            name,
            custom_sales_person,
            custom_enquiry_source,
            custom_onboard_date,
            gstin,
            gst_category,
            pan,
            creation
        FROM `tabCustomer`
        WHERE disabled = 0
        {conditions}
        ORDER BY creation DESC
        """,
        filters,
        as_dict=True,
    )