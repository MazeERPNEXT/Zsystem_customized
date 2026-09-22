import frappe
# get last purchase rate and date

import frappe

@frappe.whitelist()
def get_last_purchase_detail(item_code, supplier):
    if not supplier:
        return {}

    data = frappe.db.sql("""
        SELECT
            pii.rate,
            pi.posting_date
        FROM `tabPurchase Invoice Item` pii
        INNER JOIN `tabPurchase Invoice` pi
            ON pi.name = pii.parent
        WHERE
            pii.item_code = %(item_code)s
            AND pi.supplier = %(supplier)s
            AND pi.docstatus = 1
        ORDER BY
            pi.posting_date DESC,
            pi.creation DESC
        LIMIT 1
    """, {
        "item_code": item_code,
        "supplier": supplier
    }, as_dict=True)

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
    sales_orders = set()

    # ---------------------------------------------------------
    # Purchase Receipt
    # ---------------------------------------------------------
    if doc.doctype == "Purchase Receipt":

        for item in doc.items:
            if not item.purchase_order:
                continue

            po_items = frappe.db.get_all(
                "Purchase Order Item",
                filters={
                    "parent": item.purchase_order,
                    "sales_order": ["is", "set"]
                },
                fields=["sales_order"]
            )

            for po_item in po_items:
                if po_item.sales_order:
                    sales_orders.add(po_item.sales_order)

        # Cancelled Purchase Receipt
        if doc.docstatus == 2:
            status = "Waiting for Material"
        else:
            status = "Material Receive"

    # ---------------------------------------------------------
    # Purchase Invoice
    # ---------------------------------------------------------
    elif doc.doctype == "Purchase Invoice":

        # Only consider Purchase Invoice if Update Stock is checked
        if not doc.update_stock:
            return

        for item in doc.items:
            if not item.purchase_order:
                continue

            po_items = frappe.db.get_all(
                "Purchase Order Item",
                filters={
                    "parent": item.purchase_order,
                    "sales_order": ["is", "set"]
                },
                fields=["sales_order"]
            )

            for po_item in po_items:
                if po_item.sales_order:
                    sales_orders.add(po_item.sales_order)

        # Cancelled Purchase Invoice
        if doc.docstatus == 2:
            status = "Waiting for Material"
        else:
            status = "Material Receive"

    else:
        return

    # ---------------------------------------------------------
    # Update Sales Order
    # ---------------------------------------------------------
    for sales_order in sales_orders:
        frappe.db.set_value(
            "Sales Order",
            sales_order,
            "custom_pomaterial_status",
            status
        )

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

# //validate contact person no
def validate_contact_no(doc,method=None):
    mobile_no = doc.custom_contact_no
    if not mobile_no or not mobile_no.strip().isdigit() or len(mobile_no.strip()) != 10:
        frappe.throw(("Please enter a valid 10-digit contact person number."),title=("Invalid contact person Number"))
    
