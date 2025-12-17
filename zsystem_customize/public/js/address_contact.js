frappe.provide("frappe.ui.form");

class ZsystemContactAddressQuickEntryForm extends frappe.ui.form.ContactAddressQuickEntryForm 
{
	constructor(doctype, after_insert, init_callback, doc, force) {
		super(doctype, after_insert, init_callback, doc, force);
		this.skip_redirect_on_error = true;
	}

	render_dialog() {
		// Add custom fields
		this.mandatory = this.mandatory.concat([
			"email_address",
			"mobile_number",
		]);

		super.render_dialog();

		// Force UI to show mandatory star
		this.dialog.set_df_property("email_address", "reqd", 1);
		this.dialog.set_df_property("mobile_number", "reqd", 1);

		this.dialog.refresh();
	}

	insert() {
		// Map alias fields to actual readonly fields
		const map_field_names = {
			email_address: "email_id",
			mobile_number: "mobile_no",
		};

		Object.entries(map_field_names).forEach(([from, to]) => {
			this.dialog.doc[to] = this.dialog.doc[from];
			delete this.dialog.doc[from];
		});

		return super.insert();
	}

	get_variant_fields() {
		return [
			{
				fieldtype: "Section Break",
				label: __("Primary Contact Details"),
				// collapsible: 1,
			},
			{
				label: __("Email Id"),
				fieldname: "email_address",
				fieldtype: "Data",
				options: "Email",
			},
			{
				fieldtype: "Column Break",
			},
			{
				label: __("Mobile Number"),
				fieldname: "mobile_number",
				fieldtype: "Data",
			},
			{
				fieldtype: "Section Break",
				label: __("Primary Address Details"),
				// collapsible: 1,
			},
			{
				label: __("Address Line 1"),
				fieldname: "address_line1",
				fieldtype: "Data",
			},
			{
				label: __("Address Line 2"),
				fieldname: "address_line2",
				fieldtype: "Data",
			},
		];
	}
}

// Override
frappe.ui.form.ContactAddressQuickEntryForm = ZsystemContactAddressQuickEntryForm;
