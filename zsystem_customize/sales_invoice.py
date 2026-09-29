import frappe
from frappe.utils import add_days

def set_due_date(doc,method=None):
    if doc.posting_date and doc.custom_payment_days:
        doc.due_date = add_days(doc.posting_date,int(doc.custom_payment_days))

def validate_update_stock(doc,method=None):
    if doc.update_stock !=1:
        frappe.throw("Kindly check the update stock check Box")