import frappe
from frappe.utils import add_days

def set_due_date(doc,method=None):
    if doc.posting_date and doc.custom_payment_days:
        doc.due_date = add_days(doc.posting_date,int(doc.custom_payment_days))