import frappe
from frappe import _
from frappe.utils import (add_days,cint,date_diff,fmt_money,formatdate,getdate,today,)

def send_docket_email(doc,method=None):
    if not doc.custom_docket_no:
        return
    
    if getattr(doc,"custom_docket_email_sent",0):
        return
    
    customer = frappe.get_doc("Customer",doc.customer)
    if not customer.custom_receiver_email_id:
        frappe.msgprint("Reciever Email ID is not set ")
        return

    dn = frappe.db.sql("""
        SELECT DISTINCT
            dni.parent AS delivery_note,
            dn.posting_date
        FROM `tabSales Invoice Item` sii
        INNER JOIN `tabDelivery Note Item` dni
            ON sii.dn_detail = dni.name
        INNER JOIN `tabDelivery Note` dn
            ON dn.name = dni.parent
        WHERE sii.parent = %s
        LIMIT 1
    """, (doc.name,), as_dict=True)
    if dn:
        delivery_note = dn[0].delivery_note
        delivery_date = frappe.utils.formatdate(dn[0].posting_date)

    subject = f"Docket Details - {doc.name}"

    message = f"""
    <p>Dear Customer,</p>

    <p>
        Kindly find the below mentioned dispatched details for your reference.
    </p>

    <p>
        The original invoice is enclosed inside the box, and a copy of the invoice is attached to this email.
    </p>

    <p>
        Kindly acknowledge receipt of the items and confirm that the GRN has been completed.
    </p>

    <br>

    <table border="1" cellpadding="6" cellspacing="0"
        style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">

        <tr style="font-weight:bold;background-color:#f2f2f2;">
            <th align="left">DC/Invoice Date</th>
            <th align="left">DC/Invoice No.</th>
            <th align="left">PO No.</th>
            <th align="left">PO Date</th>
            <th align="left">Dispatch Date</th>
            <th align="left">Sent Through</th>
            <th align="left">Docket No.</th>
            <th align="left">Buyer Name</th>
            <th align="right">Value</th>
        </tr>

        <tr>
            <td>{delivery_date}</td>
            <td>{delivery_note}</td>
            <td>{doc.po_no or ""}</td>
            <td>{frappe.utils.formatdate(doc.po_date) if doc.po_date else ""}</td>
            <td>{frappe.utils.formatdate(doc.posting_date) if doc.posting_date else ""}</td>
            <td>{doc.custom_agent_name or ""}</td>
            <td>{doc.custom_docket_no or ""}</td>
            <td>{doc.customer}</td>
            <td align="right">{frappe.utils.fmt_money(doc.grand_total, currency=doc.currency)}</td>
        </tr>

    </table>

    <br><br>

    <p style="color:red;font-weight:bold;">
        This is an automated email. Please do not reply to this message.
    </p>

    <p>
        If you have any questions or require further clarification, please do not hesitate to contact us at
        Phone: +91 63851 99657 / +91 98403 61657
        or Email:
        <a href="mailto:vivek.s@zsystem.in">vivek.s@zsystem.in</a> /
        <a href="mailto:zproposal@zsystem.in">zproposal@zsystem.in</a>.
    </p>

    <p>
        <strong>Thanks &amp; Regards,</strong><br>
        Z System Intelligent Controls Pvt. Ltd.
    </p>
    """
    frappe.sendmail(
        recipients=[customer.custom_receiver_email_id], 
        subject = subject,
        message = message,
        reference_doctype = doc.doctype,
        reference_name = doc.name,
    )
    doc.db_set("custom_docket_email_sent", 1, update_modified=False)


# Send remainder mail for 3days before and on the days

