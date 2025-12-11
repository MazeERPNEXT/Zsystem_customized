// Copyright (c) 2025, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Estimation", {
    refresh(frm) {
        frm.add_custom_button(__('<i class="fa fa-file-excel-o " style="font-size:24px;color:green"></i>'), function() {
            var names = frm.doc.name;
            console.log(names)
            window.open("/api/method/zsystem_customize.zsystem_customize.doctype.quotation_estimation.quotation_estimation.get_excel_process?name=" + names, '_blank');
        });
        //Custom Quotation Btn
        if(frm.doc.docstatus == "1"){
            frm.add_custom_button(__("Quotation"),
        ()=>frm.events.make_quotation_estimation_to_quotation(frm),
        __("Create"))
         create_btn = frm.page.set_inner_btn_group_as_primary(__('Create'));

        // apply css to the actual button element
        $(create_btn).css({
            'background-color': 'black',
            'color': 'white'
        });
        }
        
    },
    onload: function(frm) {
        if (frm.doc.__islocal && frappe.session.user_fullname === "Rajarajan") {
            if (frm.fields_dict.sales_person.df.options.includes("Rajarajan")) {
                frm.set_value("sales_person", "Rajarajan");
            } else {
                frappe.msgprint("⚠️ 'Rajarajan' is not in Sales Person options.");
            }
        }
        else if(frm.doc.__islocal && frappe.session.user_fullname === "chandru") {
            if (frm.fields_dict.sales_person.df.options.includes("Chandru")) {
                frm.set_value("sales_person", "Chandru");
            } else {
                frappe.msgprint("⚠️ 'Chandru' is not in Sales Person options.");
            }
        }
        //based on offer type and sales person set naming series
        set_fiscal_year_prefix(frm);
        set_naming_series(frm);
    },
    sales_person: function(frm) {
        set_naming_series(frm);
    },
    offer_type: function(frm) {
        set_naming_series(frm);
    },
    before_save(frm) {
        set_fiscal_year_prefix(frm);
    },       
    on_change(frm, cdt, cdn) {
        calculate_total_unitkp(frm);
        calculate_total_lpvalue(frm);
        calculate_total_kpvalue(frm);
        calculate_total_unitprice(frm);
        calculate_total_totalprice(frm);
        calculate_overall_totallp(frm);
        calculate_overall_totalkp(frm);
        calculate_overall_totalprice(frm);
    },
    validate(frm, cdt, cdn) {
        calculate_total_unitkp(frm);
        calculate_total_lpvalue(frm);
        calculate_total_kpvalue(frm);
        calculate_total_unitprice(frm);
        calculate_total_totalprice(frm);
        calculate_overall_totallp(frm);
        calculate_overall_totalkp(frm);
        calculate_overall_totalprice(frm);
    },
    make_quotation_estimation_to_quotation: function(frm) {
        frappe.model.open_mapped_doc({
            method: "zsystem_customize.zsystem_customize.doctype.quotation_estimation.quotation_estimation.quotation_estimation_to_quotation",
            frm: frm,
            run_link_triggers: true,
        });
    }

});

//Function to Calculate and update unit_kp
function calculate_total_unitkp(frm) {
    let total_unit_kp = 0;
    let cust_disc = 0;
    // Check if table_buva exists and has data
    if (frm.doc.table_buva && frm.doc.table_buva.length > 0) {
        $.each(frm.doc.table_buva, function(i, d) {
            // Calculate unit_kp for the current row
            let row_unit_kp = Math.ceil(d.unit_lp * (100 - d.cust_disc) / 100);
            // Update the unit_kp field for the current row
            frappe.model.set_value(d.doctype, d.name, "unit_kp", row_unit_kp);
            // Add to total_unit_kp for the overall total
            total_unit_kp += row_unit_kp;
        });
    }
    // Set the total unit_kp for the form document
    frappe.model.set_value(frm.doc.doctype, frm.doc.name, "unit_kp", total_unit_kp);
    // Log the total to the console
    console.log("Unit KP: ",total_unit_kp);
}

//Function to Calculate Total LP
function calculate_total_lpvalue(frm){
    let total_lp_value = 0;
    if(frm.doc.table_buva && frm.doc.table_buva.length > 0){
        $.each(frm.doc.table_buva,function(i,d){
            row_total_lp = d.qty * d.unit_lp;
            frappe.model.set_value(d.doctype,d.name,"total_lp",row_total_lp)
            total_lp_value+=row_total_lp
        });
    }
    frappe.model.set_value(frm.doc.doctype,frm.doc.name,"total_lp",total_lp_value);
    console.log("Total LP: ",total_lp_value)
}

