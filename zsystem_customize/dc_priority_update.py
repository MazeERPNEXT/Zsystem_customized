import frappe

def execute():
    priority_map = {
        "High": 1,
        "Medium": 2,
        "Low": 3
    }

    for dn in frappe.get_all(
        "Delivery Note",
        filters={"docstatus": ["in", [0, 1]]},
        fields=["name", "custom_priority"]
    ):
        frappe.db.set_value(
            "Delivery Note",
            dn.name,
            "custom_priority_order",
            priority_map.get(dn.custom_priority, 99),
            update_modified=False
        )

    frappe.db.commit()