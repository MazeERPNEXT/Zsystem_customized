import frappe
# get last purchase rate and date
@frappe.whitelist()
def get_last_purchase_detail(item_code,supplier=None):
    filters = {
        "item_code":item_code,
        "docstatus":1
    }
    if supplier:
        filters["supplier"] = supplier
    data = frappe.db.sql("""
        SELECT
            poi.rate,
            po.transaction_date
        FROM `tabPurchase Order Item` poi
        INNER JOIN `tabPurchase Order` po
            ON po.name = poi.parent
        WHERE
            poi.item_code = %(item_code)s
            AND po.docstatus = 1
            {supplier_condition}
        ORDER BY po.transaction_date DESC, po.creation DESC
        LIMIT 1
    """.format(
        supplier_condition="AND po.supplier=%(supplier)s" if supplier else ""
    ), filters, as_dict=True)

    return data[0] if data else {}

# //Validate so againsst po rate
def validate_so_rate(doc,method):
    for item in doc.items:
        if item.sales_order and item.item_code:
            so_rate = frappe.db.get_value("Sales Order Item",{"parent":item.sales_order,"item_code":item.item_code},"rate")
            if so_rate and item.rate >so_rate:
                frappe.throw(f"Row {item.idx}: Purchase Order Rate ({item.rate}) cannot be greater than Sales Order Rate ({so_rate}).")

# update po/material field based on so against po
def update_so_material_status(doc,method):
    sales_order = set()
    for item in doc.items:
        sales_order.add(item.sales_order)

    for so_name in sales_order:
        if (doc.status == "Followup"):
            frappe.db.set_value(
                "Sales Order",
                so_name,
                "custom_pomaterial_status",
                "Waiting for Material"
            )
        elif(doc.status == "Receive"):
            frappe.db.set_value(
                "Sales Order",
                so_name,
                "custom_pomaterial_status",
                "Material Receive"
            )