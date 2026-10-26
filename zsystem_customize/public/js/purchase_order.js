frappe.ui.form.on("Purchase Order",{
    supplier(frm){
        if(!frm.doc.supplier){
            return
        }
        frappe.db.get_value(
            "Supplier",
            frm.doc.supplier,
            [
                "custom_payment_term",
                "custom_zsystem_responsible_person"
            ]
        ).then(({ message }) => {
            if (message) {
                frm.set_value("custom_payment_days", message.custom_payment_term || "");
                frm.set_value(
                    "custom_zsystem_responsible_person",
                    message.custom_zsystem_responsible_person || ""
                );
            }
        });
        frappe.call({
            method:"frappe.client.get_list",
            args : {
                "doctype": "Purchase Order",
                filters:{
                    supplier:frm.doc.supplier,
                    docstatus:["!=",2]
                },
                fields: ["name", "shipping_address"],
                order_by: "creation desc",
                limit_page_length: 1
            },
            callback:function(r){
                if(r.message && r.message.length){
                    let po = r.message[0];
                    if(po.shipping_address){
                        frm.set_value("shipping_address",po.shipping_address)
                    }
                }
            }
        });
         (frm.doc.items || []).forEach(row => {
            fetch_last_purchase_rate(frm, row.doctype, row.name);
        });
    },
    refresh: function(frm){
        frm.fields_dict.custom_created_by.$wrapper
            .find('.control-value')
            .css('color', 'black');
        if (frm.is_new() && frm.doc.custom_created_by) {
                set_concern_person(frm)
        }
        //based on so to po hide add and multiple add item btn
        toggle_items_buttons(frm);
        
    },
    onload: function (frm) {
        if (frm.is_new()) {
            frm.set_value("custom_created_by", frappe.user.full_name());
        }
    },
    before_submit: function(frm) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: "zsystem_customize.purchase_order.validate_stock_against_qty",
                args: {
                    doctype: frm.doctype,
                    name: frm.doc.name,
                },
                callback: function(r) {
                    if (!r.message || !r.message.has_error) {
                        resolve();
                        return;
                    }

                    let d = new frappe.ui.Dialog({
                        title: "Stock Warning",
                        size: "large",
                        fields: [
                            {
                                fieldtype: "HTML",
                                fieldname: "stock_html",
                                options: r.message.html
                            },
                            {
                                fieldtype: "Check",
                                fieldname: "confirm_submit",
                                label: "I have reviewed the stock warning and want to continue.",
                                onchange: function() {
                                    let checked = d.get_value("confirm_submit");

                                    if (checked) {
                                        d.get_primary_btn().show();
                                    } else {
                                        d.get_primary_btn().hide();
                                    }
                                }
                            }
                        ],
                        primary_action_label: "Submit",
                        primary_action() {
                            d.hide();
                            resolve();
                        }
                    });

                    d.show();

                    // Hide Submit button initially
                    d.get_primary_btn().hide();
                }
            });
        });
    },
    custom_created_by: function(frm) {
        set_concern_person(frm)
        // if (!frm.doc.custom_created_by) {
        //     frm.set_value("custom_concern_person", "");
        //     return;
        // }

        // frappe.db.exists("Zsystem Contact Person", frm.doc.custom_created_by)
        //     .then(exists => {
        //         if (exists) {
        //             frm.set_value(
        //                 "custom_concern_person",
        //                 frm.doc.custom_created_by
        //             );
        //         } else {
        //             frm.set_value("custom_concern_person", "");
        //         }
        //     });
    }
})
// last purchase rate and date
frappe.ui.form.on("Purchase Order Item", {
    item_code(frm, cdt, cdn) {
        fetch_last_purchase_rate(frm, cdt, cdn);
    }
});
function fetch_last_purchase_rate(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    if (!frm.doc.supplier || !row.item_code) {
        frappe.model.set_value(cdt, cdn, "custom_last_purchase_price", "");
        frappe.model.set_value(cdt, cdn, "custom_last_purchase_date", "");
        return;
    }

    frappe.call({
        method: "zsystem_customize.purchase_order.get_last_purchase_detail",
        args: {
            item_code: row.item_code,
            supplier: frm.doc.supplier
        },
        callback: function(r) {
            if (r.message && Object.keys(r.message).length) {
                frappe.model.set_value(cdt, cdn, "custom_last_purchase_price", r.message.rate);
                frappe.model.set_value(cdt, cdn, "custom_last_purchase_date", r.message.posting_date);
            } else {
                frappe.model.set_value(cdt, cdn, "custom_last_purchase_price", "");
                frappe.model.set_value(cdt, cdn, "custom_last_purchase_date", "");
            }
        }
    });
}

// based on created by set value Concern Person
function set_concern_person(frm) {
    if (!frm.doc.custom_created_by) {
        frm.set_value("custom_concern_person", "");
        return;
    }

    frappe.db.exists("Zsystem Contact Person", frm.doc.custom_created_by)
        .then(exists => {
            frm.set_value(
                "custom_concern_person",
                exists ? frm.doc.custom_created_by : ""
            );
        });
}

//based on so to po hide add and multiple add item btn
function toggle_items_buttons(frm) {
    if (frm.doctype !== "Purchase Order") return;

    const has_sales_order = (frm.doc.items || []).some(row =>
        row.sales_order || row.custom_sales_order_no
    );

    const grid = frm.fields_dict.items.grid;

    if (!grid) return;

    if (has_sales_order) {
        grid.wrapper.find(".grid-add-row").hide();
        grid.wrapper.find(".grid-add-multiple-rows").hide();
    } else {
        grid.wrapper.find(".grid-add-row").show();
        grid.wrapper.find(".grid-add-multiple-rows").show();
    }
}