def send_payment_reminder():

    invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "docstatus": 1,
            "status": ["not in", ["Paid", "Cancelled"]],
            "outstanding_amount": [">", 0],
        },
        fields=[
            "name",
            "customer",
            "posting_date",
            "custom_payment_days",
            "outstanding_amount",
            "grand_total",
            "rounded_total",
            "disable_rounded_total"
        ],
    )

    today_date = getdate(today())

    for inv in invoices:
        if not inv.custom_payment_days:
            continue

        payment_days = cint(inv.custom_payment_days or 0)

        # Skip invoices with no valid credit period
        if payment_days <= 0:
            continue

        due_date = add_days(inv.posting_date, payment_days)

        # Days difference
        # -2 = 2 days before due date
        #  1 = 1 day overdue
        receiver = frappe.db.get_value(
                    "Customer",
                    inv.customer,
                    ["custom_receiver_email_id", "custom_cc","custom_days_before_sent_email"],
                    as_dict=True,
                )
        days_difference = date_diff(today_date, due_date)
        days_before = cint(receiver.custom_days_before_sent_email or 2)

        if days_difference == -days_before:
            subject = "Payment Reminder – Invoice Due for Payment"

            intro = f"""

                <p>Dear Sir/Madam</p>

                <p>
                    For your information, the below-mentioned invoice will become due within the next <b>{days_before} days</b>.
                </p>

                <p>
                    We kindly request you to arrange the payment within the agreed credit period terms.
                </p>

                <p>
                    Thank you for your timely support and cooperation.
                </p>
            """

            last_column = f"<td>{formatdate(due_date,'dd-MM-yyyy')}</td>"
            last_header = "<th>Due Date</th>"

        elif days_difference == 1:
            subject = "Overdue Payment Reminder"

            intro = f"""
                <h3><u>Overdue Payment Reminder</u></h3>

                <p>Dear Sir/Madam</p>

                <p>
                    Kindly find the overdue payment details below for your reference.
                </p>

                <p>
                    We request you to arrange payment and clear the outstanding amount at the earliest.
                </p>

                <p>
                    Thanks for your support and cooperation.
                </p>
            """

            last_column = f"<td>{days_difference}</td>"
            last_header = "<th>Overall Due Days</th>"

        else:
            continue

       

        if not receiver or not receiver.custom_receiver_email_id:
            frappe.logger().info(
                f"No receiver email configured for Customer {inv.customer}"
            )
            continue

        if inv.disable_rounded_total == 1:
            payment_received = inv.grand_total - inv.outstanding_amount
            invoice_amount = inv.grand_total 
        else:
            payment_received = inv.rounded_total - inv.outstanding_amount
            invoice_amount = inv.rounded_total 

        message = f"""
            {intro}

            <table border="1" cellpadding="6" cellspacing="0"
                style="border-collapse:collapse;width:100%;">

                <thead>
                    <tr style="background:#f2f2f2;">
                        <th>Date</th>
                        <th>Invoice No.</th>
                        <th>Buyer</th>
                        <th>Invoice Amount</th>
                        <th>Payment Received</th>
                        <th>Balance</th>
                        {last_header}
                    </tr>
                </thead>

                <tbody>
                    <tr>
                        <td>{formatdate(inv.posting_date,'dd-MM-yyyy')}</td>
                        <td>{inv.name}</td>
                        <td>{inv.customer}</td>
                        <td>{fmt_money(invoice_amount)}</td>
                        <td>{fmt_money(payment_received)}</td>
                        <td>{fmt_money(inv.outstanding_amount)}</td>
                        {last_column}
                    </tr>
                </tbody>

                <tfoot>
                    <tr>
                        <td colspan="5" align="right">
                            <b>Total Outstanding Payment</b>
                        </td>
                        <td colspan="2">
                            <b>{fmt_money(inv.outstanding_amount)}</b>
                        </td>
                    </tr>
                </tfoot>

            </table>

            <br>
        """

        if days_difference == -2:
            message += """
                <p>
                    Kindly ignore this email, if you already made the payment against this invoice.
                </p>
            """

        message += """
            <p style="color:red;">
                <b>This is an automated email. Please do not reply to this message.</b>
            </p>

            <p>
                If you have any questions or require further clarification,
                please do not hesitate to contact us at
                Phone: +91 63851 99657 / +91 98403 61657
                <br>
                Email:
               <a href="mailto:vivek.s@zsystem.in"> vivek.s@zsystem.in </a> /
               <a href="mailto:zproposal@zsystem.in"> zproposal@zsystem.in </a>
            </p>
        """

        frappe.sendmail(
            recipients=[receiver.custom_receiver_email_id],
            cc=[receiver.custom_cc] if receiver.custom_cc else None,
            subject=subject,
            message=message,
        )

        frappe.logger().info(
            f"Payment reminder sent for Invoice {inv.name}"
        )