//Function to Calculate Total KP
function calculate_total_kpvalue(frm){
    let total_kp_value = 0;
    if(frm.doc.table_buva && frm.doc.table_buva.length > 0){
        $.each(frm.doc.table_buva,function(i,d){
            row_kp_value = d.qty * d.unit_kp;
            frappe.model.set_value(d.doctype,d.name,"total_kp",row_kp_value);
            total_kp_value+=row_kp_value
        });
    }
    frappe.model.set_value(frm.doc.doctype,frm.doc.name,"total_kp",total_kp_value);
    console.log("Total KP: ",total_kp_value)
}

//Function to Calculate Unit Price
function calculate_total_unitprice(frm) {
    let unitprice_value = 0;

    if (frm.doc.table_buva && frm.doc.table_buva.length > 0) {
        $.each(frm.doc.table_buva, function (i, d) {
            let row_price_value = Math.ceil(d.unit_kp / d.margin);
            frappe.model.set_value(d.doctype, d.name, "unit_price", row_price_value);
            unitprice_value += row_price_value;
        });
    }

    frappe.model.set_value(frm.doc.doctype,frm.doc.name,"unit_price",unitprice_value);
    console.log("unit_price: ", unitprice_value);
}


// Function to Calculate the Total unit price
function calculate_total_totalprice(frm){
    let totalprice_value = 0;
    if(frm.doc.table_buva && frm.doc.table_buva.length > 0){
        $.each(frm.doc.table_buva,function(i,d){
            row_total_price = d.unit_price * d.qty;
            frappe.model.set_value(d.doctype,d.name,"total_price",row_total_price);
            totalprice_value+=row_total_price;
        });
        frappe.model.set_value(frm.doc.doctype,frm.doc.name,"total_price",totalprice_value);
        console.log("Total Price: ",totalprice_value);
    }
}

//Function to Calculate the Overall Total LP
function calculate_overall_totallp(frm) {
    let total_lp_value = 0;

    if (frm.doc.table_buva && frm.doc.table_buva.length > 0) {
        $.each(frm.doc.table_buva, function(i, d) {
            total_lp_value += parseFloat(d.total_lp) || 0; // Ensure numeric addition
        });
    }

    frm.set_value("overall_total_lp", total_lp_value);
    frm.refresh_field("overall_total_lp"); // Ensure UI update
    console.log("Overall Total LP:", total_lp_value);
}

//Function to Calculate the Overall Total KP
function calculate_overall_totalkp(frm){
    let total_kpvalue = 0;
    if(frm.doc.table_buva && frm.doc.table_buva.length > 0){
        $.each(frm.doc.table_buva,function(i,d){
            total_kpvalue+=parseFloat(d.total_kp) || 0;
        });
    }
    frm.set_value("overall_total_kp",total_kpvalue);
    frm.refresh_field("overall_total_kp");
    console.log("Overall Total KP: ",total_kpvalue);
}

//Function to Calculate the Overall Total Price
function calculate_overall_totalprice(frm){
    let total_price_value = 0;
    if(frm.doc.table_buva && frm.doc.table_buva.length > 0){
        $.each(frm.doc.table_buva,function(i,d){
            total_price_value+=parseFloat(d.total_price) || 0;
        });
    }
    frm.set_value("overall_total_price",total_price_value);
    frm.refresh_field("total_price_value");
    console.log("Overall Price Total: ",total_price_value);
}

//Update description value html tag to plain text
frappe.ui.form.on("Quotation Estimation Child Table", {
    part_no: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (!row.part_no) return;

        frappe.db.get_value("Item", row.part_no, "description")
            .then(res => {
                if (!res || !res.message) return;

                let desc = res.message.description || "";

                // Strip HTML tags
                let plain_text = desc.replace(/<[^>]*>/g, "").trim();

                frappe.model.set_value(cdt, cdn, "description", plain_text);
            });
    }
});
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

    let sp = frm.doc.sales_person;
    let ot = frm.doc.offer_type;

    if (!sp || !ot) {
        frm.set_value("naming_series", "");
        return;
    }

    const person_code = {
        "Chandru": "CR",
        "Rajarajan": "RR"
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