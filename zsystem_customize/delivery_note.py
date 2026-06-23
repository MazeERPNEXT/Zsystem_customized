# update so against dc qty and amount
import frappe 

def update_sales_order_delivery_totals(sales_order):
    if not sales_order:
        return

    result = frappe.db.sql("""
        SELECT
            COALESCE(SUM(dni.qty), 0) AS total_qty,
            COALESCE(SUM(dni.qty * dni.rate), 0) AS total_amount
        FROM `tabDelivery Note Item` dni
        INNER JOIN `tabDelivery Note` dn ON dn.name = dni.parent
        WHERE
            dni.against_sales_order = %s
            AND dn.docstatus = 1
    """, (sales_order,), as_dict=True)

    total_qty = result[0].total_qty if result else 0
    total_amount = result[0].total_amount if result else 0

    frappe.db.set_value("Sales Order", sales_order, {
        "custom_dc_qty": total_qty,
        "custom_dc_total": total_amount
    })


def update_sales_order_from_delivery_note(doc, method=None):
    sales_orders = set()

    for item in doc.items:
        if item.against_sales_order:
            sales_orders.add(item.against_sales_order)

    for so in sales_orders:
        update_sales_order_delivery_totals(so)