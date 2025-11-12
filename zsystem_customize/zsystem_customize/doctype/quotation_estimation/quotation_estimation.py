import frappe
import os
from frappe.model.mapper import get_mapped_doc
import datetime
import  json
from frappe.contacts.address_and_contact import load_address_and_contact
from io import BytesIO
from openpyxl import Workbook
from frappe.model.document import Document
from frappe.utils.xlsxutils import make_xlsx  # Import make_xlsx
from frappe.utils.response import build_response

class QuotationEstimation(Document):
    pass

@frappe.whitelist()
def get_excel_process(name):
    frappe.msgprint("Fetching Quotation Estimation Data")

    # Fetch data from child table
    quot_estimation = frappe.get_all(
        doctype="Quotation Estimation Child Table",
        filters={'parent': name},
        fields=[
            "part_no", "description", "qty", "cust_disc", "unit_lp", "total_lp",
            "unit_kp", "total_kp", "margin", "unit_price", "total_price", "remarks"
        ]
    )

    # Prepare data for Excel
    list_of_dicts = [
        ["SNO","Part No", "Description", "Qty", "Customer Discount", "Unit LP", "Total LP",
        "Unit KP", "Total KP", "Margin", "Unit Price", "Total Price", "Remarks"]
    ]
    
    total_lp_price = 0
    for i,item in enumerate(quot_estimation):
        unit_lp_cell = f"F{i+2}"
        cust_disc_cell = f"E{i+2}"
        qty_cell = f"D{i+2}"
        unit_kp_cell =f"H{i+2}"
        margin_cell = f"J{i+2}"
        unit_price_cell = f"K{i+2}"

        unit_kp_formula = f"=CEILING({unit_lp_cell}*(100-{cust_disc_cell})/100, 1)"
        total_lp_formula = f"={unit_lp_cell} *{qty_cell}"
        total_kp_formula = f"={unit_kp_cell} *{qty_cell}"
        unit_price_formula = f"=CEILING({unit_kp_cell}/{margin_cell}, 1)"
        total_price_formula = f"={qty_cell}*{unit_price_cell}"

        list_of_dicts.append([
            i+1,item.get("part_no"), item.get("description"), item.get("qty"),
            item.get("cust_disc"), item.get("unit_lp"), total_lp_formula,
            unit_kp_formula , total_kp_formula, item.get("margin"),
            unit_price_formula, total_price_formula, item.get("remarks")
        ])
        print("value",i)
    list_of_dicts.append(["Total","","","","","",f"=SUM(G2:G{i+2})","",f"=SUM(I2:I{i+2})","","",f"=SUM(L2:L{i+2})",""])

    # Generate Excel file using Frappe's make_xlsx function
    xlsx_file = make_xlsx(list_of_dicts, "Quotation Estimation")

    # Return as an HTTP response
    frappe.response['filename'] = "Quotation_Estimation.xlsx"
    frappe.response['filecontent'] = xlsx_file.getvalue()
    frappe.response['type'] = "binary"

    return build_response("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

##Update data from quotation estimation to quotation
@frappe.whitelist(allow_guest=True)
def quotation_estimation_to_quotation(source_name, target_doc=None):

    def update_items(source, target):
        """Fetch Item Name, UOM, and ensure Rate is copied"""
        for s_item, t_item in zip(source.items, target.items):
            if t_item.item_code:
                item_doc = frappe.get_doc("Item", t_item.item_code)
                t_item.item_name = item_doc.item_name
                t_item.uom = item_doc.stock_uom
                if not t_item.conversion_factor:
                    t_item.conversion_factor = 1

            # Ensure unit_lp is copied as rate
            if hasattr(s_item, "unit_lp"):
                t_item.rate = s_item.unit_lp or 0

    doclist = get_mapped_doc(
        "Quotation Estimation",
        source_name,
        {
            "Quotation Estimation": {
                "doctype": "Quotation",
                "field_map": {
                    "customer": "party_name",
                    "date": "transaction_date",
                },
                "validation": {"docstatus": ["=", 1]},
            },
            "Quotation Estimation Child Table": {
                "doctype": "Quotation Item",
                "field_map": {
                    "part_no": "item_code",
                    "description": "description",
                    "qty": "qty",
                    "unit_lp": "rate",
                },
            },
        },
        target_doc,
        after_save=False,
        postprocess=update_items,
    )

    return doclist

