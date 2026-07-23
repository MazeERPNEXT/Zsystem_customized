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

# //set last
@frappe.whitelist()
def get_top_purchase_rates(item_code):
    rates = frappe.db.sql("""
        SELECT DISTINCT poi.rate
        FROM `tabPurchase Order Item` poi
        INNER JOIN `tabPurchase Order` po
            ON po.name = poi.parent
        WHERE
            poi.item_code = %s
            AND po.docstatus = 1
        ORDER BY poi.rate DESC
        LIMIT 3
    """, (item_code,), as_dict=True)

    return [d.rate for d in rates]