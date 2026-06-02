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
    onload: function(frm) {
        if (frm.is_new() && !frm.doc.custom_created_by) {
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
        frm.fields_dict.custom_created_by.$wrapper
            .find('.control-value')
            .css('color', 'black');
    }
});