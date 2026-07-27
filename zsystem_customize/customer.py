import frappe

def validate_customer(self, method=None):
    if not self.gstin:
        return

    existing_customer = frappe.db.exists(
        "Customer",
        {
            "gstin": self.gstin,
            "name": ["!=", self.name]
        }
    )

    if existing_customer:
        frappe.throw(
            f"A customer with GSTIN <b>{self.gstin}</b> already exists (<b>{existing_customer}</b>). Duplicate customers are not allowed."
        )