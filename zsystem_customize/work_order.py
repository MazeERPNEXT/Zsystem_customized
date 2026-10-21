
import frappe


def set_serial_batch_from_bom(doc, method=None):
    if not doc.bom_no:
        return

    bom_items = frappe.get_all(
        "BOM Item",
        filters={"parent": doc.bom_no},
        fields=[
            "item_code",
            "custom_serial_no",
            "custom_batch_no",
        ],
    )

    # Map BOM values by item code
    bom_item_map = {
        item.item_code: item
        for item in bom_items
    }

    for row in doc.required_items:
        bom_item = bom_item_map.get(row.item_code)

        if not bom_item:
            continue

        # Update custom fields, if they exist
        if row.meta.has_field("custom_serial_no"):
            row.custom_serial_no = bom_item.custom_serial_no

        if row.meta.has_field("custom_batch_no"):
            row.custom_batch_no = bom_item.custom_batch_no

        # Update standard fields shown in your screenshot
        if row.meta.has_field("serial_no"):
            row.serial_no = bom_item.custom_serial_no

        if row.meta.has_field("batch_no"):
            row.batch_no = bom_item.custom_batch_no
