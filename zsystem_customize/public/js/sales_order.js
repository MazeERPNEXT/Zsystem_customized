frappe.ui.form.on("Sales Order",{
    onload: function(frm) {
        if (!frm.doc.__islocal) return;
        set_sales_person_by_user(frm);
        set_fiscal_year_prefix(frm);
        set_custom_quotation_no(frm);
    },
    custom_sales_person(frm) {
        if (frm.doc.__islocal) {
            set_naming_series(frm);
        }
    },
    refresh: function (frm) {
        set_custom_quotation_no(frm);
    },
    onload_post_render(frm) {
        // Run only when created from Quotation
        if (frm.doc.__islocal && frm.doc.items?.length) {
            frm.doc.items.forEach(row => {
                fetch_last_sales_order_details(frm, row.doctype, row.name);
            });
        }
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

// ==================================================
// 1️⃣ Auto-set Sales Person based on user
// ==================================================
function set_sales_person_by_user(frm) {
    if (!frm.doc.__islocal) return;

    const user_map = {
        "Rajarajan": "Rajarajan",
        "Rajarajan.M": "Rajarajan",
        "chandru": "Chandru",
        "Chandru.R": "Chandru",
        "Ramesh.P": "Ramesh"
    };

    const sp = user_map[frappe.session.user_fullname];
    if (!sp) return;

    const options = frm.fields_dict.custom_sales_person.df.options || "";
    if (options.includes(sp)) {
        frm.set_value("custom_sales_person", sp);
    } else {
        frappe.msgprint(`⚠️ '${sp}' not available in Sales Person options`);
    }
}

// ==================================================
// 2️⃣ Fetch latest Fiscal Year → 2526
// ==================================================
function set_fiscal_year_prefix(frm) {

    if (!frm.doc.__islocal || frm.fy_code) return;

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Fiscal Year",
            fields: ["name"],
            order_by: "year_start_date desc",
            limit_page_length: 1
        },
        callback(r) {
            if (!r.message || !r.message.length) return;

            let fy = r.message[0].name;     // 2025-2026
            let parts = fy.split("-");

            if (parts.length === 2) {
                frm.fy_code = parts[0].slice(-2) + parts[1].slice(-2); // 2526
                set_naming_series(frm);
            }
        }
    });
}
// ==================================================
// 3️⃣ Build Naming Series
// ==================================================
function set_naming_series(frm) {

    if (!frm.doc.__islocal) return;
    if (!frm.fy_code) return;

    const sp = frm.doc.custom_sales_person;
    const quote_no = frm.doc.custom_quotation_no;
    // const ot = frm.doc.custom_offer_type;
    if (!quote_no) return;
    const qn = quote_no.slice(-4); 
    if (!sp) return;

    const person_code = {
        "Chandru": "CR",
        "Rajarajan": "MR",
        "Ramesh": "RR"
    }[sp];

    // const offer_code = {
    //     "Trade Siemens-TS": "TS",
    //     "Services Support-SS": "SS",
    //     "Trade Teltonika-TK": "TK",
    //     "Trade Truck-TT": "TT",
    //     "Trade Azbil-TA": "TA",
    //     "Trade Disoic-TD": "TD",
    //     "Project-PJ": "PJ",
    //     "Trade Others-TO": "TO"
    // }[ot];

    if (!person_code) return;

    frm.set_value(
        "naming_series",
        `${frm.fy_code}-${person_code}-${qn}-.####`
    );
}


frappe.ui.form.on("Sales Order Item", {
    item_code(frm, cdt, cdn) {
        fetch_last_sales_order_details(frm, cdt, cdn);
    }
});

function fetch_last_sales_order_details(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    if (!row.item_code || !frm.doc.customer) return;

    frappe.call({
        method: "zsystem_customize.sales_order.get_last_sales_order_details",
        args: {
            customer: frm.doc.customer,
            item_code: row.item_code,
            current_so: frm.doc.name || ""
        },
        callback(r) {
            if (r.message && r.message.rate) {
                frappe.model.set_value(cdt, cdn, {
                    custom_last_selling_amount: r.message.rate,
                    custom_last_selling_date: r.message.transaction_date
                });
            }
        }
    });
}