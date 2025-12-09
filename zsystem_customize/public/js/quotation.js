frappe.provide("zsystem_customize.selling");
erpnext.sales_common.setup_selling_controller();

// --------------------------------------------------------------------
// 0️⃣ FIX: ERPNext removed this function in v15 → avoid JS crash
// --------------------------------------------------------------------
if (!erpnext.set_unit_price_items_note) {
    erpnext.set_unit_price_items_note = function () {};
}

// --------------------------------------------------------------------
// 1️⃣ CUSTOM QUOTATION CONTROLLER (Override)
// --------------------------------------------------------------------
zsystem_customize.selling.QuotationController = class QuotationController extends erpnext.selling.SellingController {

    refresh() {
        super.refresh();

        let doc = this.frm.doc;   // <<< IMPORTANT FIX

        this.set_dynamic_field_label();

        // Hide customer_name field
        this.frm.set_df_property("customer_name", "hidden", 1);

        // ----------------------------------------------------------------
        // SHOW SALES ORDER BUTTON
        // ----------------------------------------------------------------
        if (doc.docstatus == 1 && !["Lost", "Ordered"].includes(doc.status)) {

            if (
                frappe.model.can_create("Sales Order") &&
                (
                    frappe.boot.sysdefaults.allow_sales_order_creation_for_expired_quotation ||
                    !doc.valid_till ||
                    frappe.datetime.get_diff(doc.valid_till, frappe.datetime.get_today()) >= 0
                )
            ) {
                this.frm.add_custom_button(
                    __("Sales Order"),
                    () => this.make_sales_order(),
                    __("Create")
                );
            }

            if (doc.status !== "Ordered" && this.frm.has_perm("write")) {
                this.frm.add_custom_button(
                    __("Set as Lost"),
                    () => this.frm.trigger("set_as_lost_dialog")
                );
            }

            cur_frm.page.set_inner_btn_group_as_primary(__("Create"));
        }
    }
    make_sales_order() {
		var me = this;

		let has_alternative_item = this.frm.doc.items.some((item) => item.is_alternative);
		if (has_alternative_item) {
			this.show_alternative_items_dialog();
		} else {
			frappe.model.open_mapped_doc({
				method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
				frm: me.frm,
			});
		}
	}
    show_alternative_items_dialog() {
		let me = this;

		const table_fields = [
			{
				fieldtype: "Data",
				fieldname: "name",
				label: __("Name"),
				read_only: 1,
			},
			{
				fieldtype: "Link",
				fieldname: "item_code",
				options: "Item",
				label: __("Item Code"),
				read_only: 1,
				in_list_view: 1,
				columns: 2,
				formatter: (value, df, options, doc) => {
					return doc.is_alternative ? `<span class="indicator yellow">${value}</span>` : value;
				},
			},
			{
				fieldtype: "Text Editor",
				fieldname: "description",
				label: __("Description"),
				in_list_view: 1,
				read_only: 1,
			},
			{
				fieldtype: "Currency",
				fieldname: "amount",
				label: __("Amount"),
				options: "currency",
				in_list_view: 1,
				read_only: 1,
			},
			{
				fieldtype: "Check",
				fieldname: "is_alternative",
				label: __("Is Alternative"),
				read_only: 1,
			},
		];

		this.data = this.frm.doc.items
			.filter((item) => item.is_alternative || item.has_alternative_item)
			.map((item) => {
				return {
					name: item.name,
					item_code: item.item_code,
					description: item.description,
					amount: item.amount,
					is_alternative: item.is_alternative,
				};
			});

		const dialog = new frappe.ui.Dialog({
			title: __("Select Alternative Items for Sales Order"),
			fields: [
				{
					fieldname: "info",
					fieldtype: "HTML",
					read_only: 1,
				},
				{
					fieldname: "alternative_items",
					fieldtype: "Table",
					cannot_add_rows: true,
					cannot_delete_rows: true,
					in_place_edit: true,
					reqd: 1,
					data: this.data,
					description: __("Select an item from each set to be used in the Sales Order."),
					get_data: () => {
						return this.data;
					},
					fields: table_fields,
				},
			],
			primary_action: function () {
				frappe.model.open_mapped_doc({
					method: "erpnext.selling.doctype.quotation.quotation.make_sales_order",
					frm: me.frm,
					args: {
						selected_items: dialog.fields_dict.alternative_items.grid.get_selected_children(),
					},
				});
				dialog.hide();
			},
			primary_action_label: __("Continue"),
		});

		dialog.fields_dict.info.$wrapper.html(
			`<p class="small text-muted">
				<span class="indicator yellow"></span>
				${__("Alternative Items")}
			</p>`
		);
		dialog.show();
	}

    // --------------------------------------------------------------------
    // DYNAMIC FIELD LABEL
    // --------------------------------------------------------------------
    set_dynamic_field_label() {
        let quotation_to = this.frm.doc.quotation_to;

        if (quotation_to === "Customer") {
            this.frm.set_df_property("party_name", "label", "Customer/Company Name");
            this.frm.set_df_property("party_name", "reqd", 1);
            this.frm.fields_dict.party_name.get_query = null;

        } else if (quotation_to === "Lead") {
            this.frm.set_df_property("party_name", "label", "Lead");
            this.frm.set_df_property("party_name", "reqd", 1);
            this.frm.fields_dict.party_name.get_query = () => {
                return { query: "erpnext.controllers.queries.lead_query" };
            };

        } else if (quotation_to === "Prospect") {
            this.frm.set_df_property("party_name", "label", "Prospect");
            this.frm.set_df_property("party_name", "reqd", 1);
            this.frm.fields_dict.party_name.get_query = null;
        }
    }
};

// --------------------------------------------------------------------
// 2️⃣ ATTACH CUSTOM CONTROLLER
// --------------------------------------------------------------------
frappe.ui.form.on("Quotation", {

    onload(frm) {
        frm.script_manager.make(zsystem_customize.selling.QuotationController);
    },

    refresh(frm) {
        if (frm.script_manager?.frm?.controller) {
            frm.script_manager.frm.controller.set_dynamic_field_label();
        }
    },

    quotation_to(frm) {
        if (frm.script_manager?.frm?.controller) {
            frm.script_manager.frm.controller.set_dynamic_field_label();
        }
    }
});
