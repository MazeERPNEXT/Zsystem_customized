import frappe
from frappe import _
from frappe.utils import getdate, add_days, today,cint,formatdate,fmt_money

def send_docket_email(doc,method=None):
    if not doc.custom_docket_no:
        return
    
    if getattr(doc,"custom_docket_email_sent",0):
        return
    
    customer = frappe.get_doc("Customer",doc.customer)
    if not customer.custom_receiver_email_id:
        frappe.msgprint("Reciever Email ID is not set ")
        return
    
    subject = f"Docket Details - {doc.name}"
    message = f"""
    <p>Dear Customer,</p>

    <p>Please find the shipping details below:</p>

    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <tr style="font-weight: bold;">
            <td>Invoice No</td>
            <td>Date</td>
            <td>Customer</td>
            <td>Docket No</td>
            <td>Agent Name</td>
        </tr>
        <tr>
            <td>{doc.name}</td>
            <td>{doc.posting_date}</td>
            <td>{doc.customer}</td>
            <td>{doc.custom_docket_no}</td>
            <td>{doc.custom_agent_name}</td>
        </tr>
    </table>

    <br>

    <p style="font-weight: bold;">
        Thanks &amp; Regards,<br>
        Z System Intelligent Controls Pvt. Ltd.
    </p>
    """
    frappe.sendmail(
        recipients=[customer.custom_receiver_email_id], 
        subject = subject,
        message = message,
        reference_doctype = doc.doctype,
        reference_name = doc.name
    )
    doc.db_set("custom_docket_email_sent", 1, update_modified=False)


# Send remainder mail for 3days before and on the days

def send_payment_reminder():

    invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "docstatus": 1,
            "status": ["not in", ["Paid", "Cancelled"]],
        },
        fields=[
            "name",
            "customer",
            "posting_date",
            "custom_payment_days",
            "outstanding_amount",
        ],
    )

    today_date = getdate(today())

    for inv in invoices:

        if not inv.custom_payment_days:
            continue

        payment_days = cint(inv.custom_payment_days)
        due_date = add_days(inv.posting_date, payment_days)
        reminder_date = add_days(due_date, -3)

        if today_date == getdate(reminder_date):
            subject = f"Payment Reminder - Invoice {inv.name}"
            reminder_text = (
                "This is a friendly reminder that the payment for the following "
                "invoice is due in <b>3 days</b>."
            )

        elif today_date == getdate(due_date):
            subject = f"Payment Due Today - Invoice {inv.name}"
            reminder_text = (
                "This is a reminder that the payment for the following invoice "
                "is <b>due today</b>."
            )

        else:
            continue

        receiver = frappe.db.get_value(
            "Customer",
            inv.customer,
            ["custom_receiver_email_id", "custom_cc"],
            as_dict=True,
        )

        if not receiver or not receiver.custom_receiver_email_id:
            frappe.logger().info(
                f"No receiver email configured for Customer {inv.customer}"
            )
            continue

        message = f"""
            <p>Dear Customer,</p>

            <p>{reminder_text}</p>

            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                    <td><b>Invoice No</b></td>
                    <td><b>Posting Date</b></td>
                    <td><b>Due Date</b></td>
                    <td><b>Outstanding Amount</b></td>
                </tr>
                <tr>
                    <td>{inv.name}</td>
                    <td>{frappe.utils.formatdate(inv.posting_date, "dd-mm-yyyy") or ""}</td>
                    <td>{frappe.utils.formatdate(due_date, "dd-mm-yyyy") or ""}</td>
                    <td>{fmt_money(inv.outstanding_amount)}</td>
                </tr>
            </table>

            <br>

           <p>Please ignore this email if the payment has already been made.</p>

            <p style="font-weight:bold;">
                Thanks &amp; Regards,<br>
                Z System Intelligent Controls Pvt. Ltd.
            </p>
        """

        frappe.sendmail(
            recipients=[receiver.custom_receiver_email_id],
            cc=[receiver.custom_cc] if receiver.custom_cc else None,
            subject=subject,
            message=message,
        )

        frappe.logger().info(
            f"Payment reminder sent for Invoice {inv.name} to {receiver.custom_receiver_email_id}"
        )

# Sent Remainder for customer based on Returnable DC material Based on Exepected Closing Date
def send_returnabledc_remainder():

    today_date = getdate(today())

    delivery_data = frappe.get_all(
        "Delivery Note",
        filters={
            "docstatus": 1,
            "custom_returnable_dc": 1,
            "status": "Returnable DC",
        },
        fields=[
            "name",
            "customer",
            "custom_expected_closing_date",
            "custom_sales_person",
        ],
    )

    for dc in delivery_data:

        # Skip if Expected Closing Date is not set
        if not dc.custom_expected_closing_date:
            continue

        # Send email only on the Expected Closing Date
        remainder_date = add_days(dc.custom_expected_closing_date,-2)
        if today_date != getdate(dc.custom_expected_closing_date):
            continue

        # Customer Email
        receiver_email = frappe.db.get_value(
            "Customer",
            dc.customer,
            "custom_receiver_email_id",
        )

        # Sales Person Email
        sales_person_email = None
        if dc.custom_sales_person:
            sales_person_email = frappe.db.get_value(
                "Sales Person",
                dc.custom_sales_person,
                "custom_sales_person_email",
            )

        if not receiver_email:
            frappe.log_error(
                f"Receiver Email ID is not set for Customer {dc.customer}",
                "Returnable DC Reminder",
            )
            continue


        # Get Delivery Note Items
        items = frappe.get_all(
            "Delivery Note Item",
            filters={"parent": dc.name},
            fields=["item_code", "qty", "serial_no"],
        )

        # Build Item Table
        item_rows = ""
        for item in items:
            item_rows += f"""
                <tr>
                    <td>{item.item_code}</td>
                    <td align="right">{item.qty}</td>
                    <td>{item.serial_no or ""}</td>
                </tr>
            """

        subject = f"Returnable DC Reminder - {dc.name}"

        message = f"""
        <p>Dear Customer,</p>

        <p>
            This is a reminder that the
            <strong>Returnable Delivery Challan ({dc.name})</strong>
            has reached its <strong>Expected Closing Date</strong>
            (<strong>{formatdate(dc.custom_expected_closing_date)}</strong>).
        </p>

        <p>
            Kindly arrange to return the materials as soon as possible if they have not already been returned.
        </p>

        <h4>Delivery Note Details</h4>

        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
            <tr>
                <th>Delivery Note</th>
                <th>Customer</th>
                <th>Expected Closing Date</th>
            </tr>
            <tr>
                <td>{dc.name}</td>
                <td>{dc.customer}</td>
                <td>{formatdate(dc.custom_expected_closing_date)}</td>
            </tr>
        </table>

        <br>

        <h4>Item Details</h4>

        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:70%;">
            <tr>
                <th>Item Code</th>
                <th>Qty</th>
                <th>Serial No</th>
            </tr>
            {item_rows}
        </table>

        <br>

        <p>Please ignore this email if the materials have already been returned.</p>

        <p style="font-weight:bold;">
                Thanks &amp; Regards,<br>
                Z System Intelligent Controls Pvt. Ltd.
            </p>
        """

        recipients = [receiver_email]

        frappe.sendmail(
            recipients=recipients,
            cc = [sales_person_email],
            subject=subject,
            message=message,
        )