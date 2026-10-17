
import frappe


def update_bom_serial_batch(doc, method=None):
    for row in doc.items:
        if not row.material_request_item:
            continue

        mr_item = frappe.db.get_value(
            "Material Request Item",
            row.material_request_item,
            ["custom_bom_item_row", "custom_serial_no", "custom_batch_no"],
            as_dict=True,
        )
        if not mr_item or not mr_item.custom_bom_item_row:
            continue

        values = {}
        if mr_item.custom_serial_no:
            values["custom_serial_no"] = mr_item.custom_serial_no
        if mr_item.custom_batch_no:
            values["custom_batch_no"] = mr_item.custom_batch_no

        if values:
            frappe.db.set_value("BOM Item", mr_item.custom_bom_item_row, values, update_modified=False)