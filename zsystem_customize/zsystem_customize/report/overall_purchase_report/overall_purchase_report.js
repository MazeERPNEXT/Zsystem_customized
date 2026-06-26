// Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Overall Purchase Report"] = {
	filters: [
        {
            fieldname: "name",
            label: "ID",
            fieldtype: "Data"
        },

        {
            fieldname: "supplier",
            label: "Supplier",
            fieldtype: "Link",
            options: "Supplier"
        },

        {
            fieldname: "doctype",
            label: "Doctype",
            fieldtype: "Select",
            options: [
                "",
                "Purchase Order",
                "Purchase Receipt",
                "Purchase Invoice",
            ],

            on_change: function(report) {

                let doctype = report.get_filter_value("doctype");
                let status_filter = report.get_filter("status");

                let options = [""];

                // Sales Order Status
                if (doctype === "Purchase Order") {

                    options = [
                        "",
                        "Draft",
                        "To Receive and Bill",
                        "To Bill",
                        "Partially Deliver",
                        "Completed",
                        // "Cancelled"
                    ];
                }

                // Sales Invoice Status
                else if (doctype === "Purchase Receipt") {

                    options = [
                        "",
                        "Draft",
                        "Partly Billed",
						"To Bill",
						"Completed",
						"Return",
						"Return Issued"                   
                    ];
                }

                // Delivery Note Status
                else if (doctype === "Purchase Invoice") {

                    options = [
                        "",
                        "Draft",
						"Unpaid",
						"Paid",
						"Partly Paid",
						"Overdue",
						"Return",
						"Debit Note Issued"
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
