import frappe
from frappe.utils import today
from frappe.utils import flt
from frappe.model.workflow import apply_workflow

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
    """Cancel linked Purchase Orders (and their Purchase Invoices) when BOM rows are deleted."""

    if doc.is_new():
        return

    old_bom = frappe.get_doc("BOM", doc.name)
    current_row_names = {row.name for row in doc.items if row.name}

    for old_row in old_bom.items:
        if old_row.name in current_row_names:
            continue

        po_name = old_row.custom_purchase_order_no
        if not po_name or not frappe.db.exists("Purchase Order", po_name):
            continue

        po = frappe.get_doc("Purchase Order", po_name)

        if po.docstatus == 2:
            continue

        # Invoices must go first, otherwise the PO is blocked by the link
        cancel_linked_purchase_invoices(po_name)

        po.reload()
        if po.docstatus == 0:
            frappe.delete_doc("Purchase Order", po_name)
        elif po.docstatus == 1:
            po.cancel()


def cancel_linked_purchase_invoices(po_name):
    pi_names = frappe.get_all(
        "Purchase Invoice Item",
        filters={"purchase_order": po_name, "docstatus": ["<", 2]},
        pluck="parent",
    )

    for pi_name in set(pi_names):
        pi = frappe.get_doc("Purchase Invoice", pi_name)

        if pi.docstatus == 1:
            pi.cancel()
        elif pi.docstatus == 0:
            frappe.delete_doc("Purchase Invoice", pi_name)

# //create material request based on bom data
@frappe.whitelist()
def get_material_request_data_from_bom(bom, selected_items):
    selected_items = frappe.parse_json(selected_items) or []

    if not selected_items:
        frappe.throw("Please select at least one BOM item.")

    bom_doc = frappe.get_doc("BOM", bom)
    items = []

    for row in bom_doc.items:
        if row.name not in selected_items:
            continue

        item_warehouse = frappe.db.get_value(
            "Item",
            row.item_code,
            "custom_warehouse"
        )

        items.append({
            "bom_item_row": row.name,
            "item_code": row.item_code,
            "item_name": row.item_name,
            "description": row.description,
            "qty": row.qty,
            "uom": row.uom,
            "stock_uom": row.stock_uom,
            "conversion_factor": row.conversion_factor or 1,
            "rate": row.rate or 0,
            "from_warehouse": item_warehouse,
            "schedule_date": today(),
        })

    if not items:
        frappe.throw("No selected items found.")

    return {
        "company": bom_doc.company,
        "custom_sales_order_no": bom_doc.custom_sales_order_no,
        "custom_bom_no": bom_doc.name,
        "items": items,
    }


def update_bom_material_request_no(doc, method=None):
    """Update only the selected BOM Item rows when an MR is submitted."""

    logger = frappe.logger("zsystem_customize")
    bom_name = doc.get("custom_bom_no")

    if not bom_name:
        logger.warning(
            f"Material Request {doc.name}: custom_bom_no is empty."
        )
        return

    for row in doc.items:
        bom_item_row = row.get("custom_bom_item_row")

        if not bom_item_row:
            logger.warning(
                f"Material Request {doc.name}: "
                f"custom_bom_item_row is empty for item {row.item_code}."
            )
            continue

        bom_item = frappe.db.get_value(
            "BOM Item",
            bom_item_row,
            ["name", "parent"],
            as_dict=True,
        )

        if not bom_item or bom_item.parent != bom_name:
            logger.warning(
                f"Material Request {doc.name}: BOM Item "
                f"{bom_item_row} does not belong to BOM {bom_name}."
            )
            continue

        frappe.db.set_value(
            "BOM Item",
            bom_item_row,
            "custom_material_request_no",
            doc.name,
            update_modified=False,
        )

        logger.info(
            f"Material Request {doc.name} linked to "
            f"BOM Item {bom_item_row} in BOM {bom_name}."
        )

# if delete row in bom that row releted mr is cancelled
# def cancel_linked_stock_entries(mr_name):
#     """Cancel/delete all active Stock Entries created against a Material Request."""

