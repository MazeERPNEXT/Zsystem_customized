import frappe

def set_default_warehouse(doc, method):
    if not doc.custom_warehouse:
        return

    company = frappe.defaults.get_global_default("company")

    existing = next(
        (d for d in doc.item_defaults if d.company == company),
        None
    )

    if existing:
        existing.default_warehouse = doc.custom_warehouse
    else:
        doc.append("item_defaults", {
            "company": company,
            "default_warehouse": doc.custom_warehouse
        })