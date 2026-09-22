# Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ZsystemContactPerson(Document):
	pass


@frappe.whitelist()
def validate_contact_no(doc,method=None):
    mobile_no = doc.contact_person_no
    if not mobile_no or not mobile_no.strip().isdigit() or len(mobile_no.strip()) != 10:
        frappe.throw(("Please enter a valid 10-digit contact person number."),title=("Invalid contact person Number"))