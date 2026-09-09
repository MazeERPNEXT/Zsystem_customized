frappe.ui.form.on("Material Request", {
    material_request_type: function(frm) {
        if (frm.doc.material_request_type === "Material Transfer") {
            frm.set_value("set_warehouse", "Factory Store - Z");
        } else {
            frm.set_value("set_warehouse", "");
        }
    },
});

frappe.ui.form.on("Material Request Item", {
    item_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (!row.item_code) {
            return;
        }

        frappe.db.get_value("Item", row.item_code, "custom_warehouse")
            .then(r => {
                if (r.message && r.message.custom_warehouse) {
                    frappe.model.set_value(
                        cdt,
                        cdn,
                        "from_warehouse",
                        r.message.custom_warehouse
                    );
                }
            });
    }
});