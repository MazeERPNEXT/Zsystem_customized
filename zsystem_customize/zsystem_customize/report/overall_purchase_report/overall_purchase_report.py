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
            "label": "Supplier",
            "fieldname": "supplier",
            "fieldtype": "Link",
            "options": "Supplier",
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
        #     "label": "Created By",
        #     "fieldname": "custom_created_by",
        #     "fieldtype": "Data",
        #     "width": 180
        # },
    ]
    if not filters or not filters.get("doctype") or filters.get("doctype") == "Purchase Receipt" or filters.get("doctype") == "Purchase Invoice":
         columns.extend([
			{
				"label": "Purchase Order",
				"fieldname": "purchase_order",
				"fieldtype": "Link",
				"options": "Purchase Order",
				"width": 180
			}
		])
    if not filters or not filters.get("doctype") or filters.get("doctype") == "Purchase Invoice":
         columns.extend([
			{
				"label": "Purchase Receipt",
				"fieldname": "purchase_receipt",
				"fieldtype": "Link",
				"options": "Purchase Receipt",
				"width": 180
			}
		])
    return columns
def get_data(filters):

    data = []

    doctype_filter = filters.get("doctype")

    if not doctype_filter or doctype_filter == "Purchase Order":
        data.extend(get_purchase_order_data(filters))

    if not doctype_filter or doctype_filter == "Purchase Receipt":
        data.extend(get_purchase_receipt_data(filters))

    if not doctype_filter or doctype_filter == "Purchase Invoice":
        data.extend(get_purchase_invoice_data(filters))
        

    return data
def get_common_conditions(filters, alias=""):

    conditions = ""

    prefix = f"{alias}." if alias else ""

    if filters.get("supplier"):
        conditions += f" AND {prefix}supplier = '{filters.get('supplier')}' "

    if filters.get("status"):
        conditions += f" AND {prefix}status = '{filters.get('status')}' "

    if filters.get("name"):
        conditions += f"""
            AND {prefix}name LIKE '%{filters.get("name")}%'
        """
    # if filters.get("custom_sales_person"):
    #     conditions += f"""
    #         AND {prefix}custom_sales_person LIKE '%{filters.get("custom_sales_person")}%'
    #     """
    # if filters.get("po_no"):
    #     conditions += f"""
    #         AND {prefix}po_no LIKE '%{filters.get("po_no")}%'
    #     """

    return conditions

def get_purchase_order_data(filters):
    conditions = get_common_conditions(filters, "po")

    if filters.get("from_date"):
        conditions += f"""
            AND po.transaction_date >= '{filters.get("from_date")}'
        """

    if filters.get("to_date"):
        conditions += f"""
            AND po.transaction_date <= '{filters.get("to_date")}'
        """

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT
                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN 'Purchase Order'
                    ELSE ''
                END AS doctype_name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN po.name
                    ELSE ''
                END AS name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN po.supplier
                    ELSE ''
                END AS supplier,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN po.transaction_date
                    ELSE NULL
                END AS posting_date,

                po.status,

                poi.item_code,
                poi.rate,
                poi.qty,

                '' AS sales_order,
                '' AS delivery_note,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN po.grand_total
                    ELSE NULL
                END AS grand_total,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY po.name ORDER BY poi.idx) = 1
                    THEN po.rounded_total
                    ELSE NULL
                END AS rounded_total

            FROM `tabPurchase Order` po
            LEFT JOIN `tabPurchase Order Item` poi
                ON po.name = poi.parent

            WHERE po.docstatus != 2
            {conditions}

            ORDER BY po.transaction_date, po.name, poi.idx
        ) AS subquery
    """, as_dict=True)

def get_purchase_receipt_data(filters):
    conditions = get_common_conditions(filters, "pr")

    if filters.get("from_date"):
        conditions += f"""
            AND pr.posting_date >= '{filters.get("from_date")}'
        """

    if filters.get("to_date"):
        conditions += f"""
            AND pr.posting_date <= '{filters.get("to_date")}'
        """

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT
                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN 'Purchase Receipt'
                    ELSE ''
                END AS doctype_name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN pr.name
                    ELSE ''
                END AS name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN pr.supplier
                    ELSE ''
                END AS supplier,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN pr.posting_date
                    ELSE NULL
                END AS posting_date,

                pr.status,

                pri.item_code,
                pri.rate,
                pri.qty,

                CASE
					WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
					THEN pri.purchase_order
					ELSE ''
				END AS purchase_order,

                '' AS purchase_receipt,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN pr.grand_total
                    ELSE NULL
                END AS grand_total,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pr.name ORDER BY pri.idx) = 1
                    THEN pr.rounded_total
                    ELSE NULL
                END AS rounded_total

            FROM `tabPurchase Receipt` pr
            LEFT JOIN `tabPurchase Receipt Item` pri
                ON pr.name = pri.parent

            WHERE pr.docstatus != 2
            {conditions}

            ORDER BY pr.posting_date, pr.name, pri.idx
        ) AS subquery
    """, as_dict=True)

def get_purchase_invoice_data(filters):
    conditions = get_common_conditions(filters, "pi")

    if filters.get("from_date"):
        conditions += f"""
            AND pi.posting_date >= '{filters.get("from_date")}'
        """

    if filters.get("to_date"):
        conditions += f"""
            AND pi.posting_date <= '{filters.get("to_date")}'
        """

    return frappe.db.sql(f"""
        SELECT * FROM (
            SELECT
                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN 'Purchase Invoice'
                    ELSE ''
                END AS doctype_name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN pi.name
                    ELSE ''
                END AS name,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN pi.supplier
                    ELSE ''
                END AS supplier,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN pi.posting_date
                    ELSE NULL
                END AS posting_date,

                pi.status,

                pii.item_code,
                pii.rate,
                pii.qty,

                CASE
					WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
					THEN pii.purchase_order
					ELSE ''
				END AS purchase_order,

                CASE
					WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
					THEN pii.purchase_receipt
					ELSE ''
				END AS purchase_receipt,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN pi.grand_total
                    ELSE NULL
                END AS grand_total,

                CASE
                    WHEN ROW_NUMBER() OVER (PARTITION BY pi.name ORDER BY pii.idx) = 1
                    THEN pi.rounded_total
                    ELSE NULL
                END AS rounded_total

            FROM `tabPurchase Invoice` pi
            LEFT JOIN `tabPurchase Invoice Item` pii
                ON pi.name = pii.parent

            WHERE pi.docstatus != 2
            {conditions}

            ORDER BY pi.posting_date, pi.name, pii.idx
        ) AS subquery
    """, as_dict=True)

    