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
    }
})
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