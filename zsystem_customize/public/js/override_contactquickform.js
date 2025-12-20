frappe.provide("frappe.ui.form");

class ZsystemCustomerQuickEntryForm
	extends frappe.ui.form.CustomerQuickEntryForm {

	constructor(doctype, after_insert, init_callback, doc, force) {
		super(doctype, after_insert, init_callback, doc, force);
		this.skip_redirect_on_error = true;
	}

	render_dialog() {
		// Ensure fields array exists
		this.fields = (this.fields || []).concat(this.get_variant_fields());
		super.render_dialog();
	}

	insert() {
		/**
		 * Map alias fields to actual Customer fields
		 * because email_id & mobile_no are readonly in doctype
		 */
		const map_field_names = {
			email_address: "email_id",
			mobile_number: "mobile_no",
		};

		Object.entries(map_field_names).forEach(([from, to]) => {
			if (this.dialog.doc[from]) {
				this.dialog.doc[to] = this.dialog.doc[from];
				delete this.dialog.doc[from];
			}
		});

		return super.insert();
	}

	get_variant_fields() {
		return [
			{
				fieldtype: "Section Break",
				label: __("Primary Contact Detail"),
			},
			{
				label: __("Email Id"),
				fieldname: "email_address",
				fieldtype: "Data",
				options: "Email",
				reqd: 1,
			},
			{
				fieldtype: "Column Break",
			},
			{
				label: __("Mobile Number"),
				fieldname: "mobile_number",
				fieldtype: "Data",
				reqd: 1,
			},
			{
				fieldtype: "Section Break",
				label: __("Primary Address Details"),
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
			{
				label: __("ZIP Code"),
				fieldname: "pincode",
				fieldtype: "Data",
			},
			{
				fieldtype: "Column Break",
			},
			{
				label: __("City"),
				fieldname: "city",
				fieldtype: "Data",
			},
			{
				label: __("State/Province"),
				fieldname: "state",
				fieldtype: "Data",
			},
			{
				label: __("Country"),
				fieldname: "country",
				fieldtype: "Link",
				options: "Country",
			},
			{
				label: __("Customer POS Id"),
				fieldname: "customer_pos_id",
				fieldtype: "Data",
				hidden: 1,
			},
		];
	}
}

// ✅ Proper override (after frappe loads)
frappe.ui.form.CustomerQuickEntryForm = ZsystemCustomerQuickEntryForm;

//update Indian Complaince
class ZsystemGSTQuickEntryForm extends frappe.ui.form.CustomerQuickEntryForm {
    get_address_fields() {
        const fields = super.get_address_fields();

        for (const field of fields) {
            const fieldname =
                field.fieldname === "_pincode" ? "pincode" : field.fieldname;

            if (!field.label && fieldname) {
                field.label = frappe.meta.get_label("Address", fieldname);
            }
        }

        return fields;
    }

    render_dialog() {
        this.mandatory = [
            ...this.get_gstin_field(),
            ...this.mandatory,
            ...this.get_contact_fields(),
            ...this.get_address_fields(),
        ];

        if (this.doctype === "Customer") {
            this.mandatory.push({
                label: __("Customer POS ID"),
                fieldname: "customer_pos_id",
                fieldtype: "Data",
                hidden: 1,
            });
        }

        super.render_dialog();
    }

    get_contact_fields() {
        return [
            {
                label: __("Primary Contact Details"),
                fieldname: "primary_contact_section",
                fieldtype: "Section Break",
                collapsible: 0,
            },
            {
                label: __("Email ID"),
                fieldname: "_email_id",
                fieldtype: "Data",
                options: "Email",
                reqd: 1,
            },
            {
                fieldtype: "Column Break",
            },
            {
                label: __("Mobile Number"),
                fieldname: "_mobile_no",
                fieldtype: "Data",
                reqd: 1,
            },
        ];
    }

    update_doc() {
        const doc = super.update_doc();

        // to prevent clash with ERPNext
        doc._address_line1 = doc.address_line1;
        delete doc.address_line1;

        // these fields were suffixed with _ to prevent them from being read only
        doc.email_id = doc._email_id;
        doc.mobile_no = doc._mobile_no;

        return doc;
    }
}
frappe.ui.form.CustomerQuickEntryForm = ZsystemGSTQuickEntryForm;