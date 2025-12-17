frappe.ui.form.on("Sales Order",{
    onload: function(frm) {
        if (frm.doc.__islocal && frappe.session.user_fullname === "Rajarajan") {
            if (frm.fields_dict.custom_sales_person.df.options.includes("Rajarajan")) {
                frm.set_value("custom_sales_person", "Rajarajan");
            } else {
                frappe.msgprint("⚠️ 'Rajarajan' is not in Sales Person options.");
            }
        }
        else if(frm.doc.__islocal && frappe.session.user_fullname === "chandru") {
            if (frm.fields_dict.custom_sales_person.df.options.includes("Chandru")) {
                frm.set_value("custom_sales_person", "Chandru");
            } else {
                frappe.msgprint("⚠️ 'Chandru' is not in Sales Person options.");
            }
        }
        else if(frm.doc.__islocal && frappe.session.user_fullname === "Ramesh.P") {
            if (frm.fields_dict.sales_person.df.options.includes("Ramesh")) {
                frm.set_value("custom_sales_person", "Ramesh");
            } else {
                frappe.msgprint("⚠️ 'Ramesh' is not in Sales Person options.");
            }
        }
        set_custom_quotation_no(frm);
    },
    refresh: function (frm) {
        set_custom_quotation_no(frm);
    },
    before_submit: function (frm) {
        return new Promise((resolve, reject) => {

            frappe.call({
                method: "zsystem_customize.sales_order.validate_so_stock",
                args: {
                    doctype: frm.doctype,
                    name: frm.doc.name
                },
                callback: function (r) {

                    // No stock issue → continue submit
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
                            }
                        ],

                        // ✅ PRIMARY BUTTON
                        primary_action_label: "Submit",
                        primary_action() {
                            d.hide();
                            resolve(); // allow submit
                        },

                        // ✅ SECONDARY BUTTON
                        secondary_action_label: "Hold",
                        secondary_action() {
                            d.hide();
                            reject(); // stop submit (remain Draft)
                        }
                    });

                    d.show();
                }
            });
        });
    },
});
function set_custom_quotation_no(frm) {
    // Already set → don’t override
    if (frm.doc.custom_quotation_no) return;

    // Check first item row
    if (frm.doc.items && frm.doc.items.length > 0) {
        let first_row = frm.doc.items[0];

        if (first_row.prevdoc_docname) {
            frm.set_value(
                "custom_quotation_no",
                first_row.prevdoc_docname
            );
        }
    }
}

