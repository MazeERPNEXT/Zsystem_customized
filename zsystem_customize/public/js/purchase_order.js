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