import frappe
from frappe.utils import today
from frappe.utils import flt

# create po against bom
@frappe.whitelist()
def get_purchase_order_data_from_bom(bom, selected_items):
    selected_items = frappe.parse_json(selected_items) or []

    if not selected_items:
        frappe.throw("Please select at least one BOM item.")

    bom_doc = frappe.get_doc("BOM", bom)
    items = []

    for row in bom_doc.items:
        if row.name not in selected_items:
            continue

        items.append({
            # Actual BOM Item child row ID
            "bom_item_row": row.name,

            "item_code": row.item_code,
            "item_name": row.item_name,
            "description": row.description,
            "qty": row.qty,
            "uom": row.uom,
            "stock_uom": row.stock_uom,
            "conversion_factor": row.conversion_factor or 1,
            "rate": row.rate or 0,
            "warehouse": row.source_warehouse,
            "sales_order": bom_doc.custom_sales_order_no,
            "schedule_date": getattr(row, "schedule_date", None) or today(),
            "bom": bom_doc.name,
        })

    if not items:
        frappe.throw("No selected BOM items found.")

    return {
        "company": bom_doc.company,
        "custom_sales_order_no": bom_doc.custom_sales_order_no,
        "items": items,
    }

# update value bom po field based on po created
def update_bom_purchase_order_no(doc, method=None):
    """Update only the selected BOM Item rows with the Purchase Order number."""

    for row in doc.items:
        bom_name = row.get("custom_bom_no") or row.get("bom")
        bom_item_row = row.get("custom_bom_item_row")

        if not bom_name or not bom_item_row:
            continue

        bom_item = frappe.db.get_value(
            "BOM Item",
            bom_item_row,
            ["name", "parent"],
            as_dict=True,
        )

        if not bom_item:
            frappe.log_error(
                f"BOM Item row {bom_item_row} does not exist. "
                f"Purchase Order: {doc.name}",
                "BOM Purchase Order Update",
            )
            continue

        if bom_item.parent != bom_name:
            frappe.log_error(
                f"BOM Item row {bom_item_row} belongs to "
                f"{bom_item.parent}, not {bom_name}.",
                "BOM Purchase Order Update",
            )
            continue

        frappe.db.set_value(
            "BOM Item",
            bom_item_row,
            "custom_purchase_order_no",
            doc.name,
            update_modified=False,
        )

# if delete row in bom that row releted po is cancelled
def cancel_po_when_bom_item_deleted(doc, method=None):
    """Cancel linked draft Purchase Orders when BOM rows are deleted."""

    if doc.is_new():
        return

    old_bom = frappe.get_doc("BOM", doc.name)

    current_row_names = {
        row.name for row in doc.items if row.name
    }

    for old_row in old_bom.items:
        if old_row.name in current_row_names:
            continue

        po_name = old_row.custom_purchase_order_no

        if not po_name:
            continue

        if not frappe.db.exists("Purchase Order", po_name):
            continue

        po = frappe.get_doc("Purchase Order", po_name)

        # Cancel only draft POs or submitted POs that ERPNext permits
        # to cancel. A draft PO can simply be deleted.
        if po.docstatus == 0:
            frappe.delete_doc("Purchase Order", po_name)
        elif po.docstatus == 1:
            po.cancel()

        # Clear the reference on the deleted BOM row if it still exists
        frappe.db.set_value(
            "BOM Item",
            old_row.name,
            "custom_purchase_order_no",
            None,
            update_modified=False,
        )

# //create material request based on bom data

@frappe.whitelist()
def get_material_request_data_from_bom(bom, selected_items):

    selected_items = frappe.parse_json(selected_items)

    if not selected_items:
        frappe.throw("Please select at least one item.")

    # Get BOM
    bom_doc = frappe.get_doc("BOM", bom)

    items = []

    for row in bom_doc.items:

        # Only selected BOM rows
        if row.name not in selected_items:
            continue

        # Get warehouse from Item Master
        item_warehouse = frappe.db.get_value(
            "Item",
            row.item_code,
            "custom_warehouse"
        )

        items.append({
            "item_code": row.item_code,
            "item_name": row.item_name,
            "description": row.description,
            "qty": row.qty,
            "uom": row.uom,
            "stock_uom": row.stock_uom,
            "conversion_factor": row.conversion_factor or 1,
            "rate": row.rate or 0,

            # Warehouse from Item Master
            "from_warehouse": item_warehouse,

            "schedule_date": (
                getattr(row, "schedule_date", None)
                or today()
            ),

            "bom": bom_doc.name
        })

    if not items:
        frappe.throw("No selected items found.")

    return {
        "company": bom_doc.company,
        "custom_sales_order_no": bom_doc.custom_sales_order_no,
        "custom_bom_no": bom_doc.name,
        "items": items
    }

# //after submit based on Sales Order No set the bom id
def bom_set_so_data(doc, method=None):
    if doc.docstatus != 1:
        return

    sales_order = doc.custom_sales_order_no

    if not sales_order:
        return

    # Get Sales Order
    so = frappe.get_value(
        "Sales Order",
        {"name": sales_order},
        ["name", "custom_bom_no"]
    )

    if not so:
        frappe.throw(f"Sales Order {sales_order} not found")

    # Set BOM number in Sales Order
    frappe.db.set_value(
        "Sales Order",
        sales_order,
        "custom_bom_no",
        doc.name,
        update_modified=False
    )

    # Get Sales Order Item rows
    so_items = frappe.get_all(
        "Sales Order Item",
        filters={
            "parent": sales_order,
            "item_code": doc.item
        },
        fields=["name", "item_code", "bom_no"]
    )

    # Update matching Sales Order Item
    for item in so_items:
        frappe.db.set_value(
            "Sales Order Item",
            item.name,
            "bom_no",
            doc.name,
            update_modified=False
        )

# if cancel bom the related so against bom is set empty
@frappe.whitelist()
def clear_bom_from_sales_order(bom):

    bom_doc = frappe.get_doc("BOM", bom)

    sales_order = bom_doc.custom_sales_order_no

    if not sales_order:
        frappe.throw("Sales Order No is not set in this BOM.")

    # Find Sales Order Items linked to this BOM
    so_items = frappe.get_all(
        "Sales Order Item",
        filters={
            "parent": sales_order,
            "bom_no": bom_doc.name
        },
        fields=["name"]
    )

    if not so_items:
        frappe.msgprint(
            f"No Sales Order Item found with BOM {bom_doc.name}."
        )
        return

    # Clear bom_no
    for item in so_items:
        frappe.db.set_value(
            "Sales Order Item",
            item.name,
            "bom_no",
            "",
            update_modified=False
        )

    # Also clear Sales Order custom BOM field
    frappe.db.set_value(
        "Sales Order",
        sales_order,
        "custom_bom_no",
        "",
        update_modified=False
    )

    frappe.db.commit()

    return {
        "sales_order": sales_order,
        "cleared_items": len(so_items)
    }

# //validate the estimate and total cost
def validate_estimate_and_totalcost(doc, method=None):
    total_amt = flt(doc.total_cost)
    estimate_amt = flt(doc.custom_estimate_cost)

    if total_amt > estimate_amt:
        frappe.throw(
            "Cannot submit BOM. Total Cost ({0}) is greater than Estimate Cost ({1}).".format(
                total_amt,
                estimate_amt
            )
        )