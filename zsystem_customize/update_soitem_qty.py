import frappe

def execute():
    """Recalculate delivery qty, balance qty and delivery totals
    for all existing Sales Orders."""

    sales_orders = frappe.get_all(
        "Sales Order",
        filters={"docstatus": ["!=", 2]},
        pluck="name"
    )

    for so in sales_orders:
        doc = frappe.get_doc("Sales Order", so)

        total_qty = 0
        total_amount = 0

        for item in doc.items:

            delivered_qty = frappe.db.sql("""
                SELECT COALESCE(SUM(dni.qty),0)
                FROM `tabDelivery Note Item` dni
                INNER JOIN `tabDelivery Note` dn
                    ON dn.name = dni.parent
                WHERE
                    dni.so_detail=%s
                    AND dn.docstatus=1
            """, (item.name,))[0][0] or 0

            balance_qty = max((item.qty or 0) - delivered_qty, 0)

            if delivered_qty <= 0:
                status = "Pending"
            elif delivered_qty < (item.qty or 0):
                status = "Partially Delivered"
            else:
                status = "Delivered"

            frappe.db.set_value(
                "Sales Order Item",
                item.name,
                {
                    "custom_delivery_qty": delivered_qty,
                    "custom_balance_qty": balance_qty,
                    "custom_delivery_status": status,
                },
                update_modified=False,
            )

            total_qty += delivered_qty
            total_amount += delivered_qty * (item.rate or 0)

        frappe.db.set_value(
            "Sales Order",
            so,
            {
                "custom_dc_qty": total_qty,
                "custom_dc_total": total_amount,
            },
            update_modified=False,
        )

        print(f"Updated {so}")

    frappe.db.commit()
    print("All Sales Orders updated successfully.")