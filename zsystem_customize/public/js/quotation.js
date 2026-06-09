frappe.ui.form.on("Quotation", {
    //set particular field bold
    refresh(frm){
        frm.fields_dict.custom_created_by.$wrapper
            .find('.control-value')
            .css('color', 'black');
    },

    // --------------------------------------------------
    // ONLOAD – only for NEW documents
    // --------------------------------------------------
    onload(frm) {
        if (!frm.doc.__islocal) return;

        set_sales_person_by_user(frm);
        set_fiscal_year_prefix(frm);
        //auto set session user as created by
        if(frm.is_new() && !frm.doc.custom_created_by){
            frappe.db.set_value("User",frappe.session.user,"full_name").then(r =>{
                frm.set_value("custom_created_by",r.message.full_name);
            })
        }
    },

    // --------------------------------------------------
    // Rebuild naming series on changes (NEW doc only)
    // --------------------------------------------------
    custom_sales_person(frm) {
        if (frm.doc.__islocal) {
            set_naming_series(frm);
        }
    },

    custom_offer_type(frm) {
        if (frm.doc.__islocal) {
            set_naming_series(frm);
        }
    },

    // --------------------------------------------------
    // FINAL chance before insert
    // --------------------------------------------------
    validate(frm) {
        if (frm.doc.__islocal) {
            set_naming_series(frm);
        }
    },
    async party_name(frm) {
        if (frm.doc.party_name) {
            let r = await frappe.db.get_value(
                'Customer',
                frm.doc.party_name,
                'custom_sales_person'
            );

            frm.set_value(
                'custom_sales_person',
                r.message.custom_sales_person || ''
            );
        }
    }
});


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
    const ot = frm.doc.custom_offer_type;

    if (!sp || !ot) return;

    const person_code = {
        "Chandru": "CR",
        "Rajarajan": "MR",
        "Ramesh": "RR"
    }[sp];

    const offer_code = {
        "Trade Siemens-TS": "TS",
        "Services Support-SS": "SS",
        "Trade Teltonika-TK": "TK",
        "Trade Truck-TT": "TT",
        "Trade Azbil-TA": "TA",
        "Trade Disoic-TD": "TD",
        "Project-PJ": "PJ",
        "Trade Others-TO": "TO"
    }[ot];

    if (!person_code || !offer_code) return;

    // FINAL FORMAT → 2526-TS-CR-.####
    frm.set_value(
        "naming_series",
        `${frm.fy_code}-${offer_code}-${person_code}-.####`
    );
}

//Child table rate value set 0
frappe.ui.form.on("Quotation Item", {
    item_code(frm, cdt, cdn) {
        setTimeout(function() {
            frappe.model.set_value(cdt, cdn, 'rate', 0);
            frappe.model.set_value(cdt, cdn, 'price_list_rate', 0);
            frappe.model.set_value(cdt, cdn, 'base_price_list_rate', 0);
        }, 500);
    }
});