frappe.ui.form.on("Sales Order",{
    onload: function(frm) {
        if (!frm.doc.__islocal) return;
        set_sales_person_by_user(frm);
        set_fiscal_year_prefix(frm);
        set_custom_quotation_no(frm);
        //set value based login user
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
    custom_sales_person(frm) {
        if (frm.doc.__islocal) {
            set_naming_series(frm);
        }
    },

    custom_quotation_no(frm) {

        set_naming_series(frm);
    },

    //set particular field bold
    refresh: function (frm) {
        //set color for fields
        frm.fields_dict.custom_created_by.$wrapper
            .find('.control-value')
            .css('color', 'black');

        // set quotation no    
        set_custom_quotation_no(frm);

        //block billing request button for particular user
         setTimeout(() => {
            if (frappe.session.user === "naveen.k@zsystem.in" || frappe.session.user === "kamali.r@zsystem.in" || frappe.session.user == "zproposal@zsystem.in") {
                $('.dropdown-item[data-label="Delivery%20Note"]').hide();
            } else {
                $('.dropdown-item[data-label="Delivery%20Note"]').text("Billing Request");
            }
        }, 500);

        render_cancel_amend_button(frm);
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
    //based on customer set the sales person name
    async customer(frm){
        if(frm.doc.customer){
            let r = await frappe.db.get_value("Customer",frm.doc.customer,"custom_sales_person");
            frm.set_value("custom_sales_person",r.message.custom_sales_person || '')
        }

        //Customize Indication customer
        frm.fields_dict.customer.$wrapper.find(".customer-payment-indicator").remove();

        if (!frm.doc.customer) return;

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Sales Invoice",
                filters: {
                    customer: frm.doc.customer,
                    docstatus: 1
                },
                fields: ["grand_total", "outstanding_amount"],
                limit_page_length: 0
            },
            callback: function(r) {

                let total = 0;
                let outstanding = 0;

                (r.message || []).forEach(function(inv) {
                    total += flt(inv.grand_total);
                    outstanding += flt(inv.outstanding_amount);
                });

                if (!total) return;
                let paid_amount = total - outstanding;

                let paid_percentage = ((total - outstanding) / total) * 100;

                let color = "#28a745";
                let status = "Good Customer";

                if (paid_percentage < 20) {
                    color = "#dc3545";
                    status = "High Risk Customer";
                } else if (paid_percentage < 50) {
                    color = "#fd7e14";
                    status = "Average Customer";
                }

                frm.fields_dict.customer.$wrapper.append(`
                    <div class="customer-payment-indicator"
                        style="margin-top:6px;display:flex;align-items:center;gap:6px;">
                        <span style="
                            width:10px;
                            height:10px;
                            border-radius:50%;
                            background:${color};
                            display:inline-block;">
                        </span>
                        <span style="font-weight:600;color:${color};">
                            ${status} (${format_currency(paid_amount)}) (${paid_percentage.toFixed(1)}% Paid)
                        </span>
                    </div>
                `);

            }
        });

        frappe.db.get_list("Sales Invoice", {
            filters: {
                customer: frm.doc.customer,
                docstatus: 1,
                outstanding_amount: [">", 0]
            },
            fields: ["outstanding_amount"],
            limit: 0
        }).then((r) => {

            let outstanding = r.reduce((sum, d) => sum + flt(d.outstanding_amount), 0);

            if (outstanding > 0) {
                let d = new frappe.ui.Dialog({
                    title: __('Outstanding Amount'),
                    fields: [
                        {
                            fieldtype: 'HTML',
                            options: `
                                <div style="font-size:15px;">
                                    Customer has an outstanding amount of
                                    <b>${format_currency(outstanding)}</b>.<br><br>
                                    Do you want to continue?
                                </div>
                            `
                        }
                    ],
                    primary_action_label: __('Continue'),
                    primary_action() {
                        d.hide();
                        frm.__stop_save = false;
                    },
                    secondary_action_label: __('Cancel'),
                    secondary_action() {
                        d.hide();
                        frm.__stop_save = true;
                        frm.set_value("customer", "");
                    }
                });

                d.show();
            }
        });
    },
    //  validate(frm) {
    //     if (frm.__stop_save) {
    //         frappe.throw(__("Cannot continue due to customer outstanding."));
    //     }
    // },
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

    if (!frm.is_new()) return;

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
    }
}

