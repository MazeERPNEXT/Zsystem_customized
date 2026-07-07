import frappe


# ==========================================================
# UPDATE SALES ORDER TOTAL DC QTY & AMOUNT
# ==========================================================

def update_sales_order_delivery_totals(sales_order):
    if not sales_order:
        return

    result = frappe.db.sql(
        """
        SELECT
            COALESCE(SUM(dni.qty), 0) AS total_qty,
            COALESCE(SUM(dni.qty * dni.rate), 0) AS total_amount
        FROM `tabDelivery Note Item` dni
        INNER JOIN `tabDelivery Note` dn
            ON dn.name = dni.parent
        WHERE
            dni.against_sales_order = %s
            AND dn.docstatus = 1
        """,
        (sales_order,),
        as_dict=True,
    )

    total_qty = result[0].total_qty if result else 0
    total_amount = result[0].total_amount if result else 0

    # Update Sales Order fields only
    frappe.db.set_value(
        "Sales Order",
        sales_order,
        {
            "custom_dc_qty": total_qty,
            "custom_dc_total": total_amount,
        },
        update_modified=False,
    )


# ==========================================================
# UPDATE SALES ORDER ITEM DELIVERY DETAILS
# ==========================================================

def update_sales_order_delivery_qty(doc, method=None):

    so_items = {d.so_detail for d in doc.items if d.so_detail}

    for so_detail in so_items:

        so_qty = (
            frappe.db.get_value("Sales Order Item", so_detail, "qty")
            or 0
        )

        delivered_qty = frappe.db.sql(
            """
            SELECT COALESCE(SUM(dni.qty),0)
            FROM `tabDelivery Note Item` dni
            INNER JOIN `tabDelivery Note` dn
                ON dn.name = dni.parent
            WHERE
                dni.so_detail=%s
                AND dn.docstatus=1
            """,
            (so_detail,),
        )[0][0]

        balance_qty = max(so_qty - delivered_qty, 0)

        if delivered_qty <= 0:
            status = "Pending"
        elif delivered_qty < so_qty:
            status = "Partially Delivered"
        else:
            status = "Delivered"

        # Update Sales Order Item only
        frappe.db.set_value(
            "Sales Order Item",
            so_detail,
            {
                "custom_delivery_qty": delivered_qty,
                "custom_balance_qty": balance_qty,
                "custom_delivery_status": status,
            },
            update_modified=False,
        )


# ==========================================================
# UPDATE SALES ORDER TOTALS
# ==========================================================

def update_sales_order_from_delivery_note(doc, method=None):

    sales_orders = {
        d.against_sales_order
        for d in doc.items
        if d.against_sales_order
    }

    for so in sales_orders:
        update_sales_order_delivery_totals(so)


# ==========================================================
# COMMON EVENT
# ==========================================================

def delivery_note_events(doc, method=None):
    update_sales_order_delivery_qty(doc, method)
    update_sales_order_from_delivery_note(doc, method)