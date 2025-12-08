frappe.provide("zsystem_customize.selling");
erpnext.sales_common.setup_selling_controller();
// --------------------------------------------------------------------
// 0️⃣ FIX: ERPNext removed this function in v15, avoid JS crash
// --------------------------------------------------------------------
if (!erpnext.set_unit_price_items_note) {
    erpnext.set_unit_price_items_note = function () {};
}

// --------------------------------------------------------------------
// 1️⃣ CUSTOM OVERRIDE CONTROLLER
// --------------------------------------------------------------------
zsystem_customize.selling.QuotationController = class QuotationController extends erpnext.selling.SellingController {

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
// 2️⃣ BIND THE OVERRIDE CONTROLLER EARLY (IMPORTANT)
// --------------------------------------------------------------------
frappe.ui.form.on("Quotation", {
    setup(frm) {
        // This ensures ERPNext uses your custom controller
        frm.script_manager.make(zsystem_customize.selling.QuotationController);
    },

    refresh(frm) {
        frm.trigger("set_dynamic_field_label");
    },

    quotation_to(frm) {
        frm.trigger("set_dynamic_field_label");
    }
});
