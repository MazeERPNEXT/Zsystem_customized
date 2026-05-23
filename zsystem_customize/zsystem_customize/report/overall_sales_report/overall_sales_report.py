# Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)

    return columns, data


def get_columns():
    return [
        {
            "label": "Document Type",
            "fieldname": "doctype_name",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": "ID",
            "fieldname": "name",
            "fieldtype": "Dynamic Link",
            "options": "doctype_name",
            "width": 180
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 200
        },
        {
            "label": "Date",
            "fieldname": "posting_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": "Grand Total",
            "fieldname": "grand_total",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": "Rounded Total",
            "fieldname": "rounded_total",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": "Item Code",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 180
        },
        {
            "label": "Qty",
            "fieldname": "qty",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": "Delivered Qty",
            "fieldname": "custom_delivery_qty",
            "fieldtype": "Float",
            "width": 140
        },
        {
            "label": "Balance Qty",
            "fieldname": "custom_balance_qty",
            "fieldtype": "Float",
            "width": 140
        },
        {
            "label": "Sales Order",
            "fieldname": "sales_order",
            "fieldtype": "Link",
            "options": "Sales Order",
            "width": 180
        },
        {
            "label": "Delivery Note",
            "fieldname": "delivery_note",
            "fieldtype": "Link",
            "options": "Delivery Note",
            "width": 180
        },
    ]


def get_data(filters):

    data = []

    doctype_filter = filters.get("doctype")

    if not doctype_filter or doctype_filter == "Sales Order":
        data.extend(get_sales_order_data(filters))

    if not doctype_filter or doctype_filter == "Delivery Note":
        data.extend(get_delivery_note_data(filters))

    if not doctype_filter or doctype_filter == "Sales Invoice":
        data.extend(get_sales_invoice_data(filters))
        
    if not doctype_filter or doctype_filter == "Returnable DC":
            data.extend(get_returnable_dc_data(filters))

    return data


def get_common_conditions(filters, alias=""):

    conditions = ""

    prefix = f"{alias}." if alias else ""

    if filters.get("customer"):
        conditions += f" AND {prefix}customer = '{filters.get('customer')}' "

    if filters.get("status"):
        conditions += f" AND {prefix}status = '{filters.get('status')}' "

    if filters.get("name"):
        conditions += f"""
            AND {prefix}name LIKE '%{filters.get("name")}%'
        """

    return conditions


def get_sales_order_data(filters):

    conditions = get_common_conditions(filters, "so")

    if filters.get("from_date"):
        conditions += f" AND so.transaction_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND so.transaction_date <= '{filters.get('to_date')}' "

    partial_condition = ""

    if filters.get("status") == "Partially Deliver":
        partial_condition = " AND so.status = 'Partially Deliver' "

    return frappe.db.sql(f"""
        SELECT
            'Sales Order' AS doctype_name,

            so.name,
            so.customer,
            so.transaction_date AS posting_date,
            so.status,

            CASE
                WHEN so.status = 'Partially Deliver'
                THEN soi.item_code
                ELSE ''
            END AS item_code,

            CASE
                WHEN so.status = 'Partially Deliver'
                THEN soi.qty
                ELSE NULL
            END AS qty,

            CASE
                WHEN so.status = 'Partially Deliver'
                THEN soi.custom_delivery_qty
                ELSE NULL
            END AS custom_delivery_qty,

            CASE
                WHEN so.status = 'Partially Deliver'
                THEN soi.custom_balance_qty
                ELSE NULL
            END AS custom_balance_qty,

            '' AS sales_order,
            '' AS delivery_note,

            so.grand_total,
            so.rounded_total

        FROM `tabSales Order` so

        LEFT JOIN `tabSales Order Item` soi
            ON so.name = soi.parent

        WHERE so.docstatus != 2
        {conditions}

    """, as_dict=1)

def get_delivery_note_data(filters):

    conditions = get_common_conditions(filters, "dn")

    if filters.get("from_date"):
        conditions += f" AND dn.posting_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND dn.posting_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""
        SELECT
            'Delivery Note' AS doctype_name,
            dn.name,
            dn.customer,
            dn.posting_date,
            dn.status,

            GROUP_CONCAT(
                DISTINCT dni.against_sales_order
            ) AS sales_order,

            '' AS delivery_note,

            dn.grand_total,
            dn.rounded_total

        FROM `tabDelivery Note` dn

        LEFT JOIN `tabDelivery Note Item` dni
            ON dn.name = dni.parent

        WHERE dn.docstatus != 2 AND dn.custom_returnable_dc != 1
        {conditions}

        GROUP BY dn.name
    """, as_dict=1)

def get_returnable_dc_data(filters):

    conditions = get_common_conditions(filters, "dn")

    if filters.get("from_date"):
        conditions += f" AND dn.posting_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND dn.posting_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""
        SELECT
            'Delivery Note' AS doctype_name,
            dn.name,
            dn.customer,
            dn.posting_date,
            dn.status,

            GROUP_CONCAT(
                DISTINCT dni.against_sales_order
            ) AS sales_order,

            '' AS delivery_note,

            dn.grand_total,
            dn.rounded_total

        FROM `tabDelivery Note` dn

        LEFT JOIN `tabDelivery Note Item` dni
            ON dn.name = dni.parent

        WHERE dn.docstatus != 2 AND dn.custom_returnable_dc = 1
        {conditions}

        GROUP BY dn.name
    """, as_dict=1)

def get_sales_invoice_data(filters):

    conditions = get_common_conditions(filters, "si")

    if filters.get("from_date"):
        conditions += f" AND si.posting_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND si.posting_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""
        SELECT
            'Sales Invoice' AS doctype_name,

            si.name,
            si.customer,
            si.posting_date,
            si.status,

            GROUP_CONCAT(
                DISTINCT sii.sales_order
            ) AS sales_order,

            GROUP_CONCAT(
                DISTINCT sii.delivery_note
            ) AS delivery_note,

            si.grand_total,
            si.rounded_total

        FROM `tabSales Invoice` si

        LEFT JOIN `tabSales Invoice Item` sii
            ON si.name = sii.parent

        WHERE si.docstatus != 2
        {conditions}

        GROUP BY si.name
    """, as_dict=1)