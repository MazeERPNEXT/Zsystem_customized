frappe.ui.form.on("Sales Invoice",{
    custom_income_account(frm) {
        if (!frm.doc.custom_income_account) return;

        frm.doc.items.forEach(row => {
            frappe.model.set_value(
                row.doctype,
                row.name,
                "income_account",
                frm.doc.custom_income_account
            );
        });
    },
    custom_payment_days(frm){
        let payment_value = frm.doc.custom_payment_days;
        if(payment_value && !/^\d+$/.test(payment_value)){
            frappe.msgprint(__("Payment Team allow number only"))
            frm.set_value("custom_payment_days","");
        }
    },
    onload: function(frm) {
        if (frm.is_new() && frm.doc.custom_created_by) {
            frappe.db.get_value(
                "User",
                frappe.session.user,
                "full_name"
            ).then(r => {
                if (r.message) {
                    frm.set_value("custom_created_by", r.message.full_name);
                }
            });
        }
    },
    refresh: function(frm){
        // if (frm.doc.docstatus == 1){
        //     $('.icon-btn[data-original-title = "Print"]').show();
        // }
        // else{
        //     $('.icon-btn[data-original-title = "Print"]').hide();
        // }
        frm.fields_dict.custom_created_by.$wrapper
            .find('.control-value')
            .css('color', 'black');
    },
    //based on customer set the sales person name
    async customer(frm){
        if(frm.doc.customer){
            let r = await frappe.db.get_value("Customer",frm.doc.customer,["custom_sales_person","custom_payment_term"]);
            frm.set_value("custom_sales_person",r.message.custom_sales_person || '')
            frm.set_value("custom_payment_days",r.message.custom_payment_term || '')
        }
    },
    //set value in whatsapp no field based on mobile no value
    before_save: function(frm) {
        let mobile_no = frm.doc.contact_mobile;

        if (!mobile_no) return;

        let covert_mobile_no = mobile_no
            .replace(/^\+91/, "")
            .replace(/\s+/g, "")
            .replace(/^91(?=\d{10}$)/, "");

        // Validate Indian mobile number
        if (!/^[6-9]\d{9}$/.test(covert_mobile_no)) {
            frappe.msgprint({
                title: "Invalid Mobile Number",
                message: "Not an India number. Please enter a valid Indian mobile number for sent msg.",
                indicator: "red"
            });
            return;
        }

        let whatsapp_no = "91" + covert_mobile_no;

        console.log("Whatsapp no:", whatsapp_no);
        frm.set_value("custom_whatsapp_no",whatsapp_no);
    }
});