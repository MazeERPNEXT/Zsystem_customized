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
            "label": "Sales Person",
            "fieldname": "custom_sales_person",
            "fieldtype": "Data",
            "width": 180
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
        {
            "label": "Created By",
            "fieldname": "custom_created_by",
            "fieldtype": "Data",
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

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT
                'Sales Order' AS doctype_name,

                so.name,
                so.customer,
                so.transaction_date AS posting_date,
                so.status,
                so.custom_created_by,
                so.custom_sales_person,

                soi.item_code,
                soi.qty,

                COALESCE(soi.custom_delivery_qty, 0) AS custom_delivery_qty,
                COALESCE(soi.custom_balance_qty, 0) AS custom_balance_qty,

                '' AS sales_order,
                '' AS delivery_note,

                CASE
                    WHEN ROW_NUMBER() OVER (
                        PARTITION BY so.name
                        ORDER BY soi.idx
                    ) = 1
                    THEN so.grand_total
                    ELSE NULL
                END AS grand_total,

                CASE
                    WHEN ROW_NUMBER() OVER (
                        PARTITION BY so.name
                        ORDER BY soi.idx
                    ) = 1
                    THEN so.rounded_total
                    ELSE NULL
                END AS rounded_total

            FROM `tabSales Order` so
            LEFT JOIN `tabSales Order Item` soi
                ON so.name = soi.parent

            WHERE so.docstatus != 2
            {conditions}

            ORDER BY
                so.transaction_date,
                so.name,
                soi.idx
        ) AS subquery

        WHERE (
            subquery.status != 'Partially Deliver'
            OR (
                subquery.status = 'Partially Deliver'
                AND subquery.custom_delivery_qty != subquery.qty
            )
        )

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
            dn.custom_created_by,
            dn.custom_sales_person,

            dni.item_code,
            dni.qty,

            NULL AS custom_delivery_qty,
            NULL AS custom_balance_qty,

            dni.against_sales_order AS sales_order,

            '' AS delivery_note,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN dn.grand_total
                ELSE NULL
            END AS grand_total,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN dn.rounded_total
                ELSE NULL
            END AS rounded_total

        FROM `tabDelivery Note` dn

        LEFT JOIN `tabDelivery Note Item` dni
            ON dn.name = dni.parent

        WHERE dn.docstatus != 2
        AND dn.custom_returnable_dc != 1
        {conditions}

        ORDER BY dn.posting_date, dn.name, dni.idx
    """, as_dict=1)

def get_returnable_dc_data(filters):

    conditions = get_common_conditions(filters, "dn")

    if filters.get("from_date"):
        conditions += f" AND dn.posting_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND dn.posting_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""
        SELECT
            'Returnable DC' AS doctype_name,

            dn.name,
            dn.customer,
            dn.posting_date,
            dn.status,
            dn.custom_created_by,
            dn.custom_sales_person,

            dni.item_code,
            dni.qty,

            NULL AS custom_delivery_qty,
            NULL AS custom_balance_qty,

            dni.against_sales_order AS sales_order,

            '' AS delivery_note,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN dn.grand_total
                ELSE NULL
            END AS grand_total,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN dn.rounded_total
                ELSE NULL
            END AS rounded_total

        FROM `tabDelivery Note` dn

        LEFT JOIN `tabDelivery Note Item` dni
            ON dn.name = dni.parent

        WHERE dn.docstatus != 2
        AND dn.custom_returnable_dc = 1
        {conditions}

        ORDER BY dn.posting_date, dn.name, dni.idx
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
            si.custom_created_by,
            si.custom_sales_person,

            sii.item_code,
            sii.qty,

            NULL AS custom_delivery_qty,
            NULL AS custom_balance_qty,

            sii.sales_order AS sales_order,
            sii.delivery_note,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.grand_total
                ELSE NULL
            END AS grand_total,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.rounded_total
                ELSE NULL
            END AS rounded_total

        FROM `tabSales Invoice` si

        LEFT JOIN `tabSales Invoice Item` sii
            ON si.name = sii.parent

        WHERE si.docstatus != 2
        {conditions}

        ORDER BY si.posting_date, si.name, sii.idx
    """, as_dict=1)