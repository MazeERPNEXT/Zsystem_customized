import frappe

def execute():
    so_data = frappe.get_all(
        "Delivery Note",
        filters={"status": "Returnable DC"},
        pluck="name"
    )

    for so in so_data:
        frappe.db.set_value(
            "Delivery Note",
            so,
            "status",
            "Outstanding Item"
        )

    frappe.db.commit()
    print(f"Updated {len(so_data)} Delivery Note")