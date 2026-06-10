import frappe

@frappe.whitelist()
def get_customer_contact_address(customer):

    contact = frappe.db.sql("""
        SELECT dl.parent
        FROM `tabDynamic Link` dl
        WHERE dl.link_doctype='Customer'
        AND dl.link_name=%s
        AND dl.parenttype='Contact'
        LIMIT 1
    """, customer, as_dict=True)

    address = frappe.db.sql("""
        SELECT dl.parent
        FROM `tabDynamic Link` dl
        WHERE dl.link_doctype='Customer'
        AND dl.link_name=%s
        AND dl.parenttype='Address'
        LIMIT 1
    """, customer, as_dict=True)

    return {
        "contact": contact[0].parent if contact else "",
        "address": address[0].parent if address else ""
    }