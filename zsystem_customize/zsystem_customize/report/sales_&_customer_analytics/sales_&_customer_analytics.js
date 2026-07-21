// Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Sales & Customer Analytics"] = {
	filters: [
        {
            label: __("Customer"),
            fieldname: "customer",
            fieldtype: "Link",
            options: "Customer"
        },
        {
            label: __("From Date"),
            fieldname: "from_date",
            fieldtype: "Date",
            default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            reqd: 1
        },
        {
            label: __("To Date"),
            fieldname: "to_date",
            fieldtype: "Date",
            default: frappe.datetime.get_today(),
            reqd: 1
        },
        {
            label: __("Category"),
            fieldname: "category",
            fieldtype: "Select",
            options: "Order\nCustomer",
            default: "Order",
            on_change: function(report) {
                toggle_filters(report);
                report.refresh();
            }
        }
    ],

    onload: function(report) {
        toggle_filters(report);
    }
};

function toggle_filters(report) {

    report.get_filter("from_date");
    report.get_filter("to_date");
}