# Sent Remainder for customer based on Returnable DC material Based on Exepected Closing Date
import frappe
from frappe.utils import getdate, today, add_days, formatdate


def send_returnabledc_remainder():

    today_date = getdate(today())

    delivery_data = frappe.get_all(
        "Delivery Note",
        filters={
            "docstatus": 1,
            "custom_returnable_dc": 1,
            "status": "Outstanding Item",
        },
        fields=[
            "name",
            "customer",
            "posting_date",
            "custom_expected_closing_date",
            "custom_sales_person",
        ],
    )

    for dc in delivery_data:

        if not dc.custom_expected_closing_date:
            continue

        # Send reminder 1 day after Expected Closing Date
        reminder_date = add_days(getdate(dc.custom_expected_closing_date), 1)

        if today_date != reminder_date:
            continue

        # Customer Email
        receiver_email = frappe.db.get_value(
            "Customer",
            dc.customer,
            "custom_receiver_email_id",
        )

        if not receiver_email:
            frappe.log_error(
                f"Receiver Email ID is not set for Customer {dc.customer}",
                "Returnable DC Reminder",
            )
            continue

        # Sales Person Email
        sales_person_email = None
        if dc.custom_sales_person:
            sales_person_email = frappe.db.get_value(
                "Sales Person",
                dc.custom_sales_person,
                "custom_sales_person_email",
            )

        # Delivery Note Items
        items = frappe.get_all(
            "Delivery Note Item",
            filters={"parent": dc.name},
            fields=["item_code", "qty"],
        )

        table_rows = ""

        for item in items:
            table_rows += f"""
            <tr>
                <td>{dc.customer}</td>
                <td>{formatdate(dc.posting_date)}</td>
                <td>{dc.name}</td>
                <td>{formatdate(dc.custom_expected_closing_date)}</td>
                <td>{item.item_code}</td>
                <td align="right">{item.qty}</td>
            </tr>
            """

        subject = f"Returnable Delivery Challan Reminder - {dc.name}"

        message = f"""
        <p>Dear Customer,</p>

        <p>Greetings from <b>Z-System!!!</b></p>

        <p>
            This is a friendly reminder that the
            <b>Returnable Delivery Challan ({dc.name})</b>
            reached its expected closing date on
            <b>{formatdate(dc.custom_expected_closing_date)}</b>.
        </p>

        <p>
            If the materials have not yet been returned, kindly arrange to return them at the earliest.
            If they have already been returned, please ignore this email.
        </p>

        <p>Thank you for your cooperation.</p>

        <br>

        <table border="1" cellpadding="6" cellspacing="0"
            style="border-collapse:collapse;width:100%;font-size:13px;">

            <tr style="background:#f2f2f2;font-weight:bold;">
                <th>Customer Name</th>
                <th>Delivery Date</th>
                <th>DC Number</th>
                <th>Expected Closing Date</th>
                <th>Item</th>
                <th>Qty</th>
            </tr>

            {table_rows}

        </table>

        <br><br>

        <p>
            Thanks &amp; Regards,<br>
            <b>Z System Intelligent Controls Pvt. Ltd.</b>
        </p>
        """

        frappe.sendmail(
            recipients=[sales_person_email] if sales_person_email else None,
            subject=subject,
            message=message,
        )