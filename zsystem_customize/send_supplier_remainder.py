import frappe
from frappe.utils import getdate, add_days, today, cint, fmt_money, formatdate


def send_remainder_zsystem():
    purchase_invoices = frappe.get_all(
        "Purchase Invoice",
        filters={
            "docstatus": 1,
            "status": ["not in", ["Paid", "Cancelled"]],
        },
        fields=[
            "name",
            "supplier",
            "due_date",
            "outstanding_amount",
            "posting_date",
            "custom_payment_days",
        ],
    )

    today_date = getdate(today())

    for pi in purchase_invoices:

        receiver_email = frappe.db.get_value(
            "Supplier",
            pi.supplier,
            "custom_receiver_email_id"
        )

        if not receiver_email:
            frappe.logger().info(
                f"No receiver email found for Supplier {pi.supplier}"
            )
            continue

        payment_days = cint(pi.custom_payment_days or 0)
        due_date = add_days(pi.posting_date, payment_days)
        reminder_date = add_days(due_date, -3)

        if today_date == getdate(reminder_date):
            subject = f"Payment Reminder - Invoice {pi.name}"
            reminder_text = (
                "This is a friendly reminder that the payment for the following "
                "invoice is due in <b>3 days</b>."
            )

        elif today_date == getdate(due_date):
            subject = f"Payment Due Today - Invoice {pi.name}"
            reminder_text = (
                "This is a reminder that the payment for the following invoice "
                "is <b>due today</b>."
            )

        else:
            continue

        message = f"""
        <p>Dear Sir,</p>

        <p>{reminder_text}</p>

        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
            <tr>
                <th>Invoice No</th>
                <th>Posting Date</th>
                <th>Due Date</th>
                <th>Outstanding Amount</th>
            </tr>
            <tr>
                <td>{pi.name}</td>
                <td>{formatdate(pi.posting_date, "dd-MM-yyyy")}</td>
                <td>{formatdate(due_date, "dd-MM-yyyy")}</td>
                <td>{fmt_money(pi.outstanding_amount)}</td>
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
            recipients=[receiver_email],
            subject=subject,
            message=message,
        )

        frappe.logger().info(
            f"Payment reminder sent for Invoice {pi.name} to {receiver_email}"
        )