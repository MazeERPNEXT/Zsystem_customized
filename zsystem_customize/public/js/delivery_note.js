frappe.ui.form.on("Delivery Note Item",{
    item_code:function(frm, cdt, cdn){
        locals[cdt][cdn].use_serial_batch_fields = 1;
        frappe.flags.dialog_set = false;
        frappe.flags.hide_serial_batch_dialog = false;
        setTimeout(function() {
            frappe.model.set_value(cdt, cdn, 'rate', 0);
            // frappe.model.set_value(cdt, cdn, 'price_list_rate', 0);
            // frappe.model.set_value(cdt, cdn, 'base_price_list_rate', 0);
        },1000);
        set_filter_serialno_based_item(frm);
    }
})
frappe.ui.form.on("Delivery Note", {

    refresh(frm) {
        if (frm.doc.docstatus == 1){
            $('.icon-btn[data-original-title = "Print"]').show();
        }
        else{
            $('.icon-btn[data-original-title = "Print"]').hide();
        }
        frm.fields_dict.custom_modified_by.$wrapper
            .find('.control-value')
            .css('color', 'black');

        // Return DC
        if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.is_return == 1
        ) {

            frm.page.set_indicator(
                __("Return DC"),
                "orange"
            );

        }

        // Return Issued
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.status === "Return Issued"
        ) {

            frm.page.set_indicator(
                __("Return Issued"),
                "grey"
            );

        }

        // Completed
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1 &&
            flt(frm.doc.per_billed) >= 100
        ) {

            frm.page.set_indicator(
                __("Completed"),
                "green"
            );

        }

        // Outstanding Item
        else if (
            frm.doc.docstatus === 1 &&
            frm.doc.custom_returnable_dc == 1
        ) {

            frm.page.set_indicator(
                __("Outstanding Item"),
                "orange"
            );

        }
    },
    before_submit: async function(frm) {
        for (let row of frm.doc.items || []) {
            if (row.item_code) {
                let r = await frappe.db.get_value(
                    "Item",
                    row.item_code,
                    "custom_stock_qty"
                );

                if (r && r.message) {
                    row.custom_item_stock_qty = r.message.custom_stock_qty || 0;
                }
            }
        }

        frm.refresh_field("items");
    },
     custom_priority(frm) {
        const map = {
            "High": 1,
            "Medium": 2,
            "Low": 3
        };

        frm.set_value("custom_priority_order", map[frm.doc.custom_priority] || 99);
    },
    async before_save(frm) {
        if (frm.doc.modified_by) {
            let r = await frappe.db.get_value("User", frm.doc.modified_by, "full_name");
            frm.set_value("custom_modified_by", r.message?.full_name || "");
        }
    },
    on_submit(frm) {

        // Return DC document
        if (
            frm.doc.custom_returnable_dc == 1 &&
            frm.doc.is_return == 1
        ) {

            // Set current document as Return DC
            frappe.db.set_value(
                "Delivery Note",
                frm.doc.name,
                "status",
                "Return DC"
            );

            // Update original DN as Return Issued
            if (frm.doc.return_against) {

                frappe.db.set_value(
                    "Delivery Note",
                    frm.doc.return_against,
                    "status",
                    "Return Issued"
                );
            }

            frm.reload_doc();
        }

        // Normal Outstanding Item
        else if (frm.doc.custom_returnable_dc == 1) {

            frappe.db.set_value(
                "Delivery Note",
                frm.doc.name,
                "status",
                "Outstanding Item"
            ).then(() => {
                frm.reload_doc();
            });
        }
    },
    async customer(frm){
        if(frm.doc.customer){
            let r = await frappe.db.get_value("Customer",frm.doc.customer,"custom_sales_person");
            frm.set_value("custom_sales_person",r.message.custom_sales_person || '')
        }
    }
});

function set_filter_serialno_based_item(frm) {
    frm.set_query("custom_serial_data", "items", function(doc, cdt, cdn) {
        let row = locals[cdt][cdn];

        return {
            filters: {
                item_code: row.item_code,
                status:"Active"
            }
        };
    });
}