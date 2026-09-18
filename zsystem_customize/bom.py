import frappe
from frappe.utils import today


@frappe.whitelist()
def get_purchase_order_data_from_bom(bom, selected_items):

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

        items.append({
            "item_code": row.item_code,
            "item_name": row.item_name,
            "description": row.description,
            "qty": row.qty,
            "uom": row.uom,
            "stock_uom": row.stock_uom,
            "conversion_factor": row.conversion_factor or 1,
            "rate": row.rate or 0,
            "warehouse": row.source_warehouse,
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
        "custom_sales_order_no":bom_doc.custom_sales_order_no,
        "items": items
    }



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