# import frappe

# def validate_so_stock(doc, method):
#     """
#     Validate that Sales Order item qty is not greater than actual_qty
#     available in the Bin for the given warehouse.
#     """
#     error_rows = []

#     for item in doc.items:

#         # Warehouse required
#         if not item.warehouse:
#             frappe.throw(
#                 f"Please select a Warehouse for item <b>{item.item_code}</b>"
#             )

#         # Fetch Bin stock
#         actual_qty = frappe.db.get_value(
#             "Bin",
#             {"item_code": item.item_code, "warehouse": item.warehouse},
#             "actual_qty"
#         ) or 0

#         actual_qty = float(actual_qty)
#         ordered_qty = float(item.qty or 0)

#         # If insufficient, store details instead of throwing immediately
#         if ordered_qty > actual_qty:
#             error_rows.append(
#                 f"""
#                 <tr>
#                     <td>{item.item_code}</td>
#                     <td>{item.warehouse}</td>
#                     <td>{ordered_qty}</td>
#                     <td>{actual_qty}</td>
#                 </tr>
#                 """
#             )

#     # After loop → if any errors, throw one combined message
#     if error_rows:
#         message = f"""
#             <h3> Insufficient Stock for the following Items !</h3>
#             <table class="table table-bordered" style="width: 100%; margin-top:10px;font-size:13px">
#                 <thead>
#                     <tr>
#                         <th>Item Code</th>
#                         <th>Warehouse</th>
#                         <th>Required Qty</th>
#                         <th>Available Qty</th>
#                     </tr>
#                 </thead>
#                 <tbody>
#                     {''.join(error_rows)}
#                 </tbody>
#             </table>
#             <br>
#             <b>Are you submit this Sales Order.</b>
#             <button class="btn btn-primary btn-sm primary-action">Yes</button> <button class="btn btn-primary btn-sm primary-action">No</button>
#         """
#         frappe.throw(message)
import frappe
import re

@frappe.whitelist()
def validate_so_stock(doctype, name):
    doc = frappe.get_doc(doctype, name)
    error_rows = []

    for item in doc.items:
        if not item.warehouse:
            frappe.throw(
                f"Please select a Warehouse for item <b>{item.item_code}</b>"
            )

        actual_qty = frappe.db.get_value(
            "Bin",
            {"item_code": item.item_code, "warehouse": item.warehouse},
            "actual_qty"
        ) or 0

        if item.qty > actual_qty:
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
            <h3>Insufficient Stock for the following Items!</h3>
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
            <b>Do you want to submit this Sales Order?</b>
        """

        return {
            "has_error": True,
            "html": html
        }

    return {"has_error": False}

import frappe

@frappe.whitelist()
def get_last_sales_order_details(customer, item_code, current_so=None):
    if not customer or not item_code:
        return {}

    result = frappe.db.sql("""
        SELECT
            soi.rate,
            so.transaction_date
        FROM
            `tabSales Order Item` soi
        INNER JOIN
            `tabSales Order` so ON so.name = soi.parent
        WHERE
            so.customer = %s
            AND soi.item_code = %s
            AND so.docstatus = 1
            AND (%s = '' OR so.name != %s)
        ORDER BY
            so.transaction_date DESC,
            so.creation DESC
        LIMIT 1
    """, (customer, item_code, current_so or "", current_so or ""), as_dict=True)

    return result[0] if result else {}



# Same time cancel and amend relate revision
@frappe.whitelist()
def create_amended_with_revision(sales_order):
    """
    Cancels already cancelled SO and creates amended SO
    with custom revision naming: RO → R1 → R2 → R3
    """

    old = frappe.get_doc("Sales Order", sales_order)

    if old.docstatus != 2:
        frappe.throw("Sales Order must be cancelled before amendment")

    # Prevent multiple amendments from same doc
    if frappe.db.exists("Sales Order", {"amended_from": old.name}):
        frappe.throw("This Sales Order is already amended")

    # Copy document
    new_doc = frappe.copy_doc(old)
    new_doc.amended_from = old.name
    new_doc.docstatus = 0

    # ---------------- REVISION LOGIC ----------------
    old_name = old.name

    # Case 1: Already revised (R1, R2...)
    match = re.search(r"-R(\d+)$", old_name)
    if match:
        rev_no = int(match.group(1)) + 1
        new_name = re.sub(r"-R\d+$", f"-R{rev_no}", old_name)

    # Case 2: First amendment (RO → R1)
    else:
        if old_name.endswith("-RO"):
            new_name = old_name.replace("-RO", "-R1")
        else:
            new_name = f"{old_name}-R1"

    # Set custom name
    new_doc.name = new_name
    new_doc.flags.ignore_permissions = True
    new_doc.flags.ignore_mandatory = True

    # Insert new amended SO
    new_doc.insert()

    frappe.db.commit()

    return {
        "name": new_doc.name
    }