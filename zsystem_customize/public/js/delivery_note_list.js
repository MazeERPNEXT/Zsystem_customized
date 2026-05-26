frappe.listview_settings['Delivery Note'] = {

    add_fields: [
        "custom_returnable_dc",
        "is_return",
        "status",
        "per_billed"
    ],

    get_indicator(doc) {

        // Draft
        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        // Cancelled
        if (doc.docstatus === 2) {
            return [__("Cancelled"), "red", "docstatus,=,2"];
        }

        // ==================================================
        // Custom Returnable DC Flow
        // ==================================================
        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1
        ) {

            // Return DC
            if (doc.is_return == 1) {
                return [__("Return DC"), "red", "status,=,Return DC"];
            }

            // Return Issued
            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            // Completed
            if (flt(doc.per_billed) >= 100) {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            // Default Returnable DC
            return [__("Returnable DC"), "orange", "status,=,Returnable DC"];
        }

        // ==================================================
        // Default ERPNext Status
        // ==================================================
        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            if (doc.status === "Return") {
                return [__("Return"), "grey", "status,=,Return"];
            }
             if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            if (doc.status === "To Bill") {
                return [__("To Bill"), "orange", "status,=,To Bill"];
            }

            if (doc.status === "Closed") {
                return [__("Closed"), "green", "status,=,Closed"];
            }

            return [__("Submitted"), "blue", "docstatus,=,1"];
        }
    }
};