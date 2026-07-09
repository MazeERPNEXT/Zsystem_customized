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

def update_so_material_status(doc, method):

    sales_orders = {d.sales_order for d in doc.items if d.sales_order}

    if doc.docstatus == 2:  # cancelled
        for so in sales_orders:
            frappe.db.set_value("Sales Order", so, "custom_pomaterial_status", "")
        return

    if doc.docstatus != 1:  # only act on submit
        return

    for so in sales_orders:
        frappe.db.set_value(
            "Sales Order", so, "custom_pomaterial_status", "Waiting for Material"
        )


def update_so_material_status_on_receipt(doc, method):
    po_item_names = {d.purchase_order_item for d in doc.items if d.purchase_order_item}
    if not po_item_names:
        return

    purchase_order_item = frappe.db.get_all(
        "Purchase Order Item",
        filters={"name": ["in", list(po_item_names)]},
        fields = ["parent","sales_order"]
    )
    sales_orders = {}

    for item in purchase_order_item:
        if not item.sales_order:
            continue
    po_status = frappe.db.get_value("Purchase Order",item.parent,"status")

    if doc.docstatus == 2:
        sales_orders[item.sales_order] = "Waiting for Material"
    else:
        if po_status == "Receive":
            sales_orders[item.sales_order] = "Material Receive"
        else:
            sales_orders[item.sales_order] = "Waiting for Material"


    for so, status in sales_orders.items():
        frappe.db.set_value("Sales Order", so, "custom_pomaterial_status", status)

# Direct po validate for if already have qty in stock
@frappe.whitelist()
def validate_stock_against_qty(doctype, name):
    doc = frappe.get_doc(doctype, name)
    error_rows = []

    for item in doc.items:
        if item.sales_order:
            return

        actual_qty = frappe.db.get_value(
            "Item",
            {"item_code": item.item_code},
            "custom_stock_qty"
        ) or 0

        if item.qty <= actual_qty:
            error_rows.append(f"""
                <tr>
                    <td>{item.item_code}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.qty}</td>
                    <td>{actual_qty}</td>
                </tr>
            """)

    if error_rows:
        html = f"""
            <h3>Already Stock for the following Items!</h3>
            <table class="table table-bordered" style="width:100%;margin-top:10px;font-size:13px">
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Warehouse</th>
                        <th>Required Qty</th>
                        <th>Available Qty</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(error_rows)}
                </tbody>
            </table>
            <br>
        """

        return {
            "has_error": True,
            "html": html
        }

    return {"has_error": False}