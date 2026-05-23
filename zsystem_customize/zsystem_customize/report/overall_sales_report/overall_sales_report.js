// Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Overall Sales Report"] = {
    filters: [
        {
            fieldname: "name",
            label: "ID",
            fieldtype: "Data"
        },

        {
            fieldname: "customer",
            label: "Customer",
            fieldtype: "Link",
            options: "Customer"
        },

        {
            fieldname: "doctype",
            label: "Doctype",
            fieldtype: "Select",
            options: [
                "",
                "Sales Order",
                "Sales Invoice",
                "Delivery Note",
                "Returnable DC"
            ],

            on_change: function(report) {

                let doctype = report.get_filter_value("doctype");
                let status_filter = report.get_filter("status");

                let options = [""];

                // Sales Order Status
                if (doctype === "Sales Order") {

                    options = [
                        "",
                        "Draft",
                        "To Deliver and Bill",
                        "To Bill",
                        "Partially Deliver",
                        "Completed",
                        "Cancelled"
                    ];
                }

                // Sales Invoice Status
                else if (doctype === "Sales Invoice") {

                    options = [
                        "",
                        "Draft",
                        "Paid",
                        "Partly Paid",
                        "Unpaid",
                        "Overdue",
                        "Cancelled"
                    ];
                }

                // Delivery Note Status
                else if (doctype === "Delivery Note") {

                    options = [
                        "",
                        "Draft",
                        "Return Issued",
                        "Completed",
						"Return"
                    ];
                }

                // Returnable DC Status
                else if (doctype === "Returnable DC") {

                    options = [
                        "",
                        "Return DC",
                        "Returnable DC",
                        "Completed",
                    ];
                }

                status_filter.df.options = options;
                status_filter.refresh();

                report.set_filter_value("status", "");

                report.refresh();
            }
        },

        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.add_months(
                frappe.datetime.get_today(),
                -1
            ),

            on_change: function(report) {
                report.refresh();
            }
        },

        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            reqd: 1,
            default: frappe.datetime.get_today(),

            on_change: function(report) {
                report.refresh();
            }
        },

        {
            fieldname: "status",
            label: "Status",
            fieldtype: "Select",
            options: [""]
        }
    ]
};