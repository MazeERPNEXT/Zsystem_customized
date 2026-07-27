import frappe

def validate_supplier(self, method=None):
    if not self.gstin:
        return

    existing_supplier = frappe.db.exists(
        "Supplier",
        {
            "gstin": self.gstin,
            "name": ["!=", self.name]
        }
    )

    if existing_supplier:
        frappe.throw(
            f"A Supplier with GSTIN <b>{self.gstin}</b> already exists (<b>{existing_supplier}</b>). Duplicate Suppliers are not allowed."
        )