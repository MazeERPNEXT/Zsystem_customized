import frappe
import json
from frappe import _
from erpnext.stock.doctype.delivery_note.delivery_note import make_sales_invoice as original_make_sales_invoice

@frappe.whitelist()
def make_sales_invoice(source_name, target_doc=None, args=None):
    # Handle args safely
    if args is None:
        args = {}
    if isinstance(args, str):
        args = json.loads(args)

    # Call original ERPNext method
    doc = original_make_sales_invoice(source_name, target_doc, args)

    # Loop through Sales Invoice Items
    for item in doc.items:
        if not item.dn_detail:
            continue

        serial_numbers = []

        try:
            # Get Delivery Note Item
            dn_item = frappe.get_doc("Delivery Note Item", item.dn_detail)

            # -----------------------------
            # Case 1: Direct Serial No
            # -----------------------------
            if dn_item.serial_no:
                raw_serials = dn_item.serial_no.strip()

                # Convert comma OR newline → list
                if "," in raw_serials:
                    serial_numbers.extend([
                        s.strip() for s in raw_serials.split(",") if s.strip()
                    ])
                else:
                    serial_numbers.extend([
                        s.strip() for s in raw_serials.split("\n") if s.strip()
                    ])

            # -----------------------------
            # Case 2: Serial & Batch Bundle
            # -----------------------------
            elif dn_item.serial_and_batch_bundle:
                bundle = frappe.get_doc(
                    "Serial and Batch Bundle",
                    dn_item.serial_and_batch_bundle
                )

                serial_numbers.extend([
                    entry.serial_no.strip()
                    for entry in bundle.entries
                    if entry.serial_no
                ])

        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Serial Number Fetch Error"
            )

        # -----------------------------
        # Remove duplicates (important)
        # -----------------------------
        serial_numbers = list(dict.fromkeys(serial_numbers))

        # -----------------------------
        # Final formatting (line-by-line)
        # -----------------------------
        if serial_numbers:
            item.custom_item_serial_no = "\n".join(serial_numbers)

    return doc

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

        so_doc = frappe.db.get_value(
            "Sales Order Item",
            so_detail,
            ["qty", "parent"],
            as_dict=True,
        )

        if not so_doc:
            continue

        so_qty = so_doc.qty or 0

        delivered_qty = frappe.db.sql(
            """
            SELECT COALESCE(SUM(dni.qty),0)
            FROM `tabDelivery Note Item` dni
            INNER JOIN `tabDelivery Note` dn
                ON dn.name = dni.parent
            WHERE
                dni.so_detail = %s
                AND dn.docstatus = 1
            """,
            (so_detail,),
        )[0][0] or 0

        balance_qty = max(so_qty - delivered_qty, 0)

        if delivered_qty == 0:
            status = "Not Delivered"
        elif delivered_qty < so_qty:
            status = "Partially Delivered"
        else:
            status = "Delivered"

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