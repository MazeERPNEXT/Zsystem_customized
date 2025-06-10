// Copyright (c) 2025, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Serial no and Batch for Purchase Invoice"] = {
	"filters": [
        {
            fieldname:"serial_no",
            label:__("Serial No"),
            fieldtype: "Link",
            options: "Serial No",
        },
        {
            fieldname:"batch_no",
            label:__("Batch No"),
            fieldtype:"Link",
            options:"Batch",
        }
    ]
};