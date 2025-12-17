frappe.ui.form.on("Quotation",{
     onload: function(frm) {
        if (frm.doc.__islocal && (frappe.session.user_fullname === "Rajarajan" ||frappe.session.user_fullname === "Rajarajan.M" )) {
            if (frm.fields_dict.custom_sales_person.df.options.includes("Rajarajan")) {
                frm.set_value("custom_sales_person", "Rajarajan");
            } else {
                frappe.msgprint("⚠️ 'Rajarajan' is not in Sales Person options.");
            }
        }
        else if(frm.doc.__islocal && (frappe.session.user_fullname === "chandru" ||frappe.session.user_fullname === "Chandru.R" )) {
            if (frm.fields_dict.custom_sales_person.df.options.includes("Chandru")) {
                frm.set_value("custom_sales_person", "Chandru");
            } else {
                frappe.msgprint("⚠️ 'Chandru' is not in Sales Person options.");
            }
        }
        else if(frm.doc.__islocal && frappe.session.user_fullname === "Ramesh.P") {
            if (frm.fields_dict.custom_sales_person.df.options.includes("Ramesh")) {
                frm.set_value("custom_sales_person", "Ramesh");
            } else {
                frappe.msgprint("⚠️ 'Ramesh' is not in Sales Person options.");
            }
        }
        //based on offer type and sales person set naming series
        set_fiscal_year_prefix(frm);
        set_naming_series(frm);
     },
     custom_sales_person: function(frm) {
        set_naming_series(frm);
    },
    custom_offer_type: function(frm) {
        set_naming_series(frm);
    },
    before_save(frm) {
        set_fiscal_year_prefix(frm);
    },
})

// ----------------------------------------------------------------------
// 1️⃣ Fetch latest Fiscal Year and convert to YYYY format (2526)
// ----------------------------------------------------------------------
function set_fiscal_year_prefix(frm) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Fiscal Year",
            fields: ["name"],
            order_by: "year_start_date desc",
            limit_page_length: 1
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {

                let fy = r.message[0].name;   // → "2025-2026"
                let p = fy.split("-");

                if (p.length === 2) {
                    frm.fy_code = p[0].slice(-2) + p[1].slice(-2);  
                    // saves → 2526
                    set_naming_series(frm); // refresh naming series
                }
            }
        }
    });
}

// ----------------------------------------------------------------------
// 2️⃣ Build naming series dynamically
// ----------------------------------------------------------------------
function set_naming_series(frm) {

    if (!frm.fy_code) {
        frm.set_value("naming_series", "");
        return;
    }

    let sp = frm.doc.custom_sales_person;
    let ot = frm.doc.custom_offer_type;

    if (!sp || !ot) {
        frm.set_value("naming_series", "");
        return;
    }

    const person_code = {
        "Chandru": "CR",
        "Rajarajan": "MR",
        "Ramesh":"RR"
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

    if (!person_code || !offer_code) {
        frm.set_value("naming_series", "");
        return;
    }

    // FINAL FORMAT → 2526-TS-CR-.####
    frm.set_value("naming_series", `${frm.fy_code}-${offer_code}-${person_code}-.####`);
}        