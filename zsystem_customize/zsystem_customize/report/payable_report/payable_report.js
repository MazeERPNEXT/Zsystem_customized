// Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Payable Report"] = {
    filters: [
        {
            label: __("Supplier"),
            fieldname: "supplier",
            fieldtype: "Link",
            options: "Supplier"
        },
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.add_months(
                frappe.datetime.get_today(), -1
            )
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.get_today()
        },
        {
            label: __("Payment Status"),
            fieldname: "payment_status",
            fieldtype: "Select",
            options: "\nPaid\nOutstanding",
            default: ""
        }
    ]
};