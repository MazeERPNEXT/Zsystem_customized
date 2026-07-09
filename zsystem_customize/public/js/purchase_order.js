frappe.ui.form.on("Purchase Order",{
    supplier(frm){
        if(!frm.doc.supplier){
            return
        }
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
        })
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
}
})
// last purchase rate and date
frappe.ui.form.on("Purchase Order Item", {
    item_code(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (!row.item_code) return;

        frappe.call({
            method: "zsystem_customize.purchase_order.get_last_purchase_detail",
            args: {
                item_code: row.item_code,
                supplier: frm.doc.supplier
            },
            callback(r) {
                if (r.message) {
                    frappe.model.set_value(
                        cdt,
                        cdn,
                        "last_purchase_price",
                        r.message.rate
                    );

                    frappe.model.set_value(
                        cdt,
                        cdn,
                        "custom_last_purchase_date",
                        r.message.transaction_date
                    );
                }
            }
        });
    }
});