// ==================================================
// 2️⃣ Fetch latest Fiscal Year
// ==================================================
function set_fiscal_year_prefix(frm) {

    if (!frm.is_new()) return;

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Fiscal Year",
            fields: ["name"],
            order_by: "year_start_date desc",
            limit_page_length: 1
        },
        callback: function(r) {

            if (!r.message || !r.message.length) return;

            let fy = r.message[0].name; // 2025-2026
            let parts = fy.split("-");

            if (parts.length === 2) {

                // Store temporarily
                frm.fy_code =
                    parts[0].slice(-2) +
                    parts[1].slice(-2);

                // Generate naming series
                set_naming_series(frm);
            }
        }
    });
}

// ==================================================
// 3️⃣ Build Naming Series
// ==================================================
function set_naming_series(frm) {

    if (!frm.is_new()) return;

    if (!frm.fy_code) return;

    const sp = frm.doc.custom_sales_person;
    const quote_no = frm.doc.custom_quotation_no;

    if (!sp || !quote_no) return;

    const qn = quote_no.slice(-4);

    const person_code = {
        "Chandru": "CR",
        "Rajarajan": "MR",
        "Ramesh": "RR"
    }[sp];

    if (!person_code) return;

    const naming_series =
        `${frm.fy_code}-${person_code}-${qn}-.####`;

    frm.set_value("naming_series", naming_series);
}

frappe.ui.form.on("Sales Order Item", {
    item_code(frm, cdt, cdn) {
        fetch_last_sales_order_details(frm, cdt, cdn);
        setTimeout(function() {
            frappe.model.set_value(cdt, cdn, 'rate', 0);
            frappe.model.set_value(cdt, cdn, 'price_list_rate', 0);
            frappe.model.set_value(cdt, cdn, 'base_price_list_rate', 0);
        }, 1000);
        get_stock_qty_item(cdt, cdn);
    }
});
function get_stock_qty_item(cdt, cdn) {
    let row = locals[cdt][cdn];

    if (!row.item_code) return;

    frappe.db.get_value("Item", row.item_code, "custom_stock_qty")
        .then(r => {
            if (r.message) {
                frappe.model.set_value(
                    cdt,
                    cdn,
                    "custom_item_stock_qty",
                    r.message.custom_stock_qty || 0
                );
            }
        });
}
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
function render_cancel_amend_button(frm) {
    const $page_actions = frm.page.wrapper.find('.page-actions');

    if (frm.doc.docstatus !== 1) {
        $page_actions.find('#custom-cancel-amend-btn').remove();
        return;
    }

    frm.page.btn_secondary && frm.page.btn_secondary.hide();

    clearTimeout(frm._cancel_amend_timeout);
    frm._cancel_amend_timeout = setTimeout(() => {
        $page_actions.find('#custom-cancel-amend-btn').remove();

        const $btn = $(
            `<button id="custom-cancel-amend-btn" class="btn btn-secondary btn-sm" style="margin-left:8px;">${__("Cancel & Amend")}</button>`
        );
        $btn.on('click', () => cancel_and_amend(frm));

        $page_actions.append($btn);
    }, 200);
}
// amend and cancel code
function cancel_and_amend(frm) {
    frappe.confirm(
        __("This will CANCEL the document and create an AMENDED copy with Revision (R1, R2...). Continue?"),
        () => {

            // STEP 1: Cancel Sales Order
            frappe.call({
                method: "frappe.client.cancel",
                args: {
                    doctype: frm.doc.doctype,
                    name: frm.doc.name
                },
                freeze: true
            }).then(() => {

                // STEP 2: Create amended document with custom revision
                frappe.call({
                    method: "zsystem_customize.sales_order.create_amended_with_revision",
                    args: {
                        sales_order: frm.doc.name
                    },
                    freeze: true
                }).then(r => {
                    if (r.message && r.message.name) {
                        frappe.set_route("Form", "Sales Order", r.message.name);
                    }
                });

            });
        }
    );
}
// position change next dot icon set the cancel and amend button
function move_cancel_amend_after_menu() {

    // ❌ Do nothing if Draft
    if (cur_frm.doc.docstatus !== 1) return;

    setTimeout(() => {
        const $menu = $(".page-actions .menu-btn-group");
        const $btn = $(".page-actions .btn:contains('Cancel & Amend')");

        if ($menu.length && $btn.length) {
            $btn
                .addClass("btn-secondary")
                .css("margin-left", "8px")
                .insertAfter($menu);
        }
    }, 200);
}