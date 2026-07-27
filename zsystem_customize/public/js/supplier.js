frappe.ui.form.on('Supplier', {
    supplier_name(frm) {
        if (frm.doc.supplier_name) {
            frm.set_value(
                'supplier_name',
                frm.doc.supplier_name.toUpperCase()
            );
        }
    },
    custom_payment_term(frm){
        let payment_value = frm.doc.custom_payment_term;
        if(payment_value && !/^\d+$/.test(payment_value)){
            frappe.msgprint(__("Payment Team allow number only"))
            frm.set_value("custom_payment_term","");

        }
    }
})