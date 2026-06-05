import frappe

def execute():
    so_data = frappe.get_all(
        "Sales Order",
        filters={"status": "To Deliver and Bill"},
        pluck="name"
    )

    for so in so_data:
        frappe.db.set_value(
            "Sales Order",
            so,
            "status",
            "In Progress"
        )

    frappe.db.commit()
    print(f"Updated {len(so_data)} Sales Orders")