#     stock_entries = frappe.db.sql(
#         """
#         SELECT DISTINCT se.name, se.docstatus
#         FROM `tabStock Entry Detail` sed
#         JOIN `tabStock Entry` se ON se.name = sed.parent
#         WHERE sed.material_request = %s
#           AND se.docstatus < 2
#         """,
#         mr_name,
#         as_dict=True,
#     )

#     for row in stock_entries:
#         other_mr = frappe.db.exists(
#             "Stock Entry Detail",
#             {
#                 "parent": row.name,
#                 "material_request": ["not in", [mr_name, ""]],
#             },
#         )
#         if other_mr:
#             frappe.throw(
#                 _("Stock Entry {0} is also linked to other Material Requests. "
#                   "Please cancel it manually first.").format(row.name)
#             )

#         se = frappe.get_doc("Stock Entry", row.name)

#         if se.docstatus == 1:
#             se.cancel()
#         elif se.docstatus == 0:
#             frappe.delete_doc("Stock Entry", row.name)

#     # Make sure nothing active is left before the MR is touched
#     still_linked = frappe.db.sql(
#         """
#         SELECT se.name
#         FROM `tabStock Entry Detail` sed
#         JOIN `tabStock Entry` se ON se.name = sed.parent
#         WHERE sed.material_request = %s AND se.docstatus < 2
#         """,
#         mr_name,
#     )
#     if still_linked:
#         frappe.throw(
#             _("Stock Entry {0} is still linked to Material Request {1}").format(
#                 still_linked[0][0], mr_name
#             )
#         )
def cancel_linked_stock_entries(mr_name):
    """Cancel linked Stock Entries using their workflow."""

    stock_entries = frappe.db.sql(
        """
        SELECT DISTINCT se.name, se.docstatus
        FROM `tabStock Entry Detail` sed
        JOIN `tabStock Entry` se ON se.name = sed.parent
        WHERE sed.material_request = %s
          AND se.docstatus < 2
        """,
        (mr_name,),
        as_dict=True,
    )

    for row in stock_entries:
        se = frappe.get_doc("Stock Entry", row.name)

        # Draft Stock Entries can be deleted directly
        if se.docstatus == 0:
            frappe.delete_doc("Stock Entry", se.name)
            continue

        if se.docstatus != 1:
            continue

        # Use the Stock Entry workflow cancellation action
        workflow_state = se.get("workflow_state")

        if workflow_state == "Cancelled":
            continue

        try:
            apply_workflow(se, "Cancel")
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"Failed to cancel Stock Entry {se.name} "
                f"linked to Material Request {mr_name}",
            )
            raise


def cancel_mr_when_bom_item_deleted(doc, method=None):
    """Cancel or delete the Material Request linked to a deleted BOM Item."""

    if doc.is_new():
        return

    old_doc = doc.get_doc_before_save()
    if not old_doc:
        return

    current_rows = {row.name for row in doc.items if row.name}

    deleted_rows = [
        row for row in old_doc.items
        if row.name not in current_rows
        and row.get("custom_material_request_no")
    ]

    for row in deleted_rows:
        mr_name = row.custom_material_request_no

        if not frappe.db.exists("Material Request", mr_name):
            continue

        # Skip if another remaining BOM Item still references this MR
        remaining = frappe.db.exists(
            "BOM Item",
            {
                "parent": doc.name,
                "parenttype": "BOM",
                "custom_material_request_no": mr_name,
                "name": ["!=", row.name],
            },
        )

        if remaining:
            continue

        mr = frappe.get_doc("Material Request", mr_name)

        if mr.docstatus == 2:
            continue

        # Clear Stock Entries first, otherwise MR cancel throws a link error
        cancel_linked_stock_entries(mr_name)

        # Reload so the MR status reflects the cancelled Stock Entries
        mr.reload()

        if mr.docstatus == 1:
            mr.cancel()

        elif mr.docstatus == 0:
            frappe.delete_doc("Material Request", mr_name)

        frappe.logger("zsystem_customize").info(
            f"Processed Material Request {mr_name} after "
            f"BOM Item {row.name} was deleted from {doc.name}"
        )
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