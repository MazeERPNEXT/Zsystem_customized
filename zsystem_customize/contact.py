
import frappe
import re

def validate_mobile_no(doc, method):
    for row in doc.phone_nos:
        if row.phone and row.is_primary_mobile_no:
            phone = str(row.phone).strip()

            if not re.fullmatch(r"\d{10}", phone):
                frappe.throw(
                    "Primary mobile number must contain exactly 10 digits without spaces."
                )
