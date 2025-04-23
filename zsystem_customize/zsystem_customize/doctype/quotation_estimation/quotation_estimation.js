// Copyright (c) 2025, mazeworks solutions pvt ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation Estimation", {
    refresh(frm) {
        frm.add_custom_button(__('<i class="fa fa-file-excel-o " style="font-size:24px;color:green"></i>'), function() {
            var names = frm.doc.name;
            console.log(names)
            window.open("/api/method/zsystem_customize.zsystem_customize.doctype.quotation_estimation.quotation_estimation.get_excel_process?name=" + names, '_blank');
        });
        
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
});

//Function to Calculate and update unit_kp
function calculate_total_unitkp(frm) {
    let total_unit_kp = 0;

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

