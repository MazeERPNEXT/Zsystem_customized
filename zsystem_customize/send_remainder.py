import frappe
from frappe.utils import escape_html

def send_stock_remainder(doc=None, method=None):

    # 1) Fetch all bins with item_code & warehouse
    bins = frappe.get_all(
        "Bin",
        fields=["item_code", "warehouse", "actual_qty"],
        limit_page_length=0,
        ignore_permissions=True
    )

    if not bins:
        return

    # 2) Fetch item-wise minimum level qty
    item_min_map = {
        i.name: (i.custom_min_level_qty or 0)
        for i in frappe.get_all(
            "Item",
            fields=["name", "custom_min_level_qty"],
            ignore_permissions=True
        )
    }

    rows = ""
    has_low_stock = False

    # 3) Compare actual_qty with item master min level
    for b in bins:
        item_code = b.get("item_code")
        actual_qty = b.get("actual_qty") or 0
        min_qty = item_min_map.get(item_code, 0)

        if min_qty and actual_qty < min_qty:
            has_low_stock = True
            rows += f"""
                <tr>
                    <td>{escape_html(item_code)}</td>
                    <td>{escape_html(b.get("warehouse") or "")}</td>
                    <td style="text-align:right;">{actual_qty}</td>
                    <td style="text-align:right;">{min_qty}</td>
                </tr>
            """

    if not has_low_stock:
        return

    # 4) Email body
    message = f"""
        <p>Hello Sir,</p>
        <p>Below items have stock less than their minimum stock level.</p>

        <table border="1" cellspacing="0" cellpadding="6">
            <thead>
                <tr>
                    <th>Item Code</th>
                    <th>Warehouse</th>
                    <th>Actual Qty</th>
                    <th>Min Level Qty</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>

        <p>Thank You & Regrets. <br>
        ERPNext</p>
    """

    # 5) Get Sales Manager users
    user_names = [
        r.parent for r in frappe.get_all(
            "Has Role",
            filters={"role": "Sales Manager"},
            fields=["parent"],
            ignore_permissions=True
        )
    ]

    if not user_names:
        return

    recipients = [
        u.email for u in frappe.get_all(
            "User",
            filters={"name": ["in", user_names], "enabled": 1},
            fields=["email"],
            ignore_permissions=True
        ) if u.email
    ]

    if not recipients:
        return

    # 6) Send email
    frappe.sendmail(
        recipients=recipients,
        subject="Low Stock Alert (Below Minimum Level)",
        message=message,
        reference_doctype="Bin"
    )


# send email with pdf
# import frappe
# from frappe.utils.pdf import get_pdf
# from frappe.utils import escape_html

# def send_stock_remainder(doc=None, method=None):

#     # 1) Fetch low-stock bins (actual_qty < 5)
#     bins = frappe.get_all(
#         "Bin",
#         filters=[["actual_qty", "<", 5]],
#         fields=["item_code", "warehouse", "actual_qty"],
#         limit_page_length=0,
#         ignore_permissions=True
#     )

#     if not bins:
#         return

#     # 2) Build table rows
#     rows = ""
#     for b in bins:
#         item_code = escape_html(b.get("item_code") or "")
#         warehouse = escape_html(b.get("warehouse") or "")
#         actual_qty = b.get("actual_qty") or 0

#         rows += f"""
#             <tr>
#                 <td>{item_code}</td>
#                 <td>{warehouse}</td>
#                 <td style='text-align:right;'>{actual_qty}</td>
#             </tr>
#         """

#     # 3) HTML → PDF (header repeat + no row break)
#     html_content = f"""
#         <style>
#             table {{
#                 width: 100%;
#                 border-collapse: collapse;
#             }}

#             th, td {{
#                 border: 1px solid #000;
#                 padding: 6px;
#                 font-size: 12px;
#             }}

#             /* Repeat header on every page */
#             thead {{
#                 display: table-header-group;
#             }}

#             tfoot {{
#                 display: table-footer-group;
#             }}

#             /* Prevent table row splitting */
#             tr {{
#                 page-break-inside: avoid !important;
#             }}
#         </style>

#         <h3>Low Stock Items (Below 5)</h3>

#         <table>
#             <thead>
#                 <tr>
#                     <th>Item Code</th>
#                     <th>Warehouse</th>
#                     <th>Actual Qty</th>
#                 </tr>
#             </thead>

#             <tbody>
#                 {rows}
#             </tbody>
#         </table>

#         <br><br>
#         <p style="text-align:center;">Generated automatically by ERPNext.</p>
#     """

#     # 4) Convert to PDF
#     pdf_data = get_pdf(html_content)

#     # 5) Get users with Sales Manager role
#     has_role_entries = frappe.get_all(
#         "Has Role",
#         filters={"role": "Sales Manager"},
#         fields=["parent"],
#         ignore_permissions=True
#     )
#     user_names = [r["parent"] for r in has_role_entries]

#     if not user_names:
#         return

#     # 6) Get email IDs of these users
#     user_emails = frappe.get_all(
#         "User",
#         filters=[["name", "in", user_names], ["enabled", "=", 1]],
#         fields=["email"],
#         ignore_permissions=True
#     )
#     recipients = [u["email"] for u in user_emails if u.get("email")]

#     if not recipients:
#         return

#     # 7) Send email with PDF attachment
#     frappe.sendmail(
#         recipients=recipients,
#         subject="Low Stock Alert (Below 5 Qty)",
#         message="""
#             <p>Hello Sir,</p>
#             <p>Please find the attached PDF containing items with stock below <b>5</b>.</p>
#             <p>Thank you & Regards,<br>
#             ERPNext Team</p>
#         """,
#         attachments=[{
#             "fname": "Low_Stock_Report.pdf",
#             "fcontent": pdf_data
#         }]
#     )



