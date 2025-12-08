// Copyright (c) 2025, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Offer Types", {
	// refresh(frm) {

	// },
    offer_name: function (frm) {
		if (frm.doc.__islocal) {
			// add missing " " arg in split method
			let parts = frm.doc.offer_name.split(" ");
			let abbr = $.map(parts, function (p) {
				return p ? p.substr(0, 1) : null;
			}).join("");
			frm.set_value("offer_abbr", abbr);
		}
	},
});
