# Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)

    return columns, data


def get_columns(filters=None):
    columns =  [
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
        # {
        #     "label": "Delivered Qty",
        #     "fieldname": "custom_delivery_qty",
        #     "fieldtype": "Float",
        #     "width": 140
        # },
        # {
        #     "label": "Balance Qty",
        #     "fieldname": "custom_balance_qty",
        #     "fieldtype": "Float",
        #     "width": 140
        # },
        {
            "label": "Rate",
            "fieldname": "rate",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": "Grand Total",
            "fieldname": "rounded_total",
            "fieldtype": "Currency",
            "width": 140
        },
        # {
        #     "label": "Rounded Total",
        #     "fieldname": "rounded_total",
        #     "fieldtype": "Currency",
        #     "width": 140
        # },
        {
            "label": "Sales Person",
            "fieldname": "custom_sales_person",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": "Customer Purchase Order",
            "fieldname": "po_no",
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
    if not filters or not filters.get("doctype") or filters and filters.get("doctype") == "Returnable DC":
        columns.append({
            "label": "Expected Closing Date",
            "fieldname": "custom_expected_closing_date",
            "fieldtype": "Date",	
            "width": 180
        })
    if (not filters or not filters.get("doctype") or (filters.get("doctype") == "Sales Order" and filters.get("status") == "Partially Deliver")):
        qty_index = next(
            i for i, col in enumerate(columns)
            if col.get("fieldname") == "qty"
        )

        columns[qty_index + 1:qty_index + 1] = [
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
            }
        ]

    return columns


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
    if filters.get("custom_sales_person"):
        conditions += f"""
            AND {prefix}custom_sales_person LIKE '%{filters.get("custom_sales_person")}%'
        """
    if filters.get("po_no"):
        conditions += f"""
            AND {prefix}po_no LIKE '%{filters.get("po_no")}%'
        """

    return conditions


def get_sales_order_data(filters):

    conditions = get_common_conditions(filters, "so")
    if filters.get("from_date"):
        conditions += f"""
            AND so.transaction_date >= '{filters.get("from_date")}'
        """

    if filters.get("to_date"):
        conditions += f"""
            AND so.transaction_date <= '{filters.get("to_date")}'
        """

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT
                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN 'Sales Order' 
                    ELSE '' 
                END AS doctype_name,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.name 
                    ELSE '' 
                END AS name,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.customer 
                    ELSE '' 
                END AS customer,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.transaction_date 
                    ELSE NULL 
                END AS posting_date,

                so.status,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.custom_created_by 
                    ELSE '' 
                END AS custom_created_by,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.custom_sales_person 
                    ELSE '' 
                END AS custom_sales_person,

                CASE 
                    WHEN ROW_NUMBER() OVER (PARTITION BY so.name ORDER BY soi.idx) = 1 
                    THEN so.po_no 
                    ELSE '' 
                END AS po_no,

                soi.item_code,
                soi.rate,
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
                    THEN
                        CASE
                            WHEN so.disable_rounded_total = 1 THEN so.grand_total
                            ELSE so.rounded_total
                        END
                    ELSE NULL
                END AS rounded_total


            FROM `tabSales Order` so
            LEFT JOIN `tabSales Order Item` soi
                ON so.name = soi.parent

            WHERE so.docstatus != 2
            {conditions}

            AND (
                so.status != 'Partially Deliver'
                OR (so.status = 'Partially Deliver' AND COALESCE(soi.custom_delivery_qty,0) != soi.qty)
            )

            ORDER BY so.transaction_date, so.name, soi.idx
    ) AS subquery
""", as_dict=1)

def get_delivery_note_data(filters):

    conditions = get_common_conditions(filters, "dn")

    if filters.get("from_date"):
        conditions += f" AND dn.posting_date >= '{filters.get('from_date')}' "

    if filters.get("to_date"):
        conditions += f" AND dn.posting_date <= '{filters.get('to_date')}' "

    return frappe.db.sql(f"""
        SELECT
            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN 'Delivery Note'
                ELSE ''
            END AS doctype_name,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.name
                ELSE ''
            END AS name,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.customer
                ELSE ''
            END AS customer,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.posting_date
                ELSE NULL
            END AS posting_date,

            dn.status,

            # CASE
            #     WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
            #     THEN dn.custom_created_by
            #     ELSE ''
            # END AS custom_created_by,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.custom_sales_person
                ELSE ''
            END AS custom_sales_person,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.po_no
                ELSE ''
            END AS po_no,

            dni.item_code,
            dni.rate,
            dni.qty,

            NULL AS custom_delivery_qty,
            NULL AS custom_balance_qty,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dni.against_sales_order
                ELSE ''
            END AS sales_order,

            '' AS delivery_note,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN
                    CASE
                        WHEN dn.disable_rounded_total = 1 THEN dn.grand_total
                        ELSE dn.rounded_total
                    END
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
            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN 'Returnable DC'
                ELSE ''
            END AS doctype_name,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.name
                ELSE ''
            END AS name,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.customer
                ELSE ''
            END AS customer,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.posting_date
                ELSE NULL
            END AS posting_date,

            dn.status,

            # CASE
            #     WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
            #     THEN dn.custom_created_by
            #     ELSE ''
            # END AS custom_created_by,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.custom_sales_person
                ELSE ''
            END AS custom_sales_person,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dn.custom_expected_closing_date
                ELSE NULL
            END AS custom_expected_closing_date,

            dni.item_code,
            dni.rate,
            dni.qty,

            NULL AS custom_delivery_qty,
            NULL AS custom_balance_qty,

            CASE
                WHEN ROW_NUMBER() OVER (PARTITION BY dn.name ORDER BY dni.idx) = 1
                THEN dni.against_sales_order
                ELSE ''
            END AS sales_order,

            '' AS delivery_note,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY dn.name
                    ORDER BY dni.idx
                ) = 1
                THEN
                    CASE
                        WHEN dn.disable_rounded_total = 1 THEN dn.grand_total
                        ELSE dn.rounded_total
                    END
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
            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN 'Sales Invoice'
                ELSE ''
            END AS doctype_name,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.name
                ELSE ''
            END AS name,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.customer
                ELSE ''
            END AS customer,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.posting_date
                ELSE NULL
            END AS posting_date,

            si.status,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.custom_created_by
                ELSE ''
            END AS custom_created_by,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.custom_sales_person
                ELSE ''
            END AS custom_sales_person,

            CASE
                WHEN ROW_NUMBER() OVER (
                    PARTITION BY si.name
                    ORDER BY sii.idx
                ) = 1
                THEN si.po_no
                ELSE ''
            END AS po_no,

            sii.item_code,
            sii.rate,
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
                THEN
                    CASE
                        WHEN si.disable_rounded_total = 1 THEN si.grand_total
                        ELSE si.rounded_total
                    END
                ELSE NULL
            END AS rounded_total

        FROM `tabSales Invoice` si

        LEFT JOIN `tabSales Invoice Item` sii
            ON si.name = sii.parent

        WHERE si.docstatus != 2
        {conditions}

        ORDER BY si.posting_date, si.name, sii.idx
    """, as_dict=1)