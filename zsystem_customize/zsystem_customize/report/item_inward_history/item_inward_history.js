// Copyright (c) 2026, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.query_reports["Item Inward History"] = {
	"filters": [
		{
            fieldname: "item_code",
            label: "ID",
            fieldtype: "Data",
        },
		{
			fieldname: "fiscal_year",
            label: "Fiscal Year",
            fieldtype: "Link",
			options:"Fiscal Year"	
		}

	]